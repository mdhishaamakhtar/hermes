package dev.hishaam.hermes.unit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.hishaam.hermes.security.JwtUtil;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for JWT token generation and validation.
 *
 * <p>This class covers the pure token behavior exposed by {@link JwtUtil}: signing, extracting the
 * subject, and rejecting malformed or expired tokens. It stays at the utility boundary and does
 * not depend on Spring MVC, persistence, or HTTP controllers.
 */
class JwtUtilTest {

  private static final String SECRET =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  private final JwtUtil jwtUtil = new JwtUtil(SECRET, 60_000L);

  /**
   * Verifies that a freshly generated token validates successfully and preserves the organizer
   * email as its JWT subject.
   */
  @Test
  void generatesValidTokenThatRoundTripsTheEmailSubject() {
    String token = jwtUtil.generateToken("organizer@example.com");

    assertThat(jwtUtil.isValid(token)).isTrue();
    assertThat(jwtUtil.extractEmail(token)).isEqualTo("organizer@example.com");
  }

  /**
   * Verifies that malformed input is rejected by both validation and subject extraction.
   */
  @Test
  void rejectsMalformedTokens() {
    assertThat(jwtUtil.isValid("not-a-jwt")).isFalse();
    assertThatThrownBy(() -> jwtUtil.extractEmail("not-a-jwt"))
        .isInstanceOf(JwtException.class);
  }

  /**
   * Verifies that expired tokens are rejected even when they are signed with the correct secret.
   */
  @Test
  void rejectsExpiredTokens() {
    SecretKey key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
    String expiredToken =
        Jwts.builder()
            .subject("expired@example.com")
            .issuedAt(new Date(System.currentTimeMillis() - 10_000L))
            .expiration(new Date(System.currentTimeMillis() - 1_000L))
            .signWith(key)
            .compact();

    assertThat(jwtUtil.isValid(expiredToken)).isFalse();
    assertThatThrownBy(() -> jwtUtil.extractEmail(expiredToken))
        .isInstanceOf(JwtException.class);
  }
}
