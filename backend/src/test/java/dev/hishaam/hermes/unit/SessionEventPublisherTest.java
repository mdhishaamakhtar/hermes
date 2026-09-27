package dev.hishaam.hermes.unit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import dev.hishaam.hermes.dto.session.SessionResultsResponse;
import dev.hishaam.hermes.dto.ws.WsPayloads;
import dev.hishaam.hermes.repository.ParticipantRepository;
import dev.hishaam.hermes.repository.redis.SessionScoringRedisRepository;
import dev.hishaam.hermes.repository.redis.SessionStateRedisRepository;
import dev.hishaam.hermes.service.session.SessionEventPublisher;
import dev.hishaam.hermes.service.session.SessionSnapshotService;
import dev.hishaam.hermes.util.WsTopics;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.broker.BrokerAvailabilityEvent;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Unit tests for {@link SessionEventPublisher}'s delivery guards.
 *
 * <p>The publisher starts with the broker marked unavailable and only opens up once Spring reports
 * the relay online, so every integration test runs exclusively on the happy path. What is untested
 * there is precisely what matters when things go wrong: a relay that drops out mid-session must
 * degrade quietly rather than fail the host's request, and per-user acknowledgements must be
 * skipped for clients that supplied nothing to correlate them with. Session-end messages also wait
 * for the caller's transaction, so they are tested against its commit and rollback.
 */
@ExtendWith(MockitoExtension.class)
class SessionEventPublisherTest {

  private static final Long SESSION_ID = 1L;
  private static final Long QUESTION_ID = 2L;

  @Mock private SimpMessagingTemplate messaging;
  @Mock private SessionSnapshotService snapshotService;
  @Mock private SessionStateRedisRepository stateStore;
  @Mock private SessionScoringRedisRepository scoringStore;
  @Mock private ParticipantRepository participantRepository;

  @InjectMocks private SessionEventPublisher publisher;

  private final TransactionTemplate transaction =
      new TransactionTemplate(new NoResourceTransactionManager());

  private void brokerOnline() {
    publisher.onBrokerAvailability(new BrokerAvailabilityEvent(true, this));
  }

  private void brokerOffline() {
    publisher.onBrokerAvailability(new BrokerAvailabilityEvent(false, this));
  }

  @BeforeEach
  void assumeBrokerUp() {
    brokerOnline();
  }

  /** A publisher that has never seen a broker-up event must not attempt any delivery. */
  @Test
  void nothingIsSentBeforeTheBrokerReportsItselfOnline() {
    brokerOffline();

    publisher.publishParticipantJoined(SESSION_ID, 3);
    publisher.publishSessionEnd(SESSION_ID);
    publisher.publishAnswerAccepted("ws:1", "req-1", QUESTION_ID, false);

    verifyNoInteractions(messaging);
  }

  /** Once the relay drops out mid-session, broadcasts are dropped instead of thrown. */
  @Test
  void broadcastsAreDroppedQuietlyAfterTheBrokerGoesOffline() {
    publisher.publishParticipantJoined(SESSION_ID, 1);
    verify(messaging, never()).convertAndSendToUser(anyString(), anyString(), any());

    brokerOffline();
    publisher.publishParticipantJoined(SESSION_ID, 2);
    publisher.publishAnswerRejected("ws:1", "req-1", QUESTION_ID, "CONFLICT", "nope", false);

    // Only the first, pre-offline broadcast reached the template.
    verify(messaging, times(2)).convertAndSend(anyString(), (Object) any());
  }

  /** A broker that rejects a message must not surface as a failed host request. */
  @Test
  void deliveryFailuresAreSwallowedRatherThanPropagated() {
    doThrow(new MessageDeliveryException("relay refused"))
        .when(messaging)
        .convertAndSend(anyString(), (Object) any());
    doThrow(new MessageDeliveryException("relay refused"))
        .when(messaging)
        .convertAndSendToUser(anyString(), anyString(), any());

    publisher.publishParticipantJoined(SESSION_ID, 1);
    publisher.publishAnswerAccepted("ws:1", "req-1", QUESTION_ID, false);
  }

  /**
   * Acknowledgements are addressed to a specific STOMP user and correlated by a client-supplied id;
   * without either there is nobody to notify, so the send is skipped rather than broadcast.
   */
  @Test
  void acknowledgementsAreSkippedWithoutAUserAndACorrelationId() {
    publisher.publishAnswerAccepted(null, "req-1", QUESTION_ID, false);
    publisher.publishAnswerAccepted("ws:1", null, QUESTION_ID, false);
    publisher.publishAnswerAccepted("ws:1", "   ", QUESTION_ID, false);

    publisher.publishAnswerRejected(null, "req-1", QUESTION_ID, "CONFLICT", "nope", true);
    publisher.publishAnswerRejected("ws:1", null, QUESTION_ID, "CONFLICT", "nope", true);
    publisher.publishAnswerRejected("ws:1", "", QUESTION_ID, "CONFLICT", "nope", true);

    verify(messaging, never()).convertAndSendToUser(anyString(), anyString(), any());
  }

  /** With a user and a correlation id present, both acknowledgement kinds reach that user. */
  @Test
  void acknowledgementsReachTheNamedUserWhenFullyAddressed() {
    publisher.publishAnswerAccepted("ws:1", "req-1", QUESTION_ID, false);
    publisher.publishAnswerRejected("ws:1", "req-2", QUESTION_ID, "CONFLICT", "nope", true);

    ArgumentCaptor<Object> payloads = ArgumentCaptor.forClass(Object.class);
    verify(messaging, times(2))
        .convertAndSendToUser(eq("ws:1"), eq("/queue/answers"), payloads.capture());

    assertThat(payloads.getAllValues())
        .satisfiesExactly(
            accepted -> {
              assertThat(accepted).isInstanceOf(WsPayloads.AnswerAccepted.class);
              assertThat(((WsPayloads.AnswerAccepted) accepted).clientRequestId())
                  .isEqualTo("req-1");
              assertThat(((WsPayloads.AnswerAccepted) accepted).lockedIn()).isFalse();
            },
            rejected -> {
              assertThat(rejected).isInstanceOf(WsPayloads.AnswerRejected.class);
              assertThat(((WsPayloads.AnswerRejected) rejected).code()).isEqualTo("CONFLICT");
              assertThat(((WsPayloads.AnswerRejected) rejected).lockedIn()).isTrue();
            });
  }

  /**
   * Clients fetch results the moment SESSION_END lands, so nothing goes out until the session's
   * ENDED status has committed. The standings are still the ones Redis held at publish time, since
   * the engine deletes them before its transaction commits.
   */
  @Test
  void sessionEndWaitsForTheCommitButCarriesTheStandingsReadBeforeIt() {
    List<SessionResultsResponse.LeaderboardEntry> standings =
        List.of(new SessionResultsResponse.LeaderboardEntry(1, 7L, "Lin", 10));
    when(scoringStore.buildLeaderboard(SESSION_ID)).thenReturn(standings);
    when(stateStore.getParticipantCount(SESSION_ID)).thenReturn(1L);

    transaction.executeWithoutResult(
        status -> {
          publisher.publishSessionEnd(SESSION_ID);
          publisher.publishSessionEndAnalytics(SESSION_ID);
          // The engine clears the session's Redis keys next, still inside its transaction.
          reset(scoringStore, stateStore);
          verifyNoInteractions(messaging);
        });

    verify(messaging)
        .convertAndSend(
            eq(WsTopics.sessionQuestion(SESSION_ID)), (Object) any(WsPayloads.SessionEnd.class));
    ArgumentCaptor<WsPayloads.SessionEndAnalytics> analytics =
        ArgumentCaptor.forClass(WsPayloads.SessionEndAnalytics.class);
    verify(messaging)
        .convertAndSend(eq(WsTopics.sessionAnalytics(SESSION_ID)), (Object) analytics.capture());
    assertThat(analytics.getValue().leaderboard()).isEqualTo(standings);
    assertThat(analytics.getValue().totalParticipants()).isEqualTo(1);
  }

  /** A rolled-back end never happened, so participants must not be told the session is over. */
  @Test
  void sessionEndIsDroppedWhenTheTransactionRollsBack() {
    transaction.executeWithoutResult(
        status -> {
          publisher.publishSessionEnd(SESSION_ID);
          publisher.publishSessionEndAnalytics(SESSION_ID);
          status.setRollbackOnly();
        });

    verifyNoInteractions(messaging);
  }

  /** Without a transaction there is no commit to wait for, so SESSION_END goes out at once. */
  @Test
  void sessionEndIsSentAtOnceOutsideATransaction() {
    publisher.publishSessionEnd(SESSION_ID);
    publisher.publishSessionEndAnalytics(SESSION_ID);

    verify(messaging, times(2)).convertAndSend(anyString(), (Object) any());
  }

  /** Runs Spring's real transaction synchronization callbacks with no resource behind them. */
  private static final class NoResourceTransactionManager
      extends AbstractPlatformTransactionManager {

    @Override
    protected Object doGetTransaction() {
      return new Object();
    }

    @Override
    protected void doBegin(Object transaction, TransactionDefinition definition) {}

    @Override
    protected void doCommit(DefaultTransactionStatus status) {}

    @Override
    protected void doRollback(DefaultTransactionStatus status) {}
  }
}
