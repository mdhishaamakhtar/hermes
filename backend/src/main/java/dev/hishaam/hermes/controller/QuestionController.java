package dev.hishaam.hermes.controller;

import dev.hishaam.hermes.dto.ApiResponse;
import dev.hishaam.hermes.dto.CreateQuestionRequest;
import dev.hishaam.hermes.dto.QuestionResponse;
import dev.hishaam.hermes.dto.UpdateQuestionRequest;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.UserRepository;
import dev.hishaam.hermes.service.QuestionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@PreAuthorize("isAuthenticated()")
public class QuestionController {

  private final QuestionService questionService;
  private final UserRepository userRepository;

  public QuestionController(QuestionService questionService, UserRepository userRepository) {
    this.questionService = questionService;
    this.userRepository = userRepository;
  }

  @PostMapping("/api/quizzes/{quizId}/questions")
  public ResponseEntity<ApiResponse<QuestionResponse>> createQuestion(
      @PathVariable Long quizId,
      @Valid @RequestBody CreateQuestionRequest request,
      @AuthenticationPrincipal UserDetails userDetails) {
    Long userId = resolveUserId(userDetails);
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ApiResponse.ok(questionService.createQuestion(quizId, request, userId)));
  }

  @PutMapping("/api/questions/{id}")
  public ResponseEntity<ApiResponse<QuestionResponse>> updateQuestion(
      @PathVariable Long id,
      @Valid @RequestBody UpdateQuestionRequest request,
      @AuthenticationPrincipal UserDetails userDetails) {
    Long userId = resolveUserId(userDetails);
    return ResponseEntity.ok(ApiResponse.ok(questionService.updateQuestion(id, request, userId)));
  }

  @DeleteMapping("/api/questions/{id}")
  public ResponseEntity<ApiResponse<Void>> deleteQuestion(
      @PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
    Long userId = resolveUserId(userDetails);
    questionService.deleteQuestion(id, userId);
    return ResponseEntity.ok(ApiResponse.ok(null));
  }

  private Long resolveUserId(UserDetails userDetails) {
    return userRepository
        .findByEmail(userDetails.getUsername())
        .orElseThrow(() -> AppException.notFound("User not found"))
        .getId();
  }
}
