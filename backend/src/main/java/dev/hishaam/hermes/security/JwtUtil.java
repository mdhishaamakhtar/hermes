package dev.hishaam.hermes.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * JWT generation and validation for organizer sessions. Tokens are signed with HMAC-SHA and contain
 * the organizer's email address as the subject. The secret and expiry are configured via {@code
 * jwt.secret} and {@code jwt.expiration-ms} application properties.
 */
@Component
public class JwtUtil {

  private final SecretKey key;
  private final long expirationMs;

  public JwtUtil(
      @Value("${jwt.secret}") String secret, @Value("${jwt.expiration-ms}") long expirationMs) {
    this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    this.expirationMs = expirationMs;
  }

  /** Generates a signed JWT with the given email as the subject. */
  public String generateToken(String email) {
    return Jwts.builder()
        .subject(email)
        .issuedAt(new Date())
        .expiration(new Date(System.currentTimeMillis() + expirationMs))
        .signWith(key)
        .compact();
  }

  /** Extracts the email (subject) from a token. Throws if the token is invalid or expired. */
  public String extractEmail(String token) {
    return parseClaims(token).getPayload().getSubject();
  }

  /** Returns {@code true} if the token has a valid signature and has not expired. */
  public boolean isValid(String token) {
    try {
      parseClaims(token);
      return true;
    } catch (JwtException | IllegalArgumentException e) {
      return false;
    }
  }

  private Jws<Claims> parseClaims(String token) {
    return Jwts.parser().verifyWith(key).build().parseSignedClaims(token);
  }
}
