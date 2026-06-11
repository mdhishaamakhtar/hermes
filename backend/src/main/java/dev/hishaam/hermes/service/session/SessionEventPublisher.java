package dev.hishaam.hermes.service.session;

import dev.hishaam.hermes.dto.session.AnswerStats;
import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.dto.session.SessionResultsResponse;
import dev.hishaam.hermes.dto.ws.WsPayloads;
import dev.hishaam.hermes.entity.enums.DisplayMode;
import dev.hishaam.hermes.repository.ParticipantRepository;
import dev.hishaam.hermes.repository.redis.SessionScoringRedisRepository;
import dev.hishaam.hermes.repository.redis.SessionStateRedisRepository;
import dev.hishaam.hermes.util.LeaderboardBuilder;
import dev.hishaam.hermes.util.WsTopics;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.broker.BrokerAvailabilityEvent;
import org.springframework.stereotype.Service;

/**
 * Publishes all STOMP WebSocket events for a session: question lifecycle events (displayed, frozen,
 * reviewed), passage events, timer start, leaderboard updates, session end, and per-participant
 * answer feedback. Drops messages silently when the broker relay is offline to avoid blocking
 * callers. Broker availability is tracked via Spring's {@link BrokerAvailabilityEvent}.
 */
@Service
public class SessionEventPublisher {

  private static final Logger log = LoggerFactory.getLogger(SessionEventPublisher.class);

  private volatile boolean brokerAvailable = false;

  private final SimpMessagingTemplate messaging;
  private final SessionSnapshotService snapshotService;
  private final SessionStateRedisRepository stateStore;
  private final SessionScoringRedisRepository scoringStore;
  private final ParticipantRepository participantRepository;

  public SessionEventPublisher(
      SimpMessagingTemplate messaging,
      SessionSnapshotService snapshotService,
      SessionStateRedisRepository stateStore,
      SessionScoringRedisRepository scoringStore,
      ParticipantRepository participantRepository) {
    this.messaging = messaging;
    this.snapshotService = snapshotService;
    this.stateStore = stateStore;
    this.scoringStore = scoringStore;
    this.participantRepository = participantRepository;
  }

  public void publishParticipantJoined(Long sessionId, long participantCount) {
    var payload = new WsPayloads.ParticipantJoined(participantCount);
    send(WsTopics.sessionControl(sessionId), payload);
    send(WsTopics.sessionQuestion(sessionId), payload);
  }

  public void publishQuestionDisplayed(
      Long sessionId, QuizSnapshot.QuestionSnapshot question, QuizSnapshot snapshot) {
    int questionIndex = snapshot.questionPosition(question.id());
    int totalQuestions = snapshot.questions().size();

    List<WsPayloads.Option> options =
        question.options().stream()
            .map(o -> new WsPayloads.Option(o.id(), o.text(), o.orderIndex()))
            .toList();

    WsPayloads.PassageContext passageContext = null;
    if (question.passageId() != null) {
      QuizSnapshot.PassageSnapshot passage = snapshot.findPassage(question.passageId());
      if (passage != null) {
        passageContext = new WsPayloads.PassageContext(passage.id(), passage.text());
      }
    }

    send(
        WsTopics.sessionQuestion(sessionId),
        new WsPayloads.QuestionDisplayed(
            question.id(),
            question.text(),
            question.questionType().name(),
            options,
            questionIndex,
            totalQuestions,
            passageContext,
            question.effectiveDisplayMode().name()));
  }

  public void publishPassageDisplayed(
      Long sessionId,
      QuizSnapshot.PassageSnapshot passage,
      List<QuizSnapshot.QuestionSnapshot> subQuestions,
      QuizSnapshot snapshot) {
    int questionIndex = snapshot.questionPosition(subQuestions.getFirst().id());
    int totalQuestions = snapshot.questions().size();

    List<WsPayloads.SubQuestion> wsSubQuestions =
        subQuestions.stream()
            .map(
                q -> {
                  List<WsPayloads.Option> opts =
                      q.options().stream()
                          .map(o -> new WsPayloads.Option(o.id(), o.text(), o.orderIndex()))
                          .toList();
                  return new WsPayloads.SubQuestion(
                      q.id(), q.text(), q.questionType().name(), opts);
                })
            .toList();

    String effectiveDisplayMode =
        subQuestions.isEmpty()
            ? DisplayMode.LIVE.name()
            : subQuestions.getFirst().effectiveDisplayMode().name();

    send(
        WsTopics.sessionQuestion(sessionId),
        new WsPayloads.PassageDisplayed(
            passage.id(),
            passage.text(),
            passage.timeLimitSeconds(),
            wsSubQuestions,
            questionIndex,
            totalQuestions,
            effectiveDisplayMode));
  }

  public void publishTimerStart(
      Long sessionId, Long questionId, Long passageId, int timeLimitSeconds) {
    send(
        WsTopics.sessionQuestion(sessionId),
        new WsPayloads.TimerStart(questionId, passageId, timeLimitSeconds));
  }

  public void publishQuestionFrozen(Long sessionId, Long questionId) {
    send(WsTopics.sessionQuestion(sessionId), new WsPayloads.QuestionFrozen(questionId));
  }

  public void publishPassageFrozen(Long sessionId, Long passageId, List<Long> subQuestionIds) {
    send(
        WsTopics.sessionQuestion(sessionId),
        new WsPayloads.PassageFrozen(passageId, subQuestionIds));
  }

  public void publishSessionEnd(Long sessionId) {
    send(WsTopics.sessionQuestion(sessionId), new WsPayloads.SessionEnd());
  }

  public void publishSessionEndAnalytics(Long sessionId) {
    List<SessionResultsResponse.LeaderboardEntry> leaderboard =
        scoringStore.buildLeaderboard(sessionId);
    long participantCount = stateStore.getParticipantCount(sessionId);
    send(
        WsTopics.sessionAnalytics(sessionId),
        new WsPayloads.SessionEndAnalytics(leaderboard, participantCount));
  }

  public void publishQuestionReviewed(
      Long sessionId, Long questionId, QuizSnapshot.QuestionSnapshot question) {
    List<Long> correctOptionIds =
        question.options().stream()
            .filter(o -> o.pointValue() > 0)
            .map(QuizSnapshot.OptionSnapshot::id)
            .toList();

    Map<Long, Integer> optionPoints = new LinkedHashMap<>();
    question.options().forEach(o -> optionPoints.put(o.id(), o.pointValue()));

    send(
        WsTopics.sessionQuestion(sessionId),
        new WsPayloads.QuestionReviewed(questionId, correctOptionIds, optionPoints));

    DisplayMode mode = question.effectiveDisplayMode();
    if (mode == DisplayMode.BLIND || mode == DisplayMode.CODE_DISPLAY) {
      Map<Long, Long> counts = scoringStore.getQuestionCounts(sessionId, questionId);
      long totalAnswered = scoringStore.getTotalAnswered(sessionId, questionId);
      long totalParticipants = stateStore.getParticipantCount(sessionId);

      var answerReveal =
          new WsPayloads.AnswerReveal(questionId, counts, totalAnswered, totalParticipants);
      send(WsTopics.sessionAnalytics(sessionId), answerReveal);
      send(WsTopics.sessionQuestion(sessionId), answerReveal);
    }
  }

  public void publishScoringCorrected(
      Long sessionId, Long questionId, QuizSnapshot.QuestionSnapshot question) {
    List<Long> correctOptionIds =
        question.options().stream()
            .filter(o -> o.pointValue() > 0)
            .map(QuizSnapshot.OptionSnapshot::id)
            .toList();

    Map<Long, Integer> optionPoints = new LinkedHashMap<>();
    question.options().forEach(o -> optionPoints.put(o.id(), o.pointValue()));

    send(
        WsTopics.sessionQuestion(sessionId),
        new WsPayloads.ScoringCorrected(questionId, correctOptionIds, optionPoints));
  }

  public void publishLeaderboardFromDb(Long sessionId, Map<Long, Long> participantTotals) {
    Map<Long, String> names = new HashMap<>();
    participantRepository
        .findBySessionId(sessionId)
        .forEach(p -> names.put(p.getId(), p.getDisplayName()));
    long totalParticipants = participantRepository.countBySessionId(sessionId);

    List<SessionResultsResponse.LeaderboardEntry> leaderboard =
        LeaderboardBuilder.rank(participantTotals, names);

    send(WsTopics.sessionAnalytics(sessionId), new WsPayloads.LeaderboardUpdate(leaderboard));

    send(
        WsTopics.sessionQuestion(sessionId),
        new WsPayloads.ParticipantLeaderboard(
            leaderboard.stream()
                .map(
                    e ->
                        new WsPayloads.ParticipantLeaderboardEntry(
                            e.participantId(), e.rank(), e.displayName(), e.score()))
                .toList(),
            totalParticipants));
  }

  public void publishLeaderboardUpdates(Long sessionId) {
    List<SessionResultsResponse.LeaderboardEntry> leaderboard =
        scoringStore.buildLeaderboard(sessionId);
    long totalParticipants = stateStore.getParticipantCount(sessionId);

    send(WsTopics.sessionAnalytics(sessionId), new WsPayloads.LeaderboardUpdate(leaderboard));

    send(
        WsTopics.sessionQuestion(sessionId),
        new WsPayloads.ParticipantLeaderboard(
            leaderboard.stream()
                .sorted(Comparator.comparingInt(SessionResultsResponse.LeaderboardEntry::rank))
                .map(
                    e ->
                        new WsPayloads.ParticipantLeaderboardEntry(
                            e.participantId(), e.rank(), e.displayName(), e.score()))
                .toList(),
            totalParticipants));
  }

  public void publishAnswerUpdate(Long sessionId, Long questionId, AnswerStats stats) {
    String sid = sessionId.toString();
    QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
    QuizSnapshot.QuestionSnapshot question = snapshot.findQuestion(questionId);
    DisplayMode mode = question != null ? question.effectiveDisplayMode() : DisplayMode.LIVE;

    if (mode == DisplayMode.CODE_DISPLAY) {
      return;
    }

    Map<Long, Long> broadcastCounts = mode == DisplayMode.BLIND ? Map.of() : stats.optionCounts();
    var answerUpdate =
        new WsPayloads.AnswerUpdate(
            questionId,
            broadcastCounts,
            stats.totalAnswered(),
            stats.totalParticipants(),
            stats.totalLockedIn());
    send(WsTopics.sessionAnalytics(sessionId), answerUpdate);
    send(WsTopics.sessionQuestion(sessionId), answerUpdate);
  }

  public void publishAnswerAccepted(
      String username, String clientRequestId, Long questionId, boolean lockedIn) {
    if (username == null || clientRequestId == null || clientRequestId.isBlank()) {
      return;
    }
    sendToUser(
        username,
        "/queue/answers",
        new WsPayloads.AnswerAccepted(clientRequestId, questionId, lockedIn));
  }

  public void publishAnswerRejected(
      String username,
      String clientRequestId,
      Long questionId,
      String code,
      String message,
      boolean lockedIn) {
    if (username == null || clientRequestId == null || clientRequestId.isBlank()) {
      return;
    }
    sendToUser(
        username,
        "/queue/answers",
        new WsPayloads.AnswerRejected(clientRequestId, questionId, code, message, lockedIn));
  }

  @EventListener
  public void onBrokerAvailability(BrokerAvailabilityEvent event) {
    this.brokerAvailable = event.isBrokerAvailable();
    if (!brokerAvailable) {
      log.warn("STOMP broker relay went offline");
    } else {
      log.info("STOMP broker relay is online");
    }
  }

  private void send(String destination, Object payload) {
    if (!brokerAvailable) {
      log.debug("Broker offline, dropping message to {}", destination);
      return;
    }
    try {
      messaging.convertAndSend(destination, payload);
    } catch (MessageDeliveryException e) {
      log.warn("Failed to deliver message to {}: {}", destination, e.getMessage());
    }
  }

  private void sendToUser(String username, String destination, Object payload) {
    if (!brokerAvailable) {
      log.debug("Broker offline, dropping user message to {}", destination);
      return;
    }
    try {
      messaging.convertAndSendToUser(username, destination, payload);
    } catch (MessageDeliveryException e) {
      log.warn("Failed to deliver user message to {}: {}", destination, e.getMessage());
    }
  }
}
