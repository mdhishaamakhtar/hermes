package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.session.JoinResponse;
import dev.hishaam.hermes.dto.session.JoinSessionRequest;
import dev.hishaam.hermes.dto.session.OptionInfo;
import dev.hishaam.hermes.dto.session.QuestionStats;
import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.dto.session.RejoinRequest;
import dev.hishaam.hermes.dto.session.RejoinResponse;
import dev.hishaam.hermes.dto.session.ScoringRules;
import dev.hishaam.hermes.entity.Participant;
import dev.hishaam.hermes.entity.ParticipantAnswer;
import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.entity.enums.QuestionLifecycleState;
import dev.hishaam.hermes.entity.enums.SessionStatus;
import dev.hishaam.hermes.entity.enums.StageScene;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.ParticipantAnswerRepository;
import dev.hishaam.hermes.repository.ParticipantRepository;
import dev.hishaam.hermes.repository.QuizSessionRepository;
import dev.hishaam.hermes.repository.redis.ParticipantRejoinTokenRedisRepository;
import dev.hishaam.hermes.repository.redis.SessionScoringRedisRepository;
import dev.hishaam.hermes.repository.redis.SessionStateRedisRepository;
import dev.hishaam.hermes.service.session.SessionEventPublisher;
import dev.hishaam.hermes.service.session.SessionSnapshotService;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Manages anonymous participant join and rejoin flows. Join creates a new {@link
 * dev.hishaam.hermes.entity.Participant} row and issues a 32-character rejoin token. Rejoin
 * reconstructs the live-session view from Redis state and the quiz snapshot so a reconnecting
 * client can resume without missing events — and without learning anything it has not been told
 * yet.
 */
@Service
public class ParticipantService {

  private static final SecureRandom SECURE_RANDOM = new SecureRandom();
  private static final String REJOIN_TOKEN_CHARS =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  private final QuizSessionRepository sessionRepository;
  private final ParticipantRepository participantRepository;
  private final ParticipantAnswerRepository answerRepository;
  private final SessionSnapshotService snapshotService;
  private final SessionStateRedisRepository stateStore;
  private final SessionScoringRedisRepository scoringStore;
  private final SessionEventPublisher eventPublisher;
  private final ParticipantRejoinTokenRedisRepository rejoinTokenStore;
  private final LeaderboardService leaderboardService;

  public ParticipantService(
      QuizSessionRepository sessionRepository,
      ParticipantRepository participantRepository,
      ParticipantAnswerRepository answerRepository,
      SessionSnapshotService snapshotService,
      SessionStateRedisRepository stateStore,
      SessionScoringRedisRepository scoringStore,
      SessionEventPublisher eventPublisher,
      ParticipantRejoinTokenRedisRepository rejoinTokenStore,
      LeaderboardService leaderboardService) {
    this.sessionRepository = sessionRepository;
    this.participantRepository = participantRepository;
    this.answerRepository = answerRepository;
    this.snapshotService = snapshotService;
    this.stateStore = stateStore;
    this.scoringStore = scoringStore;
    this.eventPublisher = eventPublisher;
    this.rejoinTokenStore = rejoinTokenStore;
    this.leaderboardService = leaderboardService;
  }

  @Transactional
  public JoinResponse joinSession(JoinSessionRequest request) {
    String sessionIdStr = stateStore.getSessionIdForJoinCode(request.joinCode().toUpperCase());
    if (sessionIdStr == null) {
      throw AppException.notFound("Invalid or expired join code");
    }
    Long sessionId;
    try {
      sessionId = Long.parseLong(sessionIdStr);
    } catch (NumberFormatException e) {
      throw AppException.notFound("Invalid or expired join code");
    }

    QuizSession session =
        sessionRepository
            .findById(sessionId)
            .orElseThrow(() -> AppException.notFound("Session not found"));

    // Players may join until the session ends. A latecomer enters at the question on screen and
    // simply has no answers for the ones already played.
    if (session.getStatus() == SessionStatus.ENDED) {
      throw AppException.conflict("This session has ended");
    }

    String rejoinToken = generateRejoinToken();
    Participant participant =
        Participant.builder()
            .session(session)
            .displayName(request.displayName())
            .rejoinToken(rejoinToken)
            .build();
    participant = participantRepository.save(participant);

    rejoinTokenStore.store(rejoinToken, participant.getId(), sessionId);

    eventPublisher.publishParticipantJoined(
        sessionId,
        stateStore.incrementParticipantCount(sessionId),
        participant.getId(),
        participant.getDisplayName());

    return new JoinResponse(participant.getId(), rejoinToken, sessionId);
  }

  @Transactional(readOnly = true)
  public RejoinResponse rejoinSession(RejoinRequest request) {
    Long sessionId = request.sessionId();
    Long participantId = resolveParticipantId(request.rejoinToken(), sessionId);

    QuizSession session =
        sessionRepository
            .findById(sessionId)
            .orElseThrow(() -> AppException.notFound("Session not found"));
    SessionStatus status = session.getStatus();
    SessionStateRedisRepository.RejoinContext ctx = stateStore.readRejoinContext(sessionId);

    List<Long> answered = answerRepository.findAnsweredQuestionIds(participantId);

    QuizSnapshot snapshot = snapshotService.loadSnapshot(sessionId);
    boolean active = SessionStatus.ACTIVE == status;

    RejoinResponse.CurrentQuestion currentQuestion = null;
    RejoinResponse.CurrentPassage currentPassage = null;
    List<QuizSnapshot.QuestionSnapshot> onScreen = List.of();

    if (active && ctx.currentPassageId() != null) {
      QuizSnapshot.PassageSnapshot passage = snapshot.requirePassage(ctx.currentPassageId());
      onScreen = snapshot.subQuestionsOf(passage);
      currentPassage =
          new RejoinResponse.CurrentPassage(
              passage.id(),
              passage.text(),
              passage.timerMode().name(),
              snapshot.questionPosition(onScreen.getFirst().id()),
              snapshot.questions().size(),
              passage.timeLimitSeconds(),
              onScreen.getFirst().effectiveDisplayMode().name(),
              onScreen.stream().map(q -> buildQuestionInfo(participantId, q, snapshot)).toList());
    } else if (active && ctx.currentQuestionId() != null) {
      QuizSnapshot.QuestionSnapshot question = snapshot.requireQuestion(ctx.currentQuestionId());
      onScreen = List.of(question);
      currentQuestion = buildCurrentQuestion(participantId, question, snapshot);
    }

    Map<Long, QuestionStats> questionStatsById = new LinkedHashMap<>();
    for (QuizSnapshot.QuestionSnapshot question : onScreen) {
      questionStatsById.put(
          question.id(),
          QuestionStats.forParticipant(
              question,
              scoringStore.answerStats(sessionId, question.id(), ctx.participantCount()),
              ctx.questionLifecycle()));
    }

    boolean reviewing = active && ctx.questionLifecycle() == QuestionLifecycleState.REVIEWING;

    Map<Long, Integer> myScores = new LinkedHashMap<>();
    if (reviewing) {
      for (QuizSnapshot.QuestionSnapshot question : onScreen) {
        ParticipantAnswer answer = currentAnswer(participantId, question.id());
        if (answer != null && answer.getGradedAt() != null) {
          myScores.put(question.id(), answer.getScore());
        }
      }
    }

    return new RejoinResponse(
        participantId,
        sessionId,
        status.name(),
        ctx.questionLifecycle(),
        snapshot.title(),
        ctx.participantCount(),
        ctx.currentQuestionId(),
        ctx.currentPassageId(),
        answered,
        currentQuestion,
        currentPassage,
        questionStatsById,
        reviewing ? leaderboardService.standings(sessionId) : List.of(),
        ctx.timeLeftSeconds(),
        myScores,
        ScoringRules.of(snapshot),
        active ? stateStore.getScene(sessionId) : StageScene.QUESTION);
  }

  /**
   * Takes a player out of a running or waiting session, usually a name that should not be on the
   * big screen. Their answers and their place on the board go with them, a live question's tallies
   * drop their pick, and their own screen is told it was them. Callers authorize and hold the
   * session's transition lock, so this cannot interleave with grading.
   */
  @Transactional
  public void removeParticipant(Long sessionId, Long participantId) {
    Participant participant =
        participantRepository
            .findById(participantId)
            .filter(p -> p.getSession().getId().equals(sessionId))
            .orElseThrow(() -> AppException.notFound("Player not found in this session"));

    boolean active = stateStore.getStatus(sessionId) == SessionStatus.ACTIVE;
    List<QuizSnapshot.QuestionSnapshot> onScreen =
        active ? questionsOnScreen(sessionId) : List.of();
    for (QuizSnapshot.QuestionSnapshot question : onScreen) {
      answerRepository
          .findByParticipantIdAndQuestionId(participantId, question.id())
          .ifPresent(
              answer -> {
                scoringStore.moveSelection(
                    sessionId,
                    question.id(),
                    participantId,
                    answer.getSelectedOptionIds(),
                    Set.of());
                scoringStore.unmarkLockedIn(sessionId, question.id(), participantId);
              });
    }

    answerRepository.deleteByParticipantId(participantId);
    participantRepository.delete(participant);
    rejoinTokenStore.delete(participant.getRejoinToken());
    long count = stateStore.decrementParticipantCount(sessionId);

    eventPublisher.publishParticipantLeft(sessionId, count, participantId);
    for (QuizSnapshot.QuestionSnapshot question : onScreen) {
      eventPublisher.publishAnswerUpdate(
          sessionId, question, scoringStore.answerStats(sessionId, question.id(), count));
    }
    if (active) {
      eventPublisher.publishLeaderboard(sessionId);
    }
  }

  private List<QuizSnapshot.QuestionSnapshot> questionsOnScreen(Long sessionId) {
    QuizSnapshot snapshot = snapshotService.loadSnapshot(sessionId);
    Long passageId = stateStore.getCurrentPassageId(sessionId);
    if (passageId != null) {
      return snapshot.subQuestionsOf(snapshot.requirePassage(passageId));
    }
    Long questionId = stateStore.getCurrentQuestionId(sessionId);
    return questionId == null ? List.of() : List.of(snapshot.requireQuestion(questionId));
  }

  /** Resolves a participant ID from a rejoin token, checking Redis first with DB fallback. */
  public Long resolveParticipantId(String rejoinToken, Long sessionId) {
    ParticipantRejoinTokenRedisRepository.TokenEntry entry = rejoinTokenStore.find(rejoinToken);
    if (entry != null) {
      if (entry.sessionId() != sessionId) {
        throw AppException.notFound("Invalid rejoin token for this session");
      }
      return entry.participantId();
    }

    // Postgres fallback: token expired from Redis
    Participant participant =
        participantRepository
            .findByRejoinToken(rejoinToken)
            .orElseThrow(() -> AppException.notFound("Invalid rejoin token"));

    if (!participant.getSession().getId().equals(sessionId)) {
      throw AppException.notFound("Invalid rejoin token for this session");
    }

    Long participantId = participant.getId();
    rejoinTokenStore.store(rejoinToken, participantId, sessionId);
    return participantId;
  }

  private static String generateRejoinToken() {
    StringBuilder token = new StringBuilder(32);
    for (int i = 0; i < 32; i++) {
      token.append(REJOIN_TOKEN_CHARS.charAt(SECURE_RANDOM.nextInt(REJOIN_TOKEN_CHARS.length())));
    }
    return token.toString();
  }

  private RejoinResponse.CurrentQuestion buildCurrentQuestion(
      Long participantId, QuizSnapshot.QuestionSnapshot question, QuizSnapshot snapshot) {
    ParticipantAnswer answer = currentAnswer(participantId, question.id());
    var foundPassage =
        question.passageId() != null ? snapshot.findPassage(question.passageId()) : null;
    RejoinResponse.PassageInfo passageInfo =
        foundPassage == null
            ? null
            : new RejoinResponse.PassageInfo(
                foundPassage.id(), foundPassage.text(), foundPassage.timerMode().name());

    return new RejoinResponse.CurrentQuestion(
        question.id(),
        question.text(),
        snapshot.questionPosition(question.id()),
        snapshot.questions().size(),
        question.timeLimitSeconds(),
        question.questionType().name(),
        question.effectiveDisplayMode().name(),
        passageInfo,
        OptionInfo.of(question),
        selectedOptionIds(answer),
        answer != null && answer.isLockedIn(),
        question.votesOnly());
  }

  private RejoinResponse.QuestionInfo buildQuestionInfo(
      Long participantId, QuizSnapshot.QuestionSnapshot question, QuizSnapshot snapshot) {
    ParticipantAnswer answer = currentAnswer(participantId, question.id());
    return new RejoinResponse.QuestionInfo(
        question.id(),
        question.text(),
        snapshot.questionPosition(question.id()),
        question.timeLimitSeconds(),
        question.questionType().name(),
        question.effectiveDisplayMode().name(),
        OptionInfo.of(question),
        selectedOptionIds(answer),
        answer != null && answer.isLockedIn(),
        question.votesOnly());
  }

  private ParticipantAnswer currentAnswer(Long participantId, Long questionId) {
    return answerRepository
        .findByParticipantIdAndQuestionId(participantId, questionId)
        .orElse(null);
  }

  private List<Long> selectedOptionIds(ParticipantAnswer answer) {
    if (answer == null || answer.getSelectedOptionIds().isEmpty()) {
      return List.of();
    }
    return new ArrayList<>(answer.getSelectedOptionIds());
  }
}
