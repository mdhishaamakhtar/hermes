package dev.hishaam.hermes.ws;

import dev.hishaam.hermes.dto.AnswerRequest;
import dev.hishaam.hermes.dto.LockInRequest;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.service.AnswerService;
import dev.hishaam.hermes.service.SessionEventPublisher;
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
    try {
      answerService.submitAnswer(sessionId, request);
      sendAccepted(principal, request.clientRequestId(), request.questionId(), false);
    } catch (AppException e) {
      sendRejected(principal, request.clientRequestId(), request.questionId(), e, false);
      log.warn("Answer submission failed for session {}: {}", sessionId, e.getMessage());
    } catch (Exception e) {
      sendRejected(
          principal,
          request.clientRequestId(),
          request.questionId(),
          AppException.internalError("Failed to save answer"),
          false);
      log.warn("Answer submission failed for session {}: {}", sessionId, e.getMessage());
    }
  }

  @MessageMapping("/session/{sessionId}/lock-in")
  public void lockIn(
      @DestinationVariable Long sessionId, @Payload LockInRequest request, Principal principal) {
    try {
      answerService.lockInAnswer(sessionId, request);
      sendAccepted(principal, request.clientRequestId(), request.questionId(), true);
    } catch (AppException e) {
      sendRejected(principal, request.clientRequestId(), request.questionId(), e, true);
      log.warn("Lock-in failed for session {}: {}", sessionId, e.getMessage());
    } catch (Exception e) {
      sendRejected(
          principal,
          request.clientRequestId(),
          request.questionId(),
          AppException.internalError("Failed to lock in answer"),
          true);
      log.warn("Lock-in failed for session {}: {}", sessionId, e.getMessage());
    }
  }

  private void sendAccepted(
      Principal principal, String clientRequestId, Long questionId, boolean lockedIn) {
    if (principal == null || clientRequestId == null || clientRequestId.isBlank()) return;
    eventPublisher.publishAnswerAccepted(
        principal.getName(), clientRequestId, questionId, lockedIn);
  }

  private void sendRejected(
      Principal principal,
      String clientRequestId,
      Long questionId,
      AppException exception,
      boolean lockedIn) {
    if (principal == null || clientRequestId == null || clientRequestId.isBlank()) return;
    eventPublisher.publishAnswerRejected(
        principal.getName(),
        clientRequestId,
        questionId,
        exception.getCode(),
        exception.getMessage(),
        lockedIn);
  }
}
