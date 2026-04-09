package dev.hishaam.hermes.service;

import dev.hishaam.hermes.exception.AppException;
import java.security.SecureRandom;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

@Service
public class SessionCodeService {

  private static final SecureRandom SECURE_RANDOM = new SecureRandom();
  private static final String JOIN_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  private static final String TOKEN_CHARS =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  private final StringRedisTemplate redis;
  private final SessionRedisHelper redisHelper;

  public SessionCodeService(StringRedisTemplate redis, SessionRedisHelper redisHelper) {
    this.redis = redis;
    this.redisHelper = redisHelper;
  }

  public String generateJoinCode() {
    for (int attempt = 0; attempt < 10; attempt++) {
      StringBuilder code = new StringBuilder(6);
      for (int i = 0; i < 6; i++) {
        code.append(JOIN_CODE_CHARS.charAt(SECURE_RANDOM.nextInt(JOIN_CODE_CHARS.length())));
      }
      String candidate = code.toString();
      Boolean reserved =
          redis
              .opsForValue()
              .setIfAbsent(
                  redisHelper.joinCodeKey(candidate),
                  "reserving",
                  SessionRedisHelper.SESSION_TTL);
      if (Boolean.TRUE.equals(reserved)) {
        return candidate;
      }
    }
    throw AppException.internalError("Failed to generate unique join code");
  }

  public String generateRejoinToken() {
    StringBuilder token = new StringBuilder(32);
    for (int i = 0; i < 32; i++) {
      token.append(TOKEN_CHARS.charAt(SECURE_RANDOM.nextInt(TOKEN_CHARS.length())));
    }
    return token.toString();
  }
}
