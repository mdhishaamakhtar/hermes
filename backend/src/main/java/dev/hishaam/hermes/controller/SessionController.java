package dev.hishaam.hermes.controller;

import dev.hishaam.hermes.dto.*;
import dev.hishaam.hermes.entity.SessionStatus;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.UserRepository;
import dev.hishaam.hermes.service.ParticipantService;
import dev.hishaam.hermes.service.AnswerService;
import dev.hishaam.hermes.service.SessionResultsService;
import dev.hishaam.hermes.service.SessionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sessions")
public class SessionController {

  private final SessionService sessionService;
  private final ParticipantService participantService;
  private final AnswerService answerService;
  private final SessionResultsService resultsService;
  private final UserRepository userRepository;

  public SessionController(
      SessionService sessionService,
      ParticipantService participantService,
      AnswerService answerService,
      SessionResultsService resultsService,
      UserRepository userRepository) {
    this.sessionService = sessionService;
    this.participantService = participantService;
    this.answerService = answerService;
    this.resultsService = resultsService;
    this.userRepository = userRepository;
  }

  @PostMapping
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<ApiResponse<SessionResponse>> createSession(
      @Valid @RequestBody CreateSessionRequest request,
      @AuthenticationPrincipal UserDetails userDetails) {
    Long userId = resolveUserId(userDetails);
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ApiResponse.ok(sessionService.createSession(request, userId)));
  }

  @PostMapping("/{id}/start")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<ApiResponse<Void>> startSession(
      @PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
    Long userId = resolveUserId(userDetails);
    sessionService.startSession(id, userId);
    return ResponseEntity.ok(ApiResponse.ok(null));
  }

  @PostMapping("/{id}/next")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<ApiResponse<Void>> nextQuestion(
      @PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
    Long userId = resolveUserId(userDetails);
    sessionService.advanceSession(id, userId);
    return ResponseEntity.ok(ApiResponse.ok(null));
  }

  @PostMapping("/{id}/end")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<ApiResponse<Void>> endSession(
      @PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
    Long userId = resolveUserId(userDetails);
    sessionService.endSessionByOrganiser(id, userId);
    return ResponseEntity.ok(ApiResponse.ok(null));
  }

  @GetMapping("/{id}/status")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<ApiResponse<SessionStatus>> getSessionStatus(
      @PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
    Long userId = resolveUserId(userDetails);
    return ResponseEntity.ok(ApiResponse.ok(sessionService.getSessionStatus(id, userId)));
  }

  @GetMapping("/{id}/lobby")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<ApiResponse<LobbyStateResponse>> getLobbyState(
      @PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
    Long userId = resolveUserId(userDetails);
    return ResponseEntity.ok(ApiResponse.ok(sessionService.getLobbyState(id, userId)));
  }

  @GetMapping("/{id}/results")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<ApiResponse<SessionResultsResponse>> getResults(
      @PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
    Long userId = resolveUserId(userDetails);
    return ResponseEntity.ok(ApiResponse.ok(resultsService.getResults(id, userId)));
  }

  @PostMapping("/join")
  public ResponseEntity<ApiResponse<JoinResponse>> joinSession(
      @Valid @RequestBody JoinSessionRequest request) {
    return ResponseEntity.ok(ApiResponse.ok(participantService.joinSession(request)));
  }

  @PostMapping("/rejoin")
  public ResponseEntity<ApiResponse<RejoinResponse>> rejoinSession(
      @Valid @RequestBody RejoinRequest request) {
    return ResponseEntity.ok(ApiResponse.ok(participantService.rejoinSession(request)));
  }

  @GetMapping("/{id}/my-results")
  public ResponseEntity<ApiResponse<MyResultsResponse>> getMyResults(
      @PathVariable Long id, @RequestHeader("X-Rejoin-Token") String rejoinToken) {
    return ResponseEntity.ok(ApiResponse.ok(resultsService.getMyResults(id, rejoinToken)));
  }

  @PostMapping("/{id}/answers")
  public ResponseEntity<ApiResponse<Void>> submitAnswer(
      @PathVariable Long id, @Valid @RequestBody AnswerRequest request) {
    answerService.submitAnswer(id, request);
    return ResponseEntity.ok(ApiResponse.ok(null));
  }

  @PostMapping("/{id}/lock-in")
  public ResponseEntity<ApiResponse<Void>> lockIn(
      @PathVariable Long id, @Valid @RequestBody LockInRequest request) {
    answerService.lockInAnswer(id, request);
    return ResponseEntity.ok(ApiResponse.ok(null));
  }

  private Long resolveUserId(UserDetails userDetails) {
    return userRepository
        .findByEmail(userDetails.getUsername())
        .orElseThrow(() -> AppException.notFound("User not found"))
        .getId();
  }
}
