package dev.hishaam.hermes.controller;

import dev.hishaam.hermes.dto.*;
import dev.hishaam.hermes.dto.session.*;
import dev.hishaam.hermes.entity.SessionStatus;
import dev.hishaam.hermes.security.AuthenticatedUser;
import dev.hishaam.hermes.service.AnswerService;
import dev.hishaam.hermes.service.ParticipantService;
import dev.hishaam.hermes.service.session.SessionResultsService;
import dev.hishaam.hermes.service.session.SessionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/sessions")
public class SessionController {

  private final SessionService sessionService;
  private final ParticipantService participantService;
  private final AnswerService answerService;
  private final SessionResultsService resultsService;

  public SessionController(
      SessionService sessionService,
      ParticipantService participantService,
      AnswerService answerService,
      SessionResultsService resultsService) {
    this.sessionService = sessionService;
    this.participantService = participantService;
    this.answerService = answerService;
    this.resultsService = resultsService;
  }

  @PostMapping
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<ApiResponse<SessionResponse>> createSession(
      @Valid @RequestBody CreateSessionRequest request,
      @AuthenticationPrincipal AuthenticatedUser user) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ApiResponse.ok(sessionService.createSession(request, user.getId())));
  }

  @PostMapping("/{id}/start")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<ApiResponse<Void>> startSession(
      @PathVariable Long id, @AuthenticationPrincipal AuthenticatedUser user) {
    sessionService.startSession(id, user.getId());
    return ResponseEntity.ok(ApiResponse.ok(null));
  }

  @PostMapping("/{id}/start-timer")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<ApiResponse<Void>> startTimer(
      @PathVariable Long id, @AuthenticationPrincipal AuthenticatedUser user) {
    sessionService.startTimer(id, user.getId());
    return ResponseEntity.ok(ApiResponse.ok(null));
  }

  @PostMapping("/{id}/end-timer")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<ApiResponse<Void>> endTimerEarly(
      @PathVariable Long id, @AuthenticationPrincipal AuthenticatedUser user) {
    sessionService.endTimerEarly(id, user.getId());
    return ResponseEntity.ok(ApiResponse.ok(null));
  }

  @PostMapping("/{id}/next")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<ApiResponse<Void>> nextQuestion(
      @PathVariable Long id, @AuthenticationPrincipal AuthenticatedUser user) {
    sessionService.advanceSession(id, user.getId());
    return ResponseEntity.ok(ApiResponse.ok(null));
  }

  @PostMapping("/{id}/end")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<ApiResponse<Void>> endSession(
      @PathVariable Long id, @AuthenticationPrincipal AuthenticatedUser user) {
    sessionService.endSessionByOrganiser(id, user.getId());
    return ResponseEntity.ok(ApiResponse.ok(null));
  }

  @DeleteMapping("/{id}")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<ApiResponse<Void>> abandonSession(
      @PathVariable Long id, @AuthenticationPrincipal AuthenticatedUser user) {
    sessionService.abandonSession(id, user.getId());
    return ResponseEntity.ok(ApiResponse.ok(null));
  }

  @GetMapping("/{id}/status")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<ApiResponse<SessionStatus>> getSessionStatus(
      @PathVariable Long id, @AuthenticationPrincipal AuthenticatedUser user) {
    return ResponseEntity.ok(ApiResponse.ok(sessionService.getSessionStatus(id, user.getId())));
  }

  @GetMapping("/{id}/lobby")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<ApiResponse<LobbyStateResponse>> getLobbyState(
      @PathVariable Long id, @AuthenticationPrincipal AuthenticatedUser user) {
    return ResponseEntity.ok(ApiResponse.ok(sessionService.getLobbyState(id, user.getId())));
  }

  @GetMapping("/{id}/results")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<ApiResponse<SessionResultsResponse>> getResults(
      @PathVariable Long id, @AuthenticationPrincipal AuthenticatedUser user) {
    return ResponseEntity.ok(ApiResponse.ok(resultsService.getResults(id, user.getId())));
  }

  @GetMapping("/{id}/host-sync")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<ApiResponse<HostSessionSyncResponse>> getHostSyncState(
      @PathVariable Long id, @AuthenticationPrincipal AuthenticatedUser user) {
    return ResponseEntity.ok(ApiResponse.ok(sessionService.getHostSyncState(id, user.getId())));
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

  @PatchMapping("/{id}/questions/{questionId}/scoring")
  @PreAuthorize("isAuthenticated()")
  public ResponseEntity<ApiResponse<Void>> correctScoring(
      @PathVariable Long id,
      @PathVariable Long questionId,
      @Valid @RequestBody ScoringCorrectionRequest request,
      @AuthenticationPrincipal AuthenticatedUser user) {
    sessionService.correctScoring(id, questionId, request, user.getId());
    return ResponseEntity.ok(ApiResponse.ok(null));
  }
}
