package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.*;
import dev.hishaam.hermes.entity.Passage;
import dev.hishaam.hermes.entity.Question;
import dev.hishaam.hermes.entity.Quiz;
import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.entity.SessionStatus;
import dev.hishaam.hermes.entity.enums.DisplayMode;
import dev.hishaam.hermes.entity.enums.QuestionLifecycleState;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.ParticipantRepository;
import dev.hishaam.hermes.repository.QuestionRepository;
import dev.hishaam.hermes.repository.QuizRepository;
import dev.hishaam.hermes.repository.QuizSessionRepository;
import java.time.OffsetDateTime;
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
  private final SessionEventPublisher eventPublisher;
  private final SessionTimerScheduler timerScheduler;
  private final ScoringCorrectionService scoringCorrectionService;

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
      SessionEventPublisher eventPublisher,
      SessionTimerScheduler timerScheduler,
      ScoringCorrectionService scoringCorrectionService) {
    this.sessionRepository = sessionRepository;
    this.quizRepository = quizRepository;
    this.questionRepository = questionRepository;
    this.participantRepository = participantRepository;
    this.ownershipService = ownershipService;
    this.snapshotService = snapshotService;
    this.liveStateService = liveStateService;
    this.sessionCodeService = sessionCodeService;
    this.engine = engine;
    this.eventPublisher = eventPublisher;
    this.timerScheduler = timerScheduler;
    this.scoringCorrectionService = scoringCorrectionService;
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

    // Pipeline overwrites the "reserving" placeholder with actual session data
    liveStateService.initSessionKeys(session.getId(), joinCode, snapshotJson);

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
    QuizSnapshot.QuestionSnapshot first = snapshot.findNextQuestion(null);
    if (first == null) {
      throw AppException.badRequest("No questions in snapshot");
    }

    session.setStatus(SessionStatus.ACTIVE);
    session.setStartedAt(OffsetDateTime.now());
    session.setCurrentQuestion(questionRepository.getReferenceById(first.id()));
    sessionRepository.save(session);

    // Check if the first question belongs to an ENTIRE_PASSAGE passage
    if (first.passageId() != null) {
      QuizSnapshot.PassageSnapshot passage = snapshot.findPassage(first.passageId());
      if (passage != null && "ENTIRE_PASSAGE".equals(passage.timerMode())) {
        // activateSession sets ACTIVE status; clear current_question so advanceSessionInternal
        // treats it as "no current question" and finds the first question (min orderIndex).
        liveStateService.activateSession(sessionId, first.id());
        liveStateService.clearCurrentQuestion(sessionId);
        engine.advanceSessionInternal(sessionId);
        return;
      }
    }

    liveStateService.activateSession(sessionId, first.id());
    liveStateService.initQuestionCounts(sessionId, first);
    liveStateService.setQuestionState(sessionId, QuestionLifecycleState.DISPLAYED.name());
    eventPublisher.publishQuestionDisplayed(sessionId, first, snapshot);
    // Timer is NOT started — host will call /start-timer
  }

  // ─── Start Timer (host command to begin countdown) ────────────────────────────

  public void startTimer(Long sessionId, Long userId) {
    ownershipService.requireSessionOwner(sessionId, userId);
    engine.startTimerInternal(sessionId);
  }

  public void endTimerEarly(Long sessionId, Long userId) {
    ownershipService.requireSessionOwner(sessionId, userId);
    String questionState = liveStateService.getQuestionState(sessionId);
    if (!QuestionLifecycleState.TIMED.name().equals(questionState)) {
      throw AppException.conflict("Timer can only be ended while question is in TIMED state");
    }

    timerScheduler.cancelQuestionTimer(sessionId);
    liveStateService.clearTimer(sessionId);
    engine.onTimerExpired(sessionId);
  }

  // ─── Advance / End (delegate to engine — cross-bean call, @Transactional works)

  public void advanceSession(Long sessionId, Long userId) {
    ownershipService.requireSessionOwner(sessionId, userId);
    String questionState = liveStateService.getQuestionState(sessionId);
    if (!QuestionLifecycleState.REVIEWING.name().equals(questionState)) {
      throw AppException.conflict("Cannot advance: current question is not in REVIEWING state");
    }
    liveStateService.incrementQuestionSequence(sessionId);
    engine.advanceSessionInternal(sessionId);
  }

  public void endSessionByOrganiser(Long sessionId, Long userId) {
    ownershipService.requireSessionOwner(sessionId, userId);
    timerScheduler.cancelQuestionTimer(sessionId);
    liveStateService.clearTimer(sessionId);
    liveStateService.incrementQuestionSequence(sessionId);
    engine.doEndSession(sessionId);
  }

  @Transactional
  public void abandonSession(Long sessionId, Long userId) {
    ownershipService.requireSessionOwner(sessionId, userId);
    timerScheduler.cancelQuestionTimer(sessionId);
    liveStateService.clearTimer(sessionId);

    // Attempt best-effort cleanup of Redis keys
    try {
      QuizSnapshot snapshot = snapshotService.loadSnapshot(sessionId.toString());
      liveStateService.cleanupSessionKeys(sessionId, snapshot, null);
    } catch (Exception e) {
      // Ignore if already gone or invalid
    }

    sessionRepository.deleteById(sessionId);
  }

  // ─── Status / Lobby ────────────────────────────────────────────────────────────

  public SessionStatus getSessionStatus(Long sessionId, Long userId) {
    QuizSession session = ownershipService.requireSessionOwner(sessionId, userId);
    return session.getStatus();
  }

  public LobbyStateResponse getLobbyState(Long sessionId, Long userId) {
    QuizSession session = ownershipService.requireSessionOwner(sessionId, userId);
    long participantCount = liveStateService.getParticipantCount(sessionId);
    if (participantCount == 0) {
      participantCount = participantRepository.countBySessionId(sessionId);
    }
    return new LobbyStateResponse(
        session.getStatus().name(), participantCount, session.getJoinCode());
  }

  // ─── Answer correction ────────────────────────────────────────────────────────

  public void correctScoring(
      Long sessionId, Long questionId, ScoringCorrectionRequest request, Long userId) {
    scoringCorrectionService.correctScoring(sessionId, questionId, request, userId);
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
                                      o.getId(), o.getText(), o.getPointValue(), o.getOrderIndex()))
                          .toList();
                  return new QuizSnapshot.QuestionSnapshot(
                      q.getId(),
                      q.getText(),
                      q.getQuestionType(),
                      q.getOrderIndex(),
                      q.getTimeLimitSeconds(),
                      q.getPassage() != null ? q.getPassage().getId() : null,
                      resolveEffectiveDisplayMode(quiz, q),
                      options,
                      null);
                })
            .toList();
    List<QuizSnapshot.PassageSnapshot> passages =
        quiz.getPassages().stream().map(this::toPassageSnapshot).toList();
    return new QuizSnapshot(quiz.getId(), quiz.getTitle(), questions, passages);
  }

  private QuizSnapshot.PassageSnapshot toPassageSnapshot(Passage passage) {
    List<Long> subQuestionIds = passage.getSubQuestions().stream().map(q -> q.getId()).toList();
    return new QuizSnapshot.PassageSnapshot(
        passage.getId(),
        passage.getText(),
        passage.getOrderIndex(),
        passage.getTimerMode(),
        passage.getTimeLimitSeconds(),
        subQuestionIds);
  }

  private DisplayMode resolveEffectiveDisplayMode(Quiz quiz, Question question) {
    return question.getDisplayModeOverride() != null
        ? question.getDisplayModeOverride()
        : quiz.getDisplayMode();
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
