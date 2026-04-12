package dev.hishaam.hermes.service.session;

import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.redis.SessionJoinCodeRedisRepository;
import java.security.SecureRandom;
import org.springframework.stereotype.Service;

/** Generates and reserves short join codes for new sessions (Redis-backed uniqueness). */
@Service
public class SessionJoinCodeService {

  private static final SecureRandom SECURE_RANDOM = new SecureRandom();
  private static final String JOIN_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  private final SessionJoinCodeRedisRepository joinCodeRedis;

  public SessionJoinCodeService(SessionJoinCodeRedisRepository joinCodeRedis) {
    this.joinCodeRedis = joinCodeRedis;
  }

  public String generateJoinCode() {
    for (int attempt = 0; attempt < 10; attempt++) {
      StringBuilder code = new StringBuilder(6);
      for (int i = 0; i < 6; i++) {
        code.append(JOIN_CODE_CHARS.charAt(SECURE_RANDOM.nextInt(JOIN_CODE_CHARS.length())));
      }
      String candidate = code.toString();
      if (joinCodeRedis.tryReserveJoinCode(candidate)) {
        return candidate;
      }
    }
    throw AppException.internalError("Failed to generate unique join code");
  }
}
