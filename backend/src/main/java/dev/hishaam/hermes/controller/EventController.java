package dev.hishaam.hermes.controller;

import dev.hishaam.hermes.dto.ApiResponse;
import dev.hishaam.hermes.dto.CreateEventRequest;
import dev.hishaam.hermes.dto.EventResponse;
import dev.hishaam.hermes.dto.UpdateEventRequest;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.UserRepository;
import dev.hishaam.hermes.service.EventService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/events")
@PreAuthorize("isAuthenticated()")
public class EventController {

  private final EventService eventService;
  private final UserRepository userRepository;

  public EventController(EventService eventService, UserRepository userRepository) {
    this.eventService = eventService;
    this.userRepository = userRepository;
  }

  @GetMapping
  public ResponseEntity<ApiResponse<List<EventResponse>>> listEvents(
      @AuthenticationPrincipal UserDetails userDetails) {
    Long userId = resolveUserId(userDetails);
    return ResponseEntity.ok(ApiResponse.ok(eventService.listEvents(userId)));
  }

  @PostMapping
  public ResponseEntity<ApiResponse<EventResponse>> createEvent(
      @Valid @RequestBody CreateEventRequest request,
      @AuthenticationPrincipal UserDetails userDetails) {
    Long userId = resolveUserId(userDetails);
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ApiResponse.ok(eventService.createEvent(request, userId)));
  }

  @GetMapping("/{id}")
  public ResponseEntity<ApiResponse<EventResponse>> getEvent(
      @PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
    Long userId = resolveUserId(userDetails);
    return ResponseEntity.ok(ApiResponse.ok(eventService.getEvent(id, userId)));
  }

  @PutMapping("/{id}")
  public ResponseEntity<ApiResponse<EventResponse>> updateEvent(
      @PathVariable Long id,
      @Valid @RequestBody UpdateEventRequest request,
      @AuthenticationPrincipal UserDetails userDetails) {
    Long userId = resolveUserId(userDetails);
    return ResponseEntity.ok(ApiResponse.ok(eventService.updateEvent(id, request, userId)));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<ApiResponse<Void>> deleteEvent(
      @PathVariable Long id, @AuthenticationPrincipal UserDetails userDetails) {
    Long userId = resolveUserId(userDetails);
    eventService.deleteEvent(id, userId);
    return ResponseEntity.ok(ApiResponse.ok(null));
  }

  private Long resolveUserId(UserDetails userDetails) {
    return userRepository
        .findByEmail(userDetails.getUsername())
        .orElseThrow(() -> AppException.notFound("User not found"))
        .getId();
  }
}
