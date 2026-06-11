package dev.hishaam.hermes.unit;

import static org.assertj.core.api.Assertions.assertThat;

import dev.hishaam.hermes.dto.ApiResponse;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;

/**
 * Unit tests for {@link GlobalExceptionHandler}.
 *
 * <p>This class verifies the HTTP status and error-code contract for every exception type the
 * handler translates: domain exceptions ({@link AppException}), bean-validation failures, and
 * unhandled exceptions. No database, Redis, or Spring MVC context is involved.
 */
class GlobalExceptionHandlerTest {

  private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

  /** Verifies that {@code NOT_FOUND} maps to HTTP 404 with code and message. */
  @Test
  void notFoundReturns404WithNotFoundCode() {
    ResponseEntity<ApiResponse<Void>> response =
        handler.handleAppException(AppException.notFound("Event not found"));

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    assertResponseError(response, "NOT_FOUND", "Event not found");
  }

  /** Verifies that {@code FORBIDDEN} maps to HTTP 403. */
  @Test
  void forbiddenReturns403() {
    ResponseEntity<ApiResponse<Void>> response =
        handler.handleAppException(AppException.forbidden("Access denied"));

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    assertResponseError(response, "FORBIDDEN", "Access denied");
  }

  /** Verifies that {@code CONFLICT} maps to HTTP 409. */
  @Test
  void conflictReturns409() {
    ResponseEntity<ApiResponse<Void>> response =
        handler.handleAppException(AppException.conflict("Quiz has an active session"));

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    assertResponseError(response, "CONFLICT", "Quiz has an active session");
  }

  /** Verifies that {@code BAD_REQUEST} maps to HTTP 400. */
  @Test
  void badRequestReturns400() {
    ResponseEntity<ApiResponse<Void>> response =
        handler.handleAppException(
            AppException.badRequest("Questions must have at least 2 options"));

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertResponseError(response, "BAD_REQUEST", "Questions must have at least 2 options");
  }

  /** Verifies that {@code UNAUTHORIZED} maps to HTTP 401. */
  @Test
  void unauthorizedReturns401() {
    ResponseEntity<ApiResponse<Void>> response =
        handler.handleAppException(AppException.unauthorized("Invalid token"));

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    assertResponseError(response, "UNAUTHORIZED", "Invalid token");
  }

  /** Verifies that {@code INTERNAL_ERROR} maps to HTTP 500. */
  @Test
  void internalErrorReturns500() {
    ResponseEntity<ApiResponse<Void>> response =
        handler.handleAppException(AppException.internalError("Something went wrong"));

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    assertResponseError(response, "INTERNAL_ERROR", "Something went wrong");
  }

  /**
   * Verifies that bean-validation failures produce HTTP 400 with the {@code VALIDATION_ERROR} code
   * and aggregated field-error messages.
   */
  @Test
  void validationFailureReturns400WithAggregatedMessages() {
    BeanPropertyBindingResult bindingResult = new BeanPropertyBindingResult(new Object(), "target");
    bindingResult.addError(new FieldError("target", "title", "Title is required"));
    bindingResult.addError(new FieldError("target", "email", "Email must be valid"));
    MethodArgumentNotValidException ex = new MethodArgumentNotValidException(null, bindingResult);

    ResponseEntity<ApiResponse<Void>> response = handler.handleValidation(ex);

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    assertThat(requireBody(response).error().code()).isEqualTo("VALIDATION_ERROR");
    assertThat(requireBody(response).error().message())
        .contains("Title is required")
        .contains("Email must be valid");
  }

  /**
   * Verifies that unexpected exceptions produce HTTP 500 with a generic message that does not leak
   * internal details.
   */
  @Test
  void genericExceptionReturns500WithOpaqueMessage() {
    ResponseEntity<ApiResponse<Void>> response =
        handler.handleGeneric(new RuntimeException("DB connection refused"));

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    assertThat(requireBody(response).error().code()).isEqualTo("INTERNAL_ERROR");
    assertThat(requireBody(response).error().message()).isEqualTo("An unexpected error occurred");
  }

  private static void assertResponseError(
      ResponseEntity<ApiResponse<Void>> response, String code, String message) {
    assertThat(requireBody(response).error().code()).isEqualTo(code);
    assertThat(requireBody(response).error().message()).isEqualTo(message);
  }

  private static ApiResponse<Void> requireBody(ResponseEntity<ApiResponse<Void>> response) {
    assertThat(response.hasBody()).isTrue();
    ApiResponse<Void> body = response.getBody();
    assertThat(body).isNotNull();
    assertThat(body.success()).isFalse();
    assertThat(body.error()).isNotNull();
    return body;
  }
}
