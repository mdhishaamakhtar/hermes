package dev.hishaam.hermes.service.session;

import dev.hishaam.hermes.dto.session.*;
import dev.hishaam.hermes.entity.Quiz;
import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.entity.enums.QuestionLifecycleState;
import dev.hishaam.hermes.entity.enums.SessionStatus;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.ParticipantAnswerRepository;
import dev.hishaam.hermes.repository.ParticipantRepository;
import dev.hishaam.hermes.repository.QuizRepository;
import dev.hishaam.hermes.repository.QuizSessionRepository;
import dev.hishaam.hermes.repository.redis.SessionScoringRedisRepository;
import dev.hishaam.hermes.repository.redis.SessionStateRedisRepository;
import dev.hishaam.hermes.service.LeaderboardService;
import dev.hishaam.hermes.service.OwnershipService;
import java.security.SecureRandom;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Organizer-facing session API: authorizes every call, validates lifecycle preconditions, and
 * delegates state transitions to {@link SessionEngine}. Each transition runs under the session's
 * {@link SessionTransitions} lock, so the precondition it checks still holds when it acts.
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
  private final SessionTimerScheduler timerScheduler;
  private final LeaderboardService leaderboardService;
  private final SessionTransitions transitions;

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
      SessionTimerScheduler timerScheduler,
      LeaderboardService leaderboardService,
      SessionTransitions transitions) {
    this.sessionRepository = sessionRepository;
    this.quizRepository = quizRepository;
    this.participantAnswerRepository = participantAnswerRepository;
    this.participantRepository = participantRepository;
    this.ownershipService = ownershipService;
    this.snapshotService = snapshotService;
    this.stateStore = stateStore;
    this.scoringStore = scoringStore;
    this.engine = engine;
    this.timerScheduler = timerScheduler;
    this.leaderboardService = leaderboardService;
    this.transitions = transitions;
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

  public void startSession(Long sessionId, Long userId) {
    ownershipService.requireSessionOwner(sessionId, userId);
    transitions.run(sessionId, () -> engine.startSessionInternal(sessionId));
  }

  // ─── Timer commands (host) ─────────────────────────────────────────────────────

  /** Authorises ownership and delegates to {@link SessionEngine#startTimerInternal}. */
  public void startTimer(Long sessionId, Long userId) {
    ownershipService.requireSessionOwner(sessionId, userId);
    transitions.run(sessionId, () -> engine.startTimerInternal(sessionId));
  }

  /**
   * Cancels the Quartz job and immediately invokes {@link SessionEngine#onTimerExpired} as if the
   * timer had elapsed naturally. Only valid when the question is in the TIMED state.
   */
  public void endTimerEarly(Long sessionId, Long userId) {
    ownershipService.requireSessionOwner(sessionId, userId);
    transitions.run(
        sessionId,
        () -> {
          if (stateStore.getQuestionState(sessionId) != QuestionLifecycleState.TIMED) {
            throw AppException.conflict("Timer can only be ended while question is in TIMED state");
          }

          timerScheduler.cancelQuestionTimer(sessionId);
          stateStore.clearTimer(sessionId);
          engine.onTimerExpired(sessionId);
        });
  }

  // ─── Advance / End (delegate to engine — cross-bean call, @Transactional works)

  public void advanceSession(Long sessionId, Long userId) {
    ownershipService.requireSessionOwner(sessionId, userId);
    transitions.run(
        sessionId,
        () -> {
          if (stateStore.getQuestionState(sessionId) != QuestionLifecycleState.REVIEWING) {
            throw AppException.conflict(
                "Cannot advance: current question is not in REVIEWING state");
          }
          stateStore.incrementQuestionSequence(sessionId);
          engine.advanceSessionInternal(sessionId);
        });
  }

  public void endSessionByOrganiser(Long sessionId, Long userId) {
    ownershipService.requireSessionOwner(sessionId, userId);
    transitions.run(
        sessionId,
        () -> {
          timerScheduler.cancelQuestionTimer(sessionId);
          stateStore.clearTimer(sessionId);
          stateStore.incrementQuestionSequence(sessionId);
          engine.doEndSession(sessionId);
        });
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
      QuizSnapshot snapshot = snapshotService.loadSnapshot(sessionId);
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
   * question/passage, per-question answer stats, the standings, and time left on the timer. The
   * live pointers come from Redis; the participant count falls back to PostgreSQL when Redis is
   * cold.
   */
  public HostSessionSyncResponse getHostSyncState(Long sessionId, Long userId) {
    QuizSession session = ownershipService.requireSessionOwner(sessionId, userId);
    QuizSnapshot snapshot = snapshotService.loadSnapshot(sessionId);
    boolean active = session.getStatus() == SessionStatus.ACTIVE;

    SessionStateRedisRepository.RejoinContext ctx = stateStore.readRejoinContext(sessionId);
    int participantCount =
        ctx.participantCount() != 0
            ? ctx.participantCount()
            : (int) participantRepository.countBySessionId(sessionId);

    HostSessionSyncResponse.Question currentQuestion = null;
    HostSessionSyncResponse.CurrentPassage currentPassage = null;
    List<QuizSnapshot.QuestionSnapshot> onScreen = List.of();

    if (active && ctx.currentPassageId() != null) {
      QuizSnapshot.PassageSnapshot passage = snapshot.requirePassage(ctx.currentPassageId());
      onScreen = snapshot.subQuestionsOf(passage);
      currentPassage =
          new HostSessionSyncResponse.CurrentPassage(
              passage.id(),
              passage.text(),
              passage.timerMode().name(),
              snapshot.questionPosition(onScreen.getFirst().id()),
              snapshot.questions().size(),
              passage.timeLimitSeconds(),
              onScreen.getFirst().effectiveDisplayMode().name(),
              onScreen.stream().map(q -> toHostQuestion(q, snapshot)).toList());
    } else if (active && ctx.currentQuestionId() != null) {
      QuizSnapshot.QuestionSnapshot question = snapshot.requireQuestion(ctx.currentQuestionId());
      onScreen = List.of(question);
      currentQuestion = toHostQuestion(question, snapshot);
    }

    Map<Long, QuestionStats> questionStatsById = new LinkedHashMap<>();
    for (QuizSnapshot.QuestionSnapshot question : onScreen) {
      questionStatsById.put(
          question.id(),
          QuestionStats.forHost(
              question,
              scoringStore.answerStats(sessionId, question.id(), participantCount),
              ctx.questionLifecycle()));
    }

    return new HostSessionSyncResponse(
        sessionId,
        session.getStatus().name(),
        ctx.questionLifecycle(),
        session.getJoinCode(),
        participantCount,
        currentQuestion,
        currentPassage,
        questionStatsById,
        active ? leaderboardService.standings(sessionId) : List.of(),
        ctx.timeLeftSeconds());
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

  private HostSessionSyncResponse.Question toHostQuestion(
      QuizSnapshot.QuestionSnapshot question, QuizSnapshot snapshot) {
    HostSessionSyncResponse.PassageInfo passageInfo = null;
    if (question.passageId() != null) {
      QuizSnapshot.PassageSnapshot passage = snapshot.requirePassage(question.passageId());
      passageInfo = new HostSessionSyncResponse.PassageInfo(passage.id(), passage.text());
    }
    return new HostSessionSyncResponse.Question(
        question.id(),
        question.text(),
        question.questionType().name(),
        snapshot.questionPosition(question.id()),
        snapshot.questions().size(),
        question.timeLimitSeconds(),
        question.effectiveDisplayMode().name(),
        passageInfo,
        OptionInfo.of(question));
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
