package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.CreateEventRequest;
import dev.hishaam.hermes.dto.EventResponse;
import dev.hishaam.hermes.dto.UpdateEventRequest;
import dev.hishaam.hermes.entity.Event;
import dev.hishaam.hermes.entity.User;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.EventRepository;
import dev.hishaam.hermes.repository.UserRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EventService {

  private final EventRepository eventRepository;
  private final UserRepository userRepository;
  private final OwnershipService ownershipService;

  public EventService(
      EventRepository eventRepository,
      UserRepository userRepository,
      OwnershipService ownershipService) {
    this.eventRepository = eventRepository;
    this.userRepository = userRepository;
    this.ownershipService = ownershipService;
  }

  @Transactional(readOnly = true)
  public List<EventResponse> listEvents(Long userId) {
    return eventRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public EventResponse createEvent(CreateEventRequest request, Long userId) {
    User user =
        userRepository.findById(userId).orElseThrow(() -> AppException.notFound("User not found"));
    Event event =
        Event.builder()
            .user(user)
            .title(request.title())
            .description(request.description())
            .build();
    return toResponse(eventRepository.save(event));
  }

  @Transactional(readOnly = true)
  public EventResponse getEvent(Long eventId, Long userId) {
    Event event = ownershipService.requireEventOwner(eventId, userId);
    return toResponse(event);
  }

  @Transactional
  public EventResponse updateEvent(Long eventId, UpdateEventRequest request, Long userId) {
    Event event = ownershipService.requireEventOwner(eventId, userId);
    event.setTitle(request.title());
    event.setDescription(request.description());
    return toResponse(eventRepository.save(event));
  }

  @Transactional
  public void deleteEvent(Long eventId, Long userId) {
    Event event = ownershipService.requireEventOwner(eventId, userId);
    eventRepository.delete(event);
  }

  private EventResponse toResponse(Event event) {
    var quizzes =
        event.getQuizzes().stream()
            .map(q -> new EventResponse.QuizSummary(q.getId(), q.getTitle(), q.getOrderIndex()))
            .toList();
    return new EventResponse(
        event.getId(),
        event.getUser().getId(),
        event.getTitle(),
        event.getDescription(),
        event.getCreatedAt(),
        quizzes);
  }
}
