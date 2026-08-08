package dev.hishaam.hermes.unit;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import dev.hishaam.hermes.dto.session.AnswerRequest;
import dev.hishaam.hermes.dto.session.LockInRequest;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.service.AnswerService;
import dev.hishaam.hermes.service.session.SessionEventPublisher;
import dev.hishaam.hermes.ws.AnswerWebSocketHandler;
import java.security.Principal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Unit tests for {@link AnswerWebSocketHandler}'s acknowledgement addressing and failure handling.
 *
 * <p>The handler is the outermost frame of the answer path: nothing above it can turn an exception
 * into a response, so anything it lets escape is lost inside Spring's messaging machinery with the
 * participant left waiting. These tests cover the cases a live STOMP client cannot produce on
 * demand — a request with no correlation id to acknowledge, and a non-{@link AppException} failure
 * from the service layer.
 */
@ExtendWith(MockitoExtension.class)
class AnswerWebSocketHandlerTest {

  private static final Long SESSION_ID = 1L;
  private static final Long QUESTION_ID = 2L;

  @Mock private AnswerService answerService;
  @Mock private SessionEventPublisher eventPublisher;

  @InjectMocks private AnswerWebSocketHandler handler;

  private static final Principal PARTICIPANT = () -> "ws:1";

  private static AnswerRequest answer(String clientRequestId) {
    return new AnswerRequest("token", QUESTION_ID, List.of(9L), clientRequestId);
  }

  private static LockInRequest lockIn(String clientRequestId) {
    return new LockInRequest("token", QUESTION_ID, clientRequestId);
  }

  /**
   * A fire-and-forget client that sends no correlation id still gets its answer recorded, but there
   * is nothing to acknowledge against, so no per-user frame is emitted.
   */
  @Test
  void answersWithoutACorrelationIdAreRecordedButNotAcknowledged() {
    handler.submitAnswer(SESSION_ID, answer(null), PARTICIPANT);
    handler.submitAnswer(SESSION_ID, answer("   "), PARTICIPANT);
    handler.lockIn(SESSION_ID, lockIn(null), PARTICIPANT);

    verify(answerService, times(2)).submitAnswer(eq(SESSION_ID), any());
    verify(answerService).lockInAnswer(eq(SESSION_ID), any());
    verifyNoInteractions(eventPublisher);
  }

  /** With no authenticated STOMP user there is no queue to address, so nothing is published. */
  @Test
  void answersFromAnUnidentifiedSessionAreNotAcknowledged() {
    handler.submitAnswer(SESSION_ID, answer("req-1"), null);
    handler.lockIn(SESSION_ID, lockIn("req-2"), null);

    verifyNoInteractions(eventPublisher);
  }

  /**
   * An unexpected failure — a dropped database connection rather than a rules violation — must be
   * reported to the participant as a generic internal error, not leak the underlying message.
   */
  @Test
  void unexpectedServiceFailuresBecomeAnInternalErrorRejection() {
    doThrow(new IllegalStateException("connection reset"))
        .when(answerService)
        .submitAnswer(eq(SESSION_ID), any());

    assertThatCode(() -> handler.submitAnswer(SESSION_ID, answer("req-1"), PARTICIPANT))
        .doesNotThrowAnyException();

    verify(eventPublisher)
        .publishAnswerRejected(
            "ws:1", "req-1", QUESTION_ID, "INTERNAL_ERROR", "Failed to save answer", false);
  }

  /** The same fallback applies to lock-in, flagged as a lock-in rejection. */
  @Test
  void unexpectedLockInFailuresBecomeAnInternalErrorRejection() {
    doThrow(new IllegalStateException("connection reset"))
        .when(answerService)
        .lockInAnswer(eq(SESSION_ID), any());

    assertThatCode(() -> handler.lockIn(SESSION_ID, lockIn("req-2"), PARTICIPANT))
        .doesNotThrowAnyException();

    verify(eventPublisher)
        .publishAnswerRejected(
            "ws:1", "req-2", QUESTION_ID, "INTERNAL_ERROR", "Failed to lock in answer", true);
  }

  /** A rules violation keeps its own code and message rather than being flattened. */
  @Test
  void applicationExceptionsKeepTheirCodeAndMessage() {
    doThrow(AppException.conflict("Question is no longer active"))
        .when(answerService)
        .submitAnswer(eq(SESSION_ID), any());

    handler.submitAnswer(SESSION_ID, answer("req-3"), PARTICIPANT);

    verify(eventPublisher)
        .publishAnswerRejected(
            "ws:1", "req-3", QUESTION_ID, "CONFLICT", "Question is no longer active", false);
    verify(eventPublisher, never())
        .publishAnswerAccepted(anyString(), anyString(), anyLong(), anyBoolean());
  }
}
