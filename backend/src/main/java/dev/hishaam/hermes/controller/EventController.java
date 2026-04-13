package dev.hishaam.hermes.controller;

import dev.hishaam.hermes.dto.ApiResponse;
import dev.hishaam.hermes.dto.CreateEventRequest;
import dev.hishaam.hermes.dto.EventResponse;
import dev.hishaam.hermes.dto.UpdateEventRequest;
import dev.hishaam.hermes.security.AuthenticatedUser;
import dev.hishaam.hermes.service.EventService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/events")
@PreAuthorize("isAuthenticated()")
public class EventController {

  private final EventService eventService;

  public EventController(EventService eventService) {
    this.eventService = eventService;
  }

  @GetMapping
  public ResponseEntity<ApiResponse<List<EventResponse>>> listEvents(
      @AuthenticationPrincipal AuthenticatedUser user) {
    return ResponseEntity.ok(ApiResponse.ok(eventService.listEvents(user.getId())));
  }

  @PostMapping
  public ResponseEntity<ApiResponse<EventResponse>> createEvent(
      @Valid @RequestBody CreateEventRequest request,
      @AuthenticationPrincipal AuthenticatedUser user) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(ApiResponse.ok(eventService.createEvent(request, user.getId())));
  }

  @GetMapping("/{id}")
  public ResponseEntity<ApiResponse<EventResponse>> getEvent(
      @PathVariable Long id, @AuthenticationPrincipal AuthenticatedUser user) {
    return ResponseEntity.ok(ApiResponse.ok(eventService.getEvent(id, user.getId())));
  }

  @PutMapping("/{id}")
  public ResponseEntity<ApiResponse<EventResponse>> updateEvent(
      @PathVariable Long id,
      @Valid @RequestBody UpdateEventRequest request,
      @AuthenticationPrincipal AuthenticatedUser user) {
    return ResponseEntity.ok(ApiResponse.ok(eventService.updateEvent(id, request, user.getId())));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<ApiResponse<Void>> deleteEvent(
      @PathVariable Long id, @AuthenticationPrincipal AuthenticatedUser user) {
    eventService.deleteEvent(id, user.getId());
    return ResponseEntity.ok(ApiResponse.ok(null));
  }
}
