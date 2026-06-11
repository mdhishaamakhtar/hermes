package dev.hishaam.hermes.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/**
 * Application-level exception that carries an HTTP status and a machine-readable error code. Caught
 * and serialised into a uniform {@link dev.hishaam.hermes.dto.ApiResponse} by {@link
 * GlobalExceptionHandler}. Use the static factory methods rather than calling the constructor
 * directly.
 */
@Getter
public class AppException extends RuntimeException {

  private final HttpStatus status;
  private final String code;

  public AppException(HttpStatus status, String code, String message) {
    super(message);
    this.status = status;
    this.code = code;
  }

  public static AppException notFound(String message) {
    return new AppException(HttpStatus.NOT_FOUND, "NOT_FOUND", message);
  }

  public static AppException forbidden(String message) {
    return new AppException(HttpStatus.FORBIDDEN, "FORBIDDEN", message);
  }

  public static AppException conflict(String message) {
    return new AppException(HttpStatus.CONFLICT, "CONFLICT", message);
  }

  public static AppException badRequest(String message) {
    return new AppException(HttpStatus.BAD_REQUEST, "BAD_REQUEST", message);
  }

  public static AppException unauthorized(String message) {
    return new AppException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", message);
  }

  public static AppException internalError(String message) {
    return new AppException(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", message);
  }
}
