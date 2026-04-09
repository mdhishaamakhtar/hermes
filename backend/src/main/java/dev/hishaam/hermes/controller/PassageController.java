package dev.hishaam.hermes.controller;

import dev.hishaam.hermes.dto.ApiResponse;
import dev.hishaam.hermes.dto.CreatePassageRequest;
import dev.hishaam.hermes.dto.CreateQuestionRequest;
import dev.hishaam.hermes.dto.PassageResponse;
import dev.hishaam.hermes.dto.QuestionResponse;
import dev.hishaam.hermes.dto.UpdatePassageRequest;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.UserRepository;
import dev.hishaam.hermes.service.PassageService;
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
public class PassageController {

  private final PassageService passageService;
  private final QuestionService questionService;
  private final UserRepository userRepository;

  public PassageController(
      PassageService passageService,
      QuestionService questionService,
      UserRepository userRepository) {
    this.passageService = passageService;
    this.questionService = questionService;
    this.userRepository = userRepository;
  }

  @PostMapping("/api/quizzes/{quizId}/passages")
  public ResponseEntity<ApiResponse<PassageResponse>> createPassage(
      @PathVariable Long quizId,
      @Valid @RequestBody CreatePassageRequest request,
      @AuthenticationPrincipal UserDetails userDetails) {
    Long userId = resolveUserId(userDetails);
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ApiResponse.ok(passageService.createPassage(quizId, request, userId)));
  }

  @PutMapping("/api/passages/{id}")
  public ResponseEntity<ApiResponse<PassageResponse>> updatePassage(
      @PathVariable Long id,
      @Valid @RequestBody UpdatePassageRequest request,
      @AuthenticationPrincipal UserDetails userDetails) {
    Long userId = resolveUserId(userDetails);
    return ResponseEntity.ok(ApiResponse.ok(passageService.updatePassage(id, request, userId)));
  }

  @DeleteMapping("/api/passages/{id}")
  public ResponseEntity<ApiResponse<Void>> deletePassage(
      @PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
    Long userId = resolveUserId(userDetails);
    passageService.deletePassage(id, userId);
    return ResponseEntity.ok(ApiResponse.ok(null));
  }

  @PostMapping("/api/passages/{passageId}/questions")
  public ResponseEntity<ApiResponse<QuestionResponse>> createPassageQuestion(
      @PathVariable Long passageId,
      @Valid @RequestBody CreateQuestionRequest request,
      @AuthenticationPrincipal UserDetails userDetails) {
    Long userId = resolveUserId(userDetails);
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ApiResponse.ok(questionService.createPassageQuestion(passageId, request, userId)));
  }

  private Long resolveUserId(UserDetails userDetails) {
    return userRepository
        .findByEmail(userDetails.getUsername())
        .orElseThrow(() -> AppException.notFound("User not found"))
        .getId();
  }
}
