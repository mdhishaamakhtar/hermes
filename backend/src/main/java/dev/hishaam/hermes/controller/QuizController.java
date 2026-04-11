package dev.hishaam.hermes.controller;

import dev.hishaam.hermes.dto.ApiResponse;
import dev.hishaam.hermes.dto.CreateQuizRequest;
import dev.hishaam.hermes.dto.QuizResponse;
import dev.hishaam.hermes.dto.UpdateQuizRequest;
import dev.hishaam.hermes.dto.session.QuizSessionListResponse;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.UserRepository;
import dev.hishaam.hermes.service.QuizService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@PreAuthorize("isAuthenticated()")
public class QuizController {

  private final QuizService quizService;
  private final UserRepository userRepository;

  public QuizController(QuizService quizService, UserRepository userRepository) {
    this.quizService = quizService;
    this.userRepository = userRepository;
  }

  @PostMapping("/api/events/{eventId}/quizzes")
  public ResponseEntity<ApiResponse<QuizResponse>> createQuiz(
      @PathVariable Long eventId,
      @Valid @RequestBody CreateQuizRequest request,
      @AuthenticationPrincipal UserDetails userDetails) {
    Long userId = resolveUserId(userDetails);
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ApiResponse.ok(quizService.createQuiz(eventId, request, userId)));
  }

  @GetMapping("/api/quizzes/{id}")
  public ResponseEntity<ApiResponse<QuizResponse>> getQuiz(
      @PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
    Long userId = resolveUserId(userDetails);
    return ResponseEntity.ok(ApiResponse.ok(quizService.getQuiz(id, userId)));
  }

  @PutMapping("/api/quizzes/{id}")
  public ResponseEntity<ApiResponse<QuizResponse>> updateQuiz(
      @PathVariable Long id,
      @Valid @RequestBody UpdateQuizRequest request,
      @AuthenticationPrincipal UserDetails userDetails) {
    Long userId = resolveUserId(userDetails);
    return ResponseEntity.ok(ApiResponse.ok(quizService.updateQuiz(id, request, userId)));
  }

  @DeleteMapping("/api/quizzes/{id}")
  public ResponseEntity<ApiResponse<Void>> deleteQuiz(
      @PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
    Long userId = resolveUserId(userDetails);
    quizService.deleteQuiz(id, userId);
    return ResponseEntity.ok(ApiResponse.ok(null));
  }

  @GetMapping("/api/quizzes/{id}/sessions")
  public ResponseEntity<ApiResponse<List<QuizSessionListResponse>>> listSessions(
      @PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
    Long userId = resolveUserId(userDetails);
    return ResponseEntity.ok(ApiResponse.ok(quizService.listSessions(id, userId)));
  }

  private Long resolveUserId(UserDetails userDetails) {
    return userRepository
        .findByEmail(userDetails.getUsername())
        .orElseThrow(() -> AppException.notFound("User not found"))
        .getId();
  }
}
