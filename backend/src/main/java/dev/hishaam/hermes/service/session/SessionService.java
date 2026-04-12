package dev.hishaam.hermes.service.session;

import dev.hishaam.hermes.dto.session.*;
import dev.hishaam.hermes.entity.Passage;
import dev.hishaam.hermes.entity.Question;
import dev.hishaam.hermes.entity.Quiz;
import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.entity.SessionStatus;
import dev.hishaam.hermes.entity.enums.DisplayMode;
import dev.hishaam.hermes.entity.enums.PassageTimerMode;
import dev.hishaam.hermes.entity.enums.QuestionLifecycleState;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.ParticipantRepository;
import dev.hishaam.hermes.repository.QuizRepository;
import dev.hishaam.hermes.repository.QuizSessionRepository;
import dev.hishaam.hermes.repository.redis.SessionAnswerStatsRedisRepository;
import dev.hishaam.hermes.repository.redis.SessionLeaderboardRedisRepository;
import dev.hishaam.hermes.repository.redis.SessionStateRedisRepository;
import dev.hishaam.hermes.repository.redis.SessionTimerRedisRepository;
import dev.hishaam.hermes.service.*;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SessionService {

  private final QuizSessionRepository sessionRepository;
  private final QuizRepository quizRepository;
  private final ParticipantRepository participantRepository;
  private final OwnershipService ownershipService;
  private final SessionSnapshotService snapshotService;
  private final SessionStateRedisRepository stateStore;
  private final SessionTimerRedisRepository timerStore;
  private final SessionAnswerStatsRedisRepository answerStatsStore;
  private final SessionLeaderboardRedisRepository leaderboardStore;
  private final SessionRejoinContextService rejoinContextService;
  private final SessionJoinCodeService joinCodeService;
  private final SessionEngine engine;
  private final SessionTimerOrchestrator timerOrchestrator;
  private final SessionEventPublisher eventPublisher;
  private final SessionTimerScheduler timerScheduler;
  private final ScoringCorrectionService scoringCorrectionService;

  public SessionService(
      QuizSessionRepository sessionRepository,
      QuizRepository quizRepository,
      ParticipantRepository participantRepository,
      OwnershipService ownershipService,
      SessionSnapshotService snapshotService,
      SessionStateRedisRepository stateStore,
      SessionTimerRedisRepository timerStore,
      SessionAnswerStatsRedisRepository answerStatsStore,
      SessionLeaderboardRedisRepository leaderboardStore,
      SessionRejoinContextService rejoinContextService,
      SessionJoinCodeService joinCodeService,
      SessionEngine engine,
      SessionTimerOrchestrator timerOrchestrator,
      SessionEventPublisher eventPublisher,
      SessionTimerScheduler timerScheduler,
      ScoringCorrectionService scoringCorrectionService) {
    this.sessionRepository = sessionRepository;
    this.quizRepository = quizRepository;
    this.participantRepository = participantRepository;
    this.ownershipService = ownershipService;
    this.snapshotService = snapshotService;
    this.stateStore = stateStore;
    this.timerStore = timerStore;
    this.answerStatsStore = answerStatsStore;
    this.leaderboardStore = leaderboardStore;
    this.rejoinContextService = rejoinContextService;
    this.joinCodeService = joinCodeService;
    this.engine = engine;
    this.timerOrchestrator = timerOrchestrator;
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
    String joinCode = joinCodeService.generateJoinCode();

    QuizSession session =
        QuizSession.builder()
            .quiz(quiz)
            .joinCode(joinCode)
            .status(SessionStatus.LOBBY)
            .snapshot(snapshotJson)
            .build();
    session = sessionRepository.save(session);

    // Pipeline overwrites the "reserving" placeholder with actual session data
    stateStore.initSessionKeys(session.getId(), joinCode, snapshotJson);

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
    session.setCurrentQuestionId(first.id());
    sessionRepository.save(session);

    // Check if the first question belongs to an ENTIRE_PASSAGE passage
    if (first.passageId() != null) {
      QuizSnapshot.PassageSnapshot passage = snapshot.findPassage(first.passageId());
      if (passage != null && passage.timerMode() == PassageTimerMode.ENTIRE_PASSAGE) {
        // activateSession sets ACTIVE status; clear current_question so advanceSessionInternal
        // treats it as "no current question" and finds the first question (min orderIndex).
        stateStore.activateSession(sessionId, first.id());
        stateStore.clearCurrentQuestion(sessionId);
        engine.advanceSessionInternal(sessionId);
        return;
      }
    }

    stateStore.activateSession(sessionId, first.id());
    answerStatsStore.initQuestionCounts(sessionId, first);
    stateStore.setQuestionState(sessionId, QuestionLifecycleState.DISPLAYED.name());
    eventPublisher.publishQuestionDisplayed(sessionId, first, snapshot);
    // Timer is NOT started — host will call /start-timer
  }

  // ─── Start Timer (host command to begin countdown) ────────────────────────────

  public void startTimer(Long sessionId, Long userId) {
    ownershipService.requireSessionOwner(sessionId, userId);
    timerOrchestrator.startTimerInternal(sessionId);
  }

  public void endTimerEarly(Long sessionId, Long userId) {
    ownershipService.requireSessionOwner(sessionId, userId);
    String questionState = stateStore.getQuestionState(sessionId);
    if (!QuestionLifecycleState.TIMED.name().equals(questionState)) {
      throw AppException.conflict("Timer can only be ended while question is in TIMED state");
    }

    timerScheduler.cancelQuestionTimer(sessionId);
    timerStore.clearTimer(sessionId);
    timerOrchestrator.onTimerExpired(sessionId);
  }

  // ─── Advance / End (delegate to engine — cross-bean call, @Transactional works)

  public void advanceSession(Long sessionId, Long userId) {
    ownershipService.requireSessionOwner(sessionId, userId);
    String questionState = stateStore.getQuestionState(sessionId);
    if (!QuestionLifecycleState.REVIEWING.name().equals(questionState)) {
      throw AppException.conflict("Cannot advance: current question is not in REVIEWING state");
    }
    timerStore.incrementQuestionSequence(sessionId);
    engine.advanceSessionInternal(sessionId);
  }

  public void endSessionByOrganiser(Long sessionId, Long userId) {
    ownershipService.requireSessionOwner(sessionId, userId);
    timerScheduler.cancelQuestionTimer(sessionId);
    timerStore.clearTimer(sessionId);
    timerStore.incrementQuestionSequence(sessionId);
    engine.doEndSession(sessionId);
  }

  @Transactional
  public void abandonSession(Long sessionId, Long userId) {
    ownershipService.requireSessionOwner(sessionId, userId);
    timerScheduler.cancelQuestionTimer(sessionId);
    timerStore.clearTimer(sessionId);

    // Attempt best-effort cleanup of Redis keys
    try {
      QuizSnapshot snapshot = snapshotService.loadSnapshot(sessionId.toString());
      stateStore.cleanupSessionKeys(sessionId, snapshot, null);
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
    long participantCount = stateStore.getParticipantCount(sessionId);
    if (participantCount == 0) {
      participantCount = participantRepository.countBySessionId(sessionId);
    }
    return new LobbyStateResponse(
        session.getStatus().name(), participantCount, session.getJoinCode());
  }

  public HostSessionSyncResponse getHostSyncState(Long sessionId, Long userId) {
    QuizSession session = ownershipService.requireSessionOwner(sessionId, userId);
    QuizSnapshot snapshot =
        session.getSnapshot() != null && !session.getSnapshot().isBlank()
            ? snapshotService.deserialize(session.getSnapshot())
            : snapshotService.loadSnapshot(sessionId.toString());

    SessionRejoinContextService.SessionRejoinContext ctx =
        rejoinContextService.buildRejoinContext(sessionId);
    int participantCount = ctx.participantCount();
    if (participantCount == 0) {
      participantCount = (int) participantRepository.countBySessionId(sessionId);
    }
    final int totalParticipants = participantCount;

    HostSessionSyncResponse.CurrentQuestion currentQuestion = null;
    HostSessionSyncResponse.CurrentPassage currentPassage = null;
    Map<Long, HostSessionSyncResponse.QuestionStats> questionStatsById = new LinkedHashMap<>();

    if (session.getStatus() == SessionStatus.ACTIVE && ctx.currentQuestionId() != null) {
      if (ctx.currentPassageId() != null) {
        QuizSnapshot.PassageSnapshot passage = snapshot.findPassage(ctx.currentPassageId());
        if (passage != null) {
          List<HostSessionSyncResponse.PassageQuestionInfo> subQuestions =
              passage.subQuestionIds().stream()
                  .map(snapshot::findQuestion)
                  .filter(Objects::nonNull)
                  .sorted(Comparator.comparingInt(QuizSnapshot.QuestionSnapshot::orderIndex))
                  .map(
                      q -> {
                        questionStatsById.put(
                            q.id(),
                            buildQuestionStats(
                                sessionId, q, totalParticipants, ctx.questionLifecycle()));
                        return buildPassageQuestionInfo(q, snapshot);
                      })
                  .toList();

          currentPassage =
              new HostSessionSyncResponse.CurrentPassage(
                  passage.id(),
                  passage.text(),
                  passage.timerMode().name(),
                  snapshot.questionPosition(
                      subQuestions.isEmpty() ? ctx.currentQuestionId() : subQuestions.get(0).id()),
                  snapshot.questions().size(),
                  passage.timeLimitSeconds(),
                  subQuestions.isEmpty()
                      ? DisplayMode.LIVE.name()
                      : subQuestions.get(0).effectiveDisplayMode(),
                  subQuestions);
        }
      } else {
        QuizSnapshot.QuestionSnapshot question = snapshot.findQuestion(ctx.currentQuestionId());
        if (question != null) {
          currentQuestion = buildCurrentQuestion(question, snapshot);
          questionStatsById.put(
              question.id(),
              buildQuestionStats(sessionId, question, totalParticipants, ctx.questionLifecycle()));
        }
      }
    }

    return new HostSessionSyncResponse(
        sessionId,
        session.getStatus().name(),
        ctx.questionLifecycle(),
        session.getJoinCode(),
        totalParticipants,
        currentQuestion,
        currentPassage,
        questionStatsById,
        session.getStatus() == SessionStatus.ACTIVE
            ? leaderboardStore.buildLeaderboard(sessionId)
            : List.of(),
        ctx.timeLeftSeconds());
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

  private HostSessionSyncResponse.CurrentQuestion buildCurrentQuestion(
      QuizSnapshot.QuestionSnapshot question, QuizSnapshot snapshot) {
    HostSessionSyncResponse.PassageInfo passageInfo =
        question.passageId() == null
            ? null
            : snapshot.findPassage(question.passageId()) == null
                ? null
                : new HostSessionSyncResponse.PassageInfo(
                    question.passageId(), snapshot.findPassage(question.passageId()).text());

    return new HostSessionSyncResponse.CurrentQuestion(
        question.id(),
        question.text(),
        question.questionType().name(),
        snapshot.questionPosition(question.id()),
        snapshot.questions().size(),
        question.timeLimitSeconds(),
        question.effectiveDisplayMode().name(),
        passageInfo,
        question.options().stream()
            .map(o -> new HostSessionSyncResponse.OptionInfo(o.id(), o.text(), o.orderIndex()))
            .toList());
  }

  private HostSessionSyncResponse.PassageQuestionInfo buildPassageQuestionInfo(
      QuizSnapshot.QuestionSnapshot question, QuizSnapshot snapshot) {
    HostSessionSyncResponse.PassageInfo passageInfo =
        question.passageId() == null
            ? null
            : snapshot.findPassage(question.passageId()) == null
                ? null
                : new HostSessionSyncResponse.PassageInfo(
                    question.passageId(), snapshot.findPassage(question.passageId()).text());

    return new HostSessionSyncResponse.PassageQuestionInfo(
        question.id(),
        question.text(),
        question.questionType().name(),
        snapshot.questionPosition(question.id()),
        snapshot.questions().size(),
        question.timeLimitSeconds(),
        question.effectiveDisplayMode().name(),
        passageInfo,
        question.options().stream()
            .map(o -> new HostSessionSyncResponse.OptionInfo(o.id(), o.text(), o.orderIndex()))
            .toList());
  }

  private HostSessionSyncResponse.QuestionStats buildQuestionStats(
      Long sessionId,
      QuizSnapshot.QuestionSnapshot question,
      int participantCount,
      String questionLifecycle) {
    Map<Long, Integer> optionPoints = new LinkedHashMap<>();
    question.options().forEach(option -> optionPoints.put(option.id(), option.pointValue()));
    List<Long> correctOptionIds =
        question.options().stream()
            .filter(option -> option.pointValue() > 0)
            .map(QuizSnapshot.OptionSnapshot::id)
            .toList();
    boolean reviewed = QuestionLifecycleState.REVIEWING.name().equals(questionLifecycle);
    boolean revealed =
        reviewed
            && (question.effectiveDisplayMode() == DisplayMode.BLIND
                || question.effectiveDisplayMode() == DisplayMode.CODE_DISPLAY);

    return new HostSessionSyncResponse.QuestionStats(
        answerStatsStore.getQuestionCounts(sessionId, question.id()),
        answerStatsStore.getTotalAnswered(sessionId, question.id()),
        answerStatsStore.getTotalLockedIn(sessionId, question.id()),
        participantCount,
        correctOptionIds,
        optionPoints,
        revealed,
        reviewed);
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
