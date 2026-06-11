package dev.hishaam.hermes.service.session;

import dev.hishaam.hermes.dto.session.*;
import dev.hishaam.hermes.entity.Quiz;
import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.entity.SessionStatus;
import dev.hishaam.hermes.entity.enums.DisplayMode;
import dev.hishaam.hermes.entity.enums.PassageTimerMode;
import dev.hishaam.hermes.entity.enums.QuestionLifecycleState;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.ParticipantAnswerRepository;
import dev.hishaam.hermes.repository.ParticipantRepository;
import dev.hishaam.hermes.repository.QuizRepository;
import dev.hishaam.hermes.repository.QuizSessionRepository;
import dev.hishaam.hermes.repository.redis.SessionScoringRedisRepository;
import dev.hishaam.hermes.repository.redis.SessionStateRedisRepository;
import dev.hishaam.hermes.service.*;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Organizer-facing session API: authorizes every call, validates lifecycle preconditions, and
 * delegates state transitions to {@link SessionEngine}.
 */
@Service
public class SessionService {

  private static final Logger log = LoggerFactory.getLogger(SessionService.class);

  private static final SecureRandom SECURE_RANDOM = new SecureRandom();
  private static final String JOIN_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  private final QuizSessionRepository sessionRepository;
  private final QuizRepository quizRepository;
  private final ParticipantAnswerRepository participantAnswerRepository;
  private final ParticipantRepository participantRepository;
  private final OwnershipService ownershipService;
  private final SessionSnapshotService snapshotService;
  private final SessionStateRedisRepository stateStore;
  private final SessionScoringRedisRepository scoringStore;
  private final SessionEngine engine;
  private final SessionEventPublisher eventPublisher;
  private final SessionTimerScheduler timerScheduler;
  private final GradingService gradingService;

  public SessionService(
      QuizSessionRepository sessionRepository,
      QuizRepository quizRepository,
      ParticipantAnswerRepository participantAnswerRepository,
      ParticipantRepository participantRepository,
      OwnershipService ownershipService,
      SessionSnapshotService snapshotService,
      SessionStateRedisRepository stateStore,
      SessionScoringRedisRepository scoringStore,
      SessionEngine engine,
      SessionEventPublisher eventPublisher,
      SessionTimerScheduler timerScheduler,
      GradingService gradingService) {
    this.sessionRepository = sessionRepository;
    this.quizRepository = quizRepository;
    this.participantAnswerRepository = participantAnswerRepository;
    this.participantRepository = participantRepository;
    this.ownershipService = ownershipService;
    this.snapshotService = snapshotService;
    this.stateStore = stateStore;
    this.scoringStore = scoringStore;
    this.engine = engine;
    this.eventPublisher = eventPublisher;
    this.timerScheduler = timerScheduler;
    this.gradingService = gradingService;
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

    QuizSnapshot snapshot = snapshotService.buildSnapshot(quiz);
    String snapshotJson = snapshotService.serialize(snapshot);

    // Generate join code with atomic Redis reservation (fixes TOCTOU race)
    String joinCode = generateJoinCode();

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
    scoringStore.initQuestionCounts(sessionId, first);
    stateStore.setQuestionState(sessionId, QuestionLifecycleState.DISPLAYED.name());
    eventPublisher.publishQuestionDisplayed(sessionId, first, snapshot);
    // Timer is NOT started — host will call /start-timer
  }

  // ─── Timer commands (host) ─────────────────────────────────────────────────────

  /** Authorises ownership and delegates to {@link SessionEngine#startTimerInternal}. */
  public void startTimer(Long sessionId, Long userId) {
    ownershipService.requireSessionOwner(sessionId, userId);
    engine.startTimerInternal(sessionId);
  }

  /**
   * Cancels the Quartz job and immediately invokes {@link SessionEngine#onTimerExpired} as if the
   * timer had elapsed naturally. Only valid when the question is in the TIMED state.
   */
  public void endTimerEarly(Long sessionId, Long userId) {
    ownershipService.requireSessionOwner(sessionId, userId);
    String questionState = stateStore.getQuestionState(sessionId);
    if (!QuestionLifecycleState.TIMED.name().equals(questionState)) {
      throw AppException.conflict("Timer can only be ended while question is in TIMED state");
    }

    timerScheduler.cancelQuestionTimer(sessionId);
    stateStore.clearTimer(sessionId);
    engine.onTimerExpired(sessionId);
  }

  // ─── Advance / End (delegate to engine — cross-bean call, @Transactional works)

  public void advanceSession(Long sessionId, Long userId) {
    ownershipService.requireSessionOwner(sessionId, userId);
    String questionState = stateStore.getQuestionState(sessionId);
    if (!QuestionLifecycleState.REVIEWING.name().equals(questionState)) {
      throw AppException.conflict("Cannot advance: current question is not in REVIEWING state");
    }
    stateStore.incrementQuestionSequence(sessionId);
    engine.advanceSessionInternal(sessionId);
  }

  public void endSessionByOrganiser(Long sessionId, Long userId) {
    ownershipService.requireSessionOwner(sessionId, userId);
    timerScheduler.cancelQuestionTimer(sessionId);
    stateStore.clearTimer(sessionId);
    stateStore.incrementQuestionSequence(sessionId);
    engine.doEndSession(sessionId);
  }

  /**
   * Hard-deletes a session and all its participants and answers, typically used to discard a LOBBY
   * session the organizer never started. Performs best-effort Redis cleanup — failure is logged but
   * does not abort the transaction.
   */
  @Transactional
  public void abandonSession(Long sessionId, Long userId) {
    ownershipService.requireSessionOwner(sessionId, userId);
    timerScheduler.cancelQuestionTimer(sessionId);
    stateStore.clearTimer(sessionId);

    // Attempt best-effort cleanup of Redis keys
    try {
      QuizSnapshot snapshot = snapshotService.loadSnapshot(sessionId.toString());
      stateStore.cleanupSessionKeys(sessionId, null);
      scoringStore.cleanupScoringKeys(sessionId, snapshot);
    } catch (Exception e) {
      log.warn("Redis cleanup failed for abandoned session {}", sessionId, e);
    }

    participantAnswerRepository.deleteBySessionIdIn(List.of(sessionId));
    participantRepository.deleteBySessionIdIn(List.of(sessionId));
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

  /**
   * Returns a complete snapshot of the live session for the host reconnect flow: current
   * question/passage, per-question answer stats, the active leaderboard, and time left on the
   * timer. Combines Redis state (fast path) with PostgreSQL counts when Redis is cold.
   */
  public HostSessionSyncResponse getHostSyncState(Long sessionId, Long userId) {
    QuizSession session = ownershipService.requireSessionOwner(sessionId, userId);
    QuizSnapshot snapshot = snapshotService.loadSnapshot(sessionId.toString());

    SessionStateRedisRepository.RejoinContext ctx = stateStore.readRejoinContext(sessionId);
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
                      subQuestions.isEmpty()
                          ? ctx.currentQuestionId()
                          : subQuestions.getFirst().id()),
                  snapshot.questions().size(),
                  passage.timeLimitSeconds(),
                  subQuestions.isEmpty()
                      ? DisplayMode.LIVE.name()
                      : subQuestions.getFirst().effectiveDisplayMode(),
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
            ? scoringStore.buildLeaderboard(sessionId)
            : List.of(),
        ctx.timeLeftSeconds());
  }

  // ─── Answer correction ────────────────────────────────────────────────────────

  public void correctScoring(
      Long sessionId, Long questionId, ScoringCorrectionRequest request, Long userId) {
    gradingService.correctScoring(sessionId, questionId, request, userId);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private String generateJoinCode() {
    for (int attempt = 0; attempt < 10; attempt++) {
      StringBuilder code = new StringBuilder(6);
      for (int i = 0; i < 6; i++) {
        code.append(JOIN_CODE_CHARS.charAt(SECURE_RANDOM.nextInt(JOIN_CODE_CHARS.length())));
      }
      String candidate = code.toString();
      if (stateStore.tryReserveJoinCode(candidate)) {
        return candidate;
      }
    }
    throw AppException.internalError("Failed to generate unique join code");
  }

  private HostSessionSyncResponse.CurrentQuestion buildCurrentQuestion(
      QuizSnapshot.QuestionSnapshot question, QuizSnapshot snapshot) {
    return new HostSessionSyncResponse.CurrentQuestion(
        question.id(),
        question.text(),
        question.questionType().name(),
        snapshot.questionPosition(question.id()),
        snapshot.questions().size(),
        question.timeLimitSeconds(),
        question.effectiveDisplayMode().name(),
        buildPassageInfo(question, snapshot),
        buildOptionInfos(question));
  }

  private HostSessionSyncResponse.PassageQuestionInfo buildPassageQuestionInfo(
      QuizSnapshot.QuestionSnapshot question, QuizSnapshot snapshot) {
    return new HostSessionSyncResponse.PassageQuestionInfo(
        question.id(),
        question.text(),
        question.questionType().name(),
        snapshot.questionPosition(question.id()),
        snapshot.questions().size(),
        question.timeLimitSeconds(),
        question.effectiveDisplayMode().name(),
        buildPassageInfo(question, snapshot),
        buildOptionInfos(question));
  }

  private HostSessionSyncResponse.PassageInfo buildPassageInfo(
      QuizSnapshot.QuestionSnapshot question, QuizSnapshot snapshot) {
    if (question.passageId() == null) return null;
    var passage = snapshot.findPassage(question.passageId());
    return passage == null
        ? null
        : new HostSessionSyncResponse.PassageInfo(passage.id(), passage.text());
  }

  private List<HostSessionSyncResponse.OptionInfo> buildOptionInfos(
      QuizSnapshot.QuestionSnapshot question) {
    return question.options().stream()
        .map(o -> new HostSessionSyncResponse.OptionInfo(o.id(), o.text(), o.orderIndex()))
        .toList();
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
        scoringStore.getQuestionCounts(sessionId, question.id()),
        scoringStore.getTotalAnswered(sessionId, question.id()),
        scoringStore.getTotalLockedIn(sessionId, question.id()),
        participantCount,
        correctOptionIds,
        optionPoints,
        revealed,
        reviewed);
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
