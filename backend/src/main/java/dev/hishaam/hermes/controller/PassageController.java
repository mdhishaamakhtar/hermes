package dev.hishaam.hermes.controller;

import dev.hishaam.hermes.dto.ApiResponse;
import dev.hishaam.hermes.dto.CreatePassageRequest;
import dev.hishaam.hermes.dto.CreateQuestionRequest;
import dev.hishaam.hermes.dto.PassageResponse;
import dev.hishaam.hermes.dto.QuestionResponse;
import dev.hishaam.hermes.dto.UpdatePassageRequest;
import dev.hishaam.hermes.security.AuthenticatedUser;
import dev.hishaam.hermes.service.PassageService;
import dev.hishaam.hermes.service.QuestionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@PreAuthorize("isAuthenticated()")
public class PassageController {

  private final PassageService passageService;
  private final QuestionService questionService;

  public PassageController(PassageService passageService, QuestionService questionService) {
    this.passageService = passageService;
    this.questionService = questionService;
  }

  @PostMapping("/api/quizzes/{quizId}/passages")
  public ResponseEntity<ApiResponse<PassageResponse>> createPassage(
      @PathVariable Long quizId,
      @Valid @RequestBody CreatePassageRequest request,
      @AuthenticationPrincipal AuthenticatedUser user) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ApiResponse.ok(passageService.createPassage(quizId, request, user.getId())));
  }

  @PutMapping("/api/passages/{id}")
  public ResponseEntity<ApiResponse<PassageResponse>> updatePassage(
      @PathVariable Long id,
      @Valid @RequestBody UpdatePassageRequest request,
      @AuthenticationPrincipal AuthenticatedUser user) {
    return ResponseEntity.ok(
        ApiResponse.ok(passageService.updatePassage(id, request, user.getId())));
  }

  @DeleteMapping("/api/passages/{id}")
  public ResponseEntity<ApiResponse<Void>> deletePassage(
      @PathVariable Long id, @AuthenticationPrincipal AuthenticatedUser user) {
    passageService.deletePassage(id, user.getId());
    return ResponseEntity.ok(ApiResponse.ok(null));
  }

  @PostMapping("/api/passages/{passageId}/questions")
  public ResponseEntity<ApiResponse<QuestionResponse>> createPassageQuestion(
      @PathVariable Long passageId,
      @Valid @RequestBody CreateQuestionRequest request,
      @AuthenticationPrincipal AuthenticatedUser user) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(
            ApiResponse.ok(
                questionService.createPassageQuestion(passageId, request, user.getId())));
  }
}
