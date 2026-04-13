package dev.hishaam.hermes.controller;

import dev.hishaam.hermes.dto.ApiResponse;
import dev.hishaam.hermes.dto.CreateQuizRequest;
import dev.hishaam.hermes.dto.QuizResponse;
import dev.hishaam.hermes.dto.UpdateQuizRequest;
import dev.hishaam.hermes.dto.session.QuizSessionListResponse;
import dev.hishaam.hermes.security.AuthenticatedUser;
import dev.hishaam.hermes.service.QuizService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@PreAuthorize("isAuthenticated()")
public class QuizController {

  private final QuizService quizService;

  public QuizController(QuizService quizService) {
    this.quizService = quizService;
  }

  @PostMapping("/api/events/{eventId}/quizzes")
  public ResponseEntity<ApiResponse<QuizResponse>> createQuiz(
      @PathVariable Long eventId,
      @Valid @RequestBody CreateQuizRequest request,
      @AuthenticationPrincipal AuthenticatedUser user) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ApiResponse.ok(quizService.createQuiz(eventId, request, user.getId())));
  }

  @GetMapping("/api/quizzes/{id}")
  public ResponseEntity<ApiResponse<QuizResponse>> getQuiz(
      @PathVariable Long id, @AuthenticationPrincipal AuthenticatedUser user) {
    return ResponseEntity.ok(ApiResponse.ok(quizService.getQuiz(id, user.getId())));
  }

  @PutMapping("/api/quizzes/{id}")
  public ResponseEntity<ApiResponse<QuizResponse>> updateQuiz(
      @PathVariable Long id,
      @Valid @RequestBody UpdateQuizRequest request,
      @AuthenticationPrincipal AuthenticatedUser user) {
    return ResponseEntity.ok(ApiResponse.ok(quizService.updateQuiz(id, request, user.getId())));
  }

  @DeleteMapping("/api/quizzes/{id}")
  public ResponseEntity<ApiResponse<Void>> deleteQuiz(
      @PathVariable Long id, @AuthenticationPrincipal AuthenticatedUser user) {
    quizService.deleteQuiz(id, user.getId());
    return ResponseEntity.ok(ApiResponse.ok(null));
  }

  @GetMapping("/api/quizzes/{id}/sessions")
  public ResponseEntity<ApiResponse<List<QuizSessionListResponse>>> listSessions(
      @PathVariable Long id, @AuthenticationPrincipal AuthenticatedUser user) {
    return ResponseEntity.ok(ApiResponse.ok(quizService.listSessions(id, user.getId())));
  }
}
