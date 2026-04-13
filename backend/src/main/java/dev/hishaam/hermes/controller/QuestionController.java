package dev.hishaam.hermes.controller;

import dev.hishaam.hermes.dto.ApiResponse;
import dev.hishaam.hermes.dto.CreateQuestionRequest;
import dev.hishaam.hermes.dto.QuestionResponse;
import dev.hishaam.hermes.dto.UpdateQuestionRequest;
import dev.hishaam.hermes.security.AuthenticatedUser;
import dev.hishaam.hermes.service.QuestionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@PreAuthorize("isAuthenticated()")
public class QuestionController {

  private final QuestionService questionService;

  public QuestionController(QuestionService questionService) {
    this.questionService = questionService;
  }

  @PostMapping("/api/quizzes/{quizId}/questions")
  public ResponseEntity<ApiResponse<QuestionResponse>> createQuestion(
      @PathVariable Long quizId,
      @Valid @RequestBody CreateQuestionRequest request,
      @AuthenticationPrincipal AuthenticatedUser user) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ApiResponse.ok(questionService.createQuestion(quizId, request, user.getId())));
  }

  @PutMapping("/api/questions/{id}")
  public ResponseEntity<ApiResponse<QuestionResponse>> updateQuestion(
      @PathVariable Long id,
      @Valid @RequestBody UpdateQuestionRequest request,
      @AuthenticationPrincipal AuthenticatedUser user) {
    return ResponseEntity.ok(
        ApiResponse.ok(questionService.updateQuestion(id, request, user.getId())));
  }

  @DeleteMapping("/api/questions/{id}")
  public ResponseEntity<ApiResponse<Void>> deleteQuestion(
      @PathVariable Long id, @AuthenticationPrincipal AuthenticatedUser user) {
    questionService.deleteQuestion(id, user.getId());
    return ResponseEntity.ok(ApiResponse.ok(null));
  }
}
