package dev.hishaam.hermes.service.session;

import dev.hishaam.hermes.dto.session.AnswerStats;
import dev.hishaam.hermes.dto.session.OptionInfo;
import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.dto.session.SessionResultsResponse.LeaderboardEntry;
import dev.hishaam.hermes.dto.ws.WsPayloads;
import dev.hishaam.hermes.entity.enums.DisplayMode;
import dev.hishaam.hermes.repository.redis.SessionScoringRedisRepository;
import dev.hishaam.hermes.repository.redis.SessionStateRedisRepository;
import dev.hishaam.hermes.service.LeaderboardService;
import dev.hishaam.hermes.util.WsTopics;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.broker.BrokerAvailabilityEvent;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Publishes all STOMP WebSocket events for a session: question lifecycle events (displayed, frozen,
 * reviewed), passage events, timer start, leaderboard updates, session end, and per-participant
 * answer feedback. Drops messages silently while the broker is unavailable, to avoid blocking
 * callers; availability is tracked via Spring's {@link BrokerAvailabilityEvent}, which both the
 * in-process broker and the relay raise. Session-end messages are held until the caller's
 * transaction commits.
 */
@Service
public class SessionEventPublisher {

  private static final Logger log = LoggerFactory.getLogger(SessionEventPublisher.class);

  private volatile boolean brokerAvailable = false;

  private final SimpMessagingTemplate messaging;
  private final SessionStateRedisRepository stateStore;
  private final SessionScoringRedisRepository scoringStore;
  private final LeaderboardService leaderboardService;

  public SessionEventPublisher(
      SimpMessagingTemplate messaging,
      SessionStateRedisRepository stateStore,
      SessionScoringRedisRepository scoringStore,
      LeaderboardService leaderboardService) {
    this.messaging = messaging;
    this.stateStore = stateStore;
    this.scoringStore = scoringStore;
    this.leaderboardService = leaderboardService;
  }

  public void publishParticipantJoined(Long sessionId, long participantCount) {
    send(WsTopics.sessionQuestion(sessionId), new WsPayloads.ParticipantJoined(participantCount));
  }

  public void publishQuestionDisplayed(
      Long sessionId, QuizSnapshot.QuestionSnapshot question, QuizSnapshot snapshot) {
    WsPayloads.PassageContext passageContext = null;
    if (question.passageId() != null) {
      QuizSnapshot.PassageSnapshot passage = snapshot.requirePassage(question.passageId());
      passageContext = new WsPayloads.PassageContext(passage.id(), passage.text());
    }

    send(
        WsTopics.sessionQuestion(sessionId),
        new WsPayloads.QuestionDisplayed(
            question.id(),
            question.text(),
            question.questionType().name(),
            OptionInfo.of(question),
            snapshot.questionPosition(question.id()),
            snapshot.questions().size(),
            passageContext,
            question.effectiveDisplayMode().name()));
  }

  public void publishPassageDisplayed(
      Long sessionId,
      QuizSnapshot.PassageSnapshot passage,
      List<QuizSnapshot.QuestionSnapshot> subQuestions,
      QuizSnapshot snapshot) {
    List<WsPayloads.SubQuestion> wsSubQuestions =
        subQuestions.stream()
            .map(
                q ->
                    new WsPayloads.SubQuestion(
                        q.id(), q.text(), q.questionType().name(), OptionInfo.of(q)))
            .toList();

    send(
        WsTopics.sessionQuestion(sessionId),
        new WsPayloads.PassageDisplayed(
            passage.id(),
            passage.text(),
            passage.timeLimitSeconds(),
            wsSubQuestions,
            snapshot.questionPosition(subQuestions.getFirst().id()),
            snapshot.questions().size(),
            subQuestions.getFirst().effectiveDisplayMode().name()));
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

  /**
   * Tells players the session is over and hands the organiser the final standings. Both messages
   * wait for the caller's transaction to commit: clients fetch results as soon as SESSION_END
   * arrives, and results are refused until the ENDED status is committed.
   */
  public void publishSessionEnd(Long sessionId) {
    List<LeaderboardEntry> leaderboard = leaderboardService.standings(sessionId);
    sendAfterCommit(WsTopics.sessionQuestion(sessionId), new WsPayloads.SessionEnd());
    sendAfterCommit(
        WsTopics.sessionAnalytics(sessionId),
        new WsPayloads.SessionEndAnalytics(leaderboard, leaderboard.size()));
  }

  /**
   * Reveals a graded question's answer key and, where the display mode kept the tallies hidden
   * during the countdown, the final answer distribution.
   */
  public void publishQuestionReviewed(Long sessionId, QuizSnapshot.QuestionSnapshot question) {
    send(
        WsTopics.sessionQuestion(sessionId),
        new WsPayloads.QuestionReviewed(
            question.id(), question.correctOptionIds(), question.optionPoints()));

    if (question.effectiveDisplayMode() != DisplayMode.LIVE) {
      AnswerStats stats =
          scoringStore.answerStats(
              sessionId, question.id(), stateStore.getParticipantCount(sessionId));
      var answerReveal =
          new WsPayloads.AnswerReveal(
              question.id(),
              stats.optionCounts(),
              stats.totalAnswered(),
              stats.totalParticipants());
      send(WsTopics.sessionAnalytics(sessionId), answerReveal);
      send(WsTopics.sessionQuestion(sessionId), answerReveal);
    }
  }

  public void publishScoringCorrected(Long sessionId, QuizSnapshot.QuestionSnapshot question) {
    send(
        WsTopics.sessionQuestion(sessionId),
        new WsPayloads.ScoringCorrected(
            question.id(), question.correctOptionIds(), question.optionPoints()));
  }

  /** Sends the current standings to the organiser and to every player. */
  public void publishLeaderboard(Long sessionId) {
    List<LeaderboardEntry> leaderboard = leaderboardService.standings(sessionId);

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
            leaderboard.size()));
  }

  /**
   * Streams the live tallies for a question. What goes out follows its display mode: LIVE shows the
   * per-option counts, BLIND only how many have answered, CODE_DISPLAY nothing until review.
   */
  public void publishAnswerUpdate(
      Long sessionId, QuizSnapshot.QuestionSnapshot question, AnswerStats stats) {
    DisplayMode mode = question.effectiveDisplayMode();
    if (mode == DisplayMode.CODE_DISPLAY) {
      return;
    }

    var answerUpdate =
        new WsPayloads.AnswerUpdate(
            question.id(),
            mode == DisplayMode.BLIND ? Map.of() : stats.optionCounts(),
            stats.totalAnswered(),
            stats.totalParticipants(),
            stats.totalLockedIn());
    send(WsTopics.sessionAnalytics(sessionId), answerUpdate);
    send(WsTopics.sessionQuestion(sessionId), answerUpdate);
  }

  public void publishAnswerAccepted(
      String username, String clientRequestId, Long questionId, boolean lockedIn) {
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
    sendToUser(
        username,
        "/queue/answers",
        new WsPayloads.AnswerRejected(clientRequestId, questionId, code, message, lockedIn));
  }

  @EventListener
  public void onBrokerAvailability(BrokerAvailabilityEvent event) {
    this.brokerAvailable = event.isBrokerAvailable();
    if (!brokerAvailable) {
      log.warn("STOMP broker went offline");
    } else {
      log.info("STOMP broker is online");
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

  /**
   * Defers {@link #send} until the current transaction commits, and drops the message if it rolls
   * back. With no transaction synchronization active there is nothing to wait for, so it sends now.
   */
  private void sendAfterCommit(String destination, Object payload) {
    if (!TransactionSynchronizationManager.isSynchronizationActive()) {
      send(destination, payload);
      return;
    }
    TransactionSynchronizationManager.registerSynchronization(
        new TransactionSynchronization() {
          @Override
          public void afterCommit() {
            send(destination, payload);
          }
        });
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
