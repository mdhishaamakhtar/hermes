package dev.hishaam.hermes.ws;

import dev.hishaam.hermes.repository.QuizSessionRepository;
import dev.hishaam.hermes.repository.UserRepository;
import dev.hishaam.hermes.security.JwtUtil;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessageDeliveryException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

@Component
public class StompChannelInterceptor implements ChannelInterceptor {

  private static final Logger log = LoggerFactory.getLogger(StompChannelInterceptor.class);
  private static final Pattern ORGANISER_TOPIC =
      Pattern.compile("^/topic/session\\.(\\d+)\\.(analytics|control)$");

  private final JwtUtil jwtUtil;
  private final UserRepository userRepository;
  private final QuizSessionRepository sessionRepository;

  public StompChannelInterceptor(
      JwtUtil jwtUtil,
      UserRepository userRepository,
      @Lazy QuizSessionRepository sessionRepository) {
    this.jwtUtil = jwtUtil;
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
  }

  @Override
  public Message<?> preSend(Message<?> message, MessageChannel channel) {
    StompHeaderAccessor accessor =
        MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
    if (accessor == null) return message;

    if (StompCommand.CONNECT.equals(accessor.getCommand())) {
      String authHeader = accessor.getFirstNativeHeader("Authorization");
      if (authHeader != null && authHeader.startsWith("Bearer ")) {
        String token = authHeader.substring(7);
        if (jwtUtil.isValid(token)) {
          String email = jwtUtil.extractEmail(token);
          accessor.setUser(() -> email);
        }
      }
      if (accessor.getUser() == null) {
        String sessionId = accessor.getSessionId();
        accessor.setUser(() -> sessionId != null ? "ws:" + sessionId : "ws:anonymous");
      }
    } else if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
      String destination = accessor.getDestination();
      if (destination == null) return message;

      Matcher matcher = ORGANISER_TOPIC.matcher(destination);
      if (matcher.matches()) {
        Long sessionId = Long.parseLong(matcher.group(1));
        String principal = accessor.getUser() != null ? accessor.getUser().getName() : null;
        if (principal == null) {
          log.warn("Rejected unauthenticated SUBSCRIBE to {}", destination);
          throw new MessageDeliveryException(message, "Authentication required for " + destination);
        }
        var userOpt = userRepository.findByEmail(principal);
        if (userOpt.isEmpty()) {
          throw new MessageDeliveryException(message, "User not found");
        }
        var sessionOpt = sessionRepository.findByIdWithOwner(sessionId);
        if (sessionOpt.isEmpty()) {
          throw new MessageDeliveryException(message, "Session not found");
        }
        var session = sessionOpt.get();
        Long ownerId = session.getQuiz().getEvent().getUser().getId();
        if (!ownerId.equals(userOpt.get().getId())) {
          throw new MessageDeliveryException(message, "Forbidden: session not owned by user");
        }
      }
    }

    return message;
  }
}
