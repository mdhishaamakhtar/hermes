package dev.hishaam.hermes.exception;

import dev.hishaam.hermes.dto.ApiResponse;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.ErrorResponse;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/**
 * Translates exceptions into uniform {@link dev.hishaam.hermes.dto.ApiResponse} error responses.
 * Handles {@link AppException} (domain errors with explicit HTTP status), bean-validation failures,
 * the requests Spring MVC itself refuses — a malformed body, a missing header, an id that is not a
 * number, the wrong HTTP method — which keep the 4xx status the base class assigns them, and all
 * other unhandled exceptions (500 with a generic message to avoid leaking internals).
 */
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

  private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

  @ExceptionHandler(AppException.class)
  public ResponseEntity<ApiResponse<Void>> handleAppException(AppException ex) {
    return ResponseEntity.status(ex.getStatus())
        .body(ApiResponse.error(ex.getCode(), ex.getMessage()));
  }

  /**
   * A write lost a race for a unique key — in practice two copies of the same first answer arriving
   * together. The caller sent nothing wrong, so this is a conflict rather than a server fault.
   */
  @ExceptionHandler(DataIntegrityViolationException.class)
  public ResponseEntity<ApiResponse<Void>> handleDataIntegrity(DataIntegrityViolationException ex) {
    log.warn("Data integrity violation: {}", ex.getMostSpecificCause().getMessage());
    return ResponseEntity.status(HttpStatus.CONFLICT)
        .body(ApiResponse.error("CONFLICT", "The request conflicts with a concurrent change"));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ApiResponse<Void>> handleGeneric(Exception ex) {
    log.error("Unhandled exception", ex);
    return ResponseEntity.internalServerError()
        .body(ApiResponse.error("INTERNAL_ERROR", "An unexpected error occurred"));
  }

  @Override
  protected ResponseEntity<Object> handleMethodArgumentNotValid(
      MethodArgumentNotValidException ex,
      HttpHeaders headers,
      HttpStatusCode status,
      WebRequest request) {
    String message =
        ex.getBindingResult().getFieldErrors().stream()
            .map(FieldError::getDefaultMessage)
            .collect(Collectors.joining(", "));
    return ResponseEntity.badRequest().body(ApiResponse.error("VALIDATION_ERROR", message));
  }

  /** Every request Spring MVC refuses on its own ends up here; wrap it in the API's envelope. */
  @Override
  protected ResponseEntity<Object> handleExceptionInternal(
      Exception ex,
      Object body,
      HttpHeaders headers,
      HttpStatusCode statusCode,
      WebRequest request) {
    HttpStatus status = HttpStatus.valueOf(statusCode.value());
    String message =
        ex instanceof ErrorResponse response && response.getBody().getDetail() != null
            ? response.getBody().getDetail()
            : status.getReasonPhrase();
    return ResponseEntity.status(status)
        .headers(headers)
        .body(ApiResponse.error(status.name(), message));
  }
}
