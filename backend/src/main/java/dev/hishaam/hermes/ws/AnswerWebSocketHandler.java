package dev.hishaam.hermes.ws;

import dev.hishaam.hermes.dto.session.AnswerRequest;
import dev.hishaam.hermes.dto.session.LockInRequest;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.service.AnswerService;
import dev.hishaam.hermes.service.session.SessionEventPublisher;
import java.security.Principal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

@Controller
public class AnswerWebSocketHandler {

  private static final Logger log = LoggerFactory.getLogger(AnswerWebSocketHandler.class);

  private final AnswerService answerService;
  private final SessionEventPublisher eventPublisher;

  public AnswerWebSocketHandler(AnswerService answerService, SessionEventPublisher eventPublisher) {
    this.answerService = answerService;
    this.eventPublisher = eventPublisher;
  }

  @MessageMapping("/session/{sessionId}/answer")
  public void submitAnswer(
      @DestinationVariable Long sessionId, @Payload AnswerRequest request, Principal principal) {
    acknowledge(
        principal,
        request.clientRequestId(),
        request.questionId(),
        false,
        "Failed to save answer",
        () -> answerService.submitAnswer(sessionId, request));
  }

  @MessageMapping("/session/{sessionId}/lock-in")
  public void lockIn(
      @DestinationVariable Long sessionId, @Payload LockInRequest request, Principal principal) {
    acknowledge(
        principal,
        request.clientRequestId(),
        request.questionId(),
        true,
        "Failed to lock in answer",
        () -> answerService.lockInAnswer(sessionId, request));
  }

  /**
   * Runs the action and tells the sender how it went on their private queue. There is nobody to
   * tell when the frame carries no correlation id or the connection has no principal, so those are
   * processed without an acknowledgement.
   */
  private void acknowledge(
      Principal principal,
      String clientRequestId,
      Long questionId,
      boolean lockedIn,
      String failureMessage,
      Runnable action) {
    boolean addressable =
        principal != null && clientRequestId != null && !clientRequestId.isBlank();
    try {
      action.run();
      if (addressable) {
        eventPublisher.publishAnswerAccepted(
            principal.getName(), clientRequestId, questionId, lockedIn);
      }
    } catch (Exception e) {
      log.warn("{} for question {}: {}", failureMessage, questionId, e.getMessage());
      AppException rejection =
          e instanceof AppException known ? known : AppException.internalError(failureMessage);
      if (addressable) {
        eventPublisher.publishAnswerRejected(
            principal.getName(),
            clientRequestId,
            questionId,
            rejection.getCode(),
            rejection.getMessage(),
            lockedIn);
      }
    }
  }
}
