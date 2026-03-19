package dev.hishaam.hermes.ws;

import dev.hishaam.hermes.dto.AnswerRequest;
import dev.hishaam.hermes.service.AnswerService;
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

  public AnswerWebSocketHandler(AnswerService answerService) {
    this.answerService = answerService;
  }

  @MessageMapping("/session/{sessionId}/answer")
  public void submitAnswer(@DestinationVariable Long sessionId, @Payload AnswerRequest request) {
    try {
      answerService.submitAnswer(sessionId, request);
    } catch (Exception e) {
      log.warn("Answer submission failed for session {}: {}", sessionId, e.getMessage());
    }
  }
}
