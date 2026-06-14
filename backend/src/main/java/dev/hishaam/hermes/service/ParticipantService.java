package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.session.JoinResponse;
import dev.hishaam.hermes.dto.session.JoinSessionRequest;
import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.dto.session.RejoinRequest;
import dev.hishaam.hermes.dto.session.RejoinResponse;
import dev.hishaam.hermes.dto.session.SessionResultsResponse;
import dev.hishaam.hermes.entity.Participant;
import dev.hishaam.hermes.entity.ParticipantAnswer;
import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.entity.enums.DisplayMode;
import dev.hishaam.hermes.entity.enums.SessionStatus;
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
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Manages anonymous participant join and rejoin flows. Join creates a new {@link
 * dev.hishaam.hermes.entity.Participant} row, issues a 32-character rejoin token, and initialises
 * the participant's leaderboard entry in Redis. Rejoin reconstructs the full live-session view from
 * Redis state and the quiz snapshot so a reconnecting client can resume without missing events.
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

  public ParticipantService(
      QuizSessionRepository sessionRepository,
      ParticipantRepository participantRepository,
      ParticipantAnswerRepository answerRepository,
      SessionSnapshotService snapshotService,
      SessionStateRedisRepository stateStore,
      SessionScoringRedisRepository scoringStore,
      SessionEventPublisher eventPublisher,
      ParticipantRejoinTokenRedisRepository rejoinTokenStore) {
    this.sessionRepository = sessionRepository;
    this.participantRepository = participantRepository;
    this.answerRepository = answerRepository;
    this.snapshotService = snapshotService;
    this.stateStore = stateStore;
    this.scoringStore = scoringStore;
    this.eventPublisher = eventPublisher;
    this.rejoinTokenStore = rejoinTokenStore;
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

    // Only allow joining LOBBY sessions
    if (session.getStatus() != SessionStatus.LOBBY) {
      throw AppException.conflict("Session is no longer accepting participants");
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

    long count = stateStore.incrementParticipantCount(sessionId);
    stateStore.cacheParticipantName(sessionId, participant.getId(), request.displayName());
    // Initialize with score 0 so zero-correct participants appear in leaderboard
    scoringStore.initEntry(sessionId, participant.getId());

    eventPublisher.publishParticipantJoined(sessionId, count);

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

    QuizSnapshot snapshot = snapshotService.loadSnapshot(sessionId.toString());

    RejoinResponse.CurrentQuestion currentQuestion = null;
    RejoinResponse.CurrentPassage currentPassage = null;
    Map<Long, RejoinResponse.QuestionStats> questionStatsById = new LinkedHashMap<>();
    if (SessionStatus.ACTIVE == status && ctx.currentQuestionId() != null) {
      if (ctx.currentPassageId() != null) {
        QuizSnapshot.PassageSnapshot passage = snapshot.findPassage(ctx.currentPassageId());
        if (passage != null) {
          List<RejoinResponse.QuestionInfo> subQuestions =
              passage.subQuestionIds().stream()
                  .map(snapshot::findQuestion)
                  .filter(Objects::nonNull)
                  .sorted(Comparator.comparingInt(QuizSnapshot.QuestionSnapshot::orderIndex))
                  .map(
                      qSnap -> {
                        questionStatsById.put(
                            qSnap.id(), buildQuestionStats(sessionId, qSnap, ctx));
                        return buildQuestionInfo(participantId, qSnap, snapshot);
                      })
                  .toList();

          currentPassage =
              new RejoinResponse.CurrentPassage(
                  passage.id(),
                  passage.text(),
                  passage.timerMode().name(),
                  snapshot.questionPosition(
                      subQuestions.isEmpty()
                          ? ctx.currentQuestionId()
                          : subQuestions.getFirst().id()),
                  snapshot.questions().size(),
                  passage.timeLimitSeconds(),
                  subQuestions.isEmpty() ? null : subQuestions.getFirst().effectiveDisplayMode(),
                  subQuestions);
        }
      } else {
        QuizSnapshot.QuestionSnapshot qSnap = snapshot.findQuestion(ctx.currentQuestionId());
        if (qSnap != null) {
          currentQuestion = buildCurrentQuestion(participantId, qSnap, snapshot);
          questionStatsById.put(qSnap.id(), buildQuestionStats(sessionId, qSnap, ctx));
        }
      }
    }

    List<SessionResultsResponse.LeaderboardEntry> leaderboard =
        SessionStatus.ACTIVE == status && "REVIEWING".equals(ctx.questionLifecycle())
            ? scoringStore.buildLeaderboard(sessionId)
            : List.of();

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
        leaderboard,
        ctx.timeLeftSeconds());
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
    List<RejoinResponse.OptionInfo> options =
        question.options().stream()
            .map(o -> new RejoinResponse.OptionInfo(o.id(), o.text(), o.orderIndex()))
            .toList();
    ParticipantAnswer answer = currentAnswer(participantId, question.id());
    List<Long> selectedOptionIds = selectedOptionIds(answer);
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
        options,
        selectedOptionIds,
        answer != null && answer.isLockedIn());
  }

  private RejoinResponse.QuestionInfo buildQuestionInfo(
      Long participantId, QuizSnapshot.QuestionSnapshot question, QuizSnapshot snapshot) {
    ParticipantAnswer answer = currentAnswer(participantId, question.id());
    List<RejoinResponse.OptionInfo> options =
        question.options().stream()
            .map(o -> new RejoinResponse.OptionInfo(o.id(), o.text(), o.orderIndex()))
            .toList();
    return new RejoinResponse.QuestionInfo(
        question.id(),
        question.text(),
        snapshot.questionPosition(question.id()),
        question.timeLimitSeconds(),
        question.questionType().name(),
        question.effectiveDisplayMode().name(),
        options,
        selectedOptionIds(answer),
        answer != null && answer.isLockedIn());
  }

  private RejoinResponse.QuestionStats buildQuestionStats(
      Long sessionId,
      QuizSnapshot.QuestionSnapshot question,
      SessionStateRedisRepository.RejoinContext ctx) {
    Map<Long, Integer> optionPoints = new LinkedHashMap<>();
    question.options().forEach(option -> optionPoints.put(option.id(), option.pointValue()));
    List<Long> correctOptionIds =
        question.options().stream()
            .filter(option -> option.pointValue() > 0)
            .map(QuizSnapshot.OptionSnapshot::id)
            .toList();
    boolean reviewed = "REVIEWING".equals(ctx.questionLifecycle());
    boolean revealed =
        reviewed
            && (question.effectiveDisplayMode() == DisplayMode.BLIND
                || question.effectiveDisplayMode() == DisplayMode.CODE_DISPLAY);

    return new RejoinResponse.QuestionStats(
        scoringStore.getQuestionCounts(sessionId, question.id()),
        scoringStore.getTotalAnswered(sessionId, question.id()),
        scoringStore.getTotalLockedIn(sessionId, question.id()),
        ctx.participantCount(),
        correctOptionIds,
        optionPoints,
        revealed,
        reviewed);
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
