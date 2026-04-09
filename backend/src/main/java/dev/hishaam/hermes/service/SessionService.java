package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.*;
import dev.hishaam.hermes.entity.Passage;
import dev.hishaam.hermes.entity.Quiz;
import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.entity.SessionStatus;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.ParticipantRepository;
import dev.hishaam.hermes.repository.QuestionRepository;
import dev.hishaam.hermes.repository.QuizRepository;
import dev.hishaam.hermes.repository.QuizSessionRepository;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SessionService {

  private final QuizSessionRepository sessionRepository;
  private final QuizRepository quizRepository;
  private final QuestionRepository questionRepository;
  private final ParticipantRepository participantRepository;
  private final OwnershipService ownershipService;
  private final SessionSnapshotService snapshotService;
  private final SessionLiveStateService liveStateService;
  private final SessionCodeService sessionCodeService;
  private final SessionEngine engine;
  private final SessionTimerScheduler timerScheduler;

  public SessionService(
      QuizSessionRepository sessionRepository,
      QuizRepository quizRepository,
      QuestionRepository questionRepository,
      ParticipantRepository participantRepository,
      OwnershipService ownershipService,
      SessionSnapshotService snapshotService,
      SessionLiveStateService liveStateService,
      SessionCodeService sessionCodeService,
      SessionEngine engine,
      SessionTimerScheduler timerScheduler) {
    this.sessionRepository = sessionRepository;
    this.quizRepository = quizRepository;
    this.questionRepository = questionRepository;
    this.participantRepository = participantRepository;
    this.ownershipService = ownershipService;
    this.snapshotService = snapshotService;
    this.liveStateService = liveStateService;
    this.sessionCodeService = sessionCodeService;
    this.engine = engine;
    this.timerScheduler = timerScheduler;
  }

  // ─── Create Session ────────────────────────────────────────────────────────────

  @Transactional
  public SessionResponse createSession(CreateSessionRequest request, Long userId) {
    ownershipService.requireQuizOwner(request.quizId(), userId);

    Quiz quiz =
        quizRepository
            .findByIdWithQuestions(request.quizId())
            .orElseThrow(() -> AppException.notFound("Quiz not found"));
    if (quiz.getQuestions().isEmpty()) {
      throw AppException.badRequest("Quiz must have at least one question");
    }

    QuizSnapshot snapshot = buildSnapshot(quiz);
    String snapshotJson = snapshotService.serialize(snapshot);

    // Generate join code with atomic Redis reservation (fixes TOCTOU race)
    String joinCode = sessionCodeService.generateJoinCode();

    QuizSession session =
        QuizSession.builder()
            .quiz(quiz)
            .joinCode(joinCode)
            .status(SessionStatus.LOBBY)
            .snapshot(snapshotJson)
            .build();
    session = sessionRepository.save(session);

    String sid = session.getId().toString();
    // Pipeline overwrites the "reserving" placeholder with actual session data
    liveStateService.initSessionKeys(sid, joinCode, snapshotJson);

    return toResponse(session);
  }

  // ─── Start Session ─────────────────────────────────────────────────────────────

  @Transactional
  public void startSession(Long sessionId, Long userId) {
    QuizSession session = ownershipService.requireSessionOwner(sessionId, userId);
    if (session.getStatus() != SessionStatus.LOBBY) {
      throw AppException.conflict("Session is not in LOBBY state");
    }

    QuizSnapshot snapshot = snapshotService.loadSnapshot(sessionId.toString());
    QuizSnapshot.QuestionSnapshot first =
        snapshot.questions().stream()
            .min(Comparator.comparingInt(QuizSnapshot.QuestionSnapshot::orderIndex))
            .orElseThrow(() -> AppException.badRequest("No questions in snapshot"));

    session.setStatus(SessionStatus.ACTIVE);
    session.setStartedAt(OffsetDateTime.now());
    session.setCurrentQuestion(questionRepository.getReferenceById(first.id()));
    sessionRepository.save(session);

    String sid = sessionId.toString();
    liveStateService.activateSession(sid, first.id());
    liveStateService.initQuestionCounts(sid, first);
    engine.broadcastQuestionStart(sessionId, first, snapshot);
    engine.scheduleQuestionTimer(sessionId, first.id(), first.timeLimitSeconds());
  }

  // ─── Advance / End (delegate to engine — cross-bean call, @Transactional works)

  public void advanceSession(Long sessionId, Long userId) {
    ownershipService.requireSessionOwner(sessionId, userId);
    String sid = sessionId.toString();
    timerScheduler.cancelQuestionTimer(sessionId);
    liveStateService.clearTimer(sid);
    liveStateService.incrementQuestionSequence(sid);
    engine.advanceSessionInternal(sessionId);
  }

  public void endSessionByOrganiser(Long sessionId, Long userId) {
    ownershipService.requireSessionOwner(sessionId, userId);
    String sid = sessionId.toString();
    timerScheduler.cancelQuestionTimer(sessionId);
    liveStateService.clearTimer(sid);
    liveStateService.incrementQuestionSequence(sid);
    engine.doEndSession(sessionId);
  }

  // ─── Status / Lobby ────────────────────────────────────────────────────────────

  public SessionStatus getSessionStatus(Long sessionId, Long userId) {
    QuizSession session = ownershipService.requireSessionOwner(sessionId, userId);
    return session.getStatus();
  }

  public LobbyStateResponse getLobbyState(Long sessionId, Long userId) {
    QuizSession session = ownershipService.requireSessionOwner(sessionId, userId);
    String sid = sessionId.toString();
    long participantCount = liveStateService.getParticipantCount(sid);
    if (participantCount == 0) {
      participantCount = participantRepository.countBySessionId(sessionId);
    }
    return new LobbyStateResponse(
        session.getStatus().name(), participantCount, session.getJoinCode());
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private QuizSnapshot buildSnapshot(Quiz quiz) {
    List<QuizSnapshot.QuestionSnapshot> questions =
        quiz.getQuestions().stream()
            .map(
                q -> {
                  List<QuizSnapshot.OptionSnapshot> options =
                      q.getOptions().stream()
                          .map(
                              o ->
                                  new QuizSnapshot.OptionSnapshot(
                                      o.getId(),
                                      o.getText(),
                                      o.getPointValue(),
                                      o.getOrderIndex()))
                          .toList();
                  return new QuizSnapshot.QuestionSnapshot(
                      q.getId(),
                      q.getText(),
                      q.getQuestionType().name(),
                      q.getOrderIndex(),
                      q.getTimeLimitSeconds(),
                      q.getPassage() != null ? q.getPassage().getId() : null,
                      resolveEffectiveDisplayMode(quiz, q),
                      options);
                })
            .toList();
    List<QuizSnapshot.PassageSnapshot> passages =
        quiz.getPassages().stream()
            .map(this::toPassageSnapshot)
            .toList();
    return new QuizSnapshot(quiz.getId(), quiz.getTitle(), questions, passages);
  }

  private QuizSnapshot.PassageSnapshot toPassageSnapshot(Passage passage) {
    List<Long> subQuestionIds = passage.getSubQuestions().stream().map(q -> q.getId()).toList();
    return new QuizSnapshot.PassageSnapshot(
        passage.getId(),
        passage.getText(),
        passage.getOrderIndex(),
        passage.getTimerMode().name(),
        passage.getTimeLimitSeconds(),
        subQuestionIds);
  }

  private String resolveEffectiveDisplayMode(Quiz quiz, dev.hishaam.hermes.entity.Question question) {
    return (question.getDisplayModeOverride() != null
            ? question.getDisplayModeOverride()
            : quiz.getDisplayMode())
        .name();
  }

  private SessionResponse toResponse(QuizSession session) {
    return new SessionResponse(
        session.getId(),
        session.getQuiz().getId(),
        session.getJoinCode(),
        session.getStatus().name(),
        session.getStartedAt(),
        session.getEndedAt(),
        session.getCreatedAt());
  }
}
