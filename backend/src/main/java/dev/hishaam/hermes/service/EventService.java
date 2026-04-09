package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.CreateEventRequest;
import dev.hishaam.hermes.dto.EventResponse;
import dev.hishaam.hermes.dto.UpdateEventRequest;
import dev.hishaam.hermes.entity.Event;
import dev.hishaam.hermes.entity.Quiz;
import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.entity.User;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.EventRepository;
import dev.hishaam.hermes.repository.ParticipantAnswerRepository;
import dev.hishaam.hermes.repository.ParticipantRepository;
import dev.hishaam.hermes.repository.QuizSessionRepository;
import dev.hishaam.hermes.repository.UserRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EventService {

  private final EventRepository eventRepository;
  private final UserRepository userRepository;
  private final OwnershipService ownershipService;
  private final QuizSessionRepository sessionRepository;
  private final ParticipantRepository participantRepository;
  private final ParticipantAnswerRepository participantAnswerRepository;

  public EventService(
      EventRepository eventRepository,
      UserRepository userRepository,
      OwnershipService ownershipService,
      QuizSessionRepository sessionRepository,
      ParticipantRepository participantRepository,
      ParticipantAnswerRepository participantAnswerRepository) {
    this.eventRepository = eventRepository;
    this.userRepository = userRepository;
    this.ownershipService = ownershipService;
    this.sessionRepository = sessionRepository;
    this.participantRepository = participantRepository;
    this.participantAnswerRepository = participantAnswerRepository;
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
    List<Long> quizIds = event.getQuizzes().stream().map(Quiz::getId).toList();
    if (!quizIds.isEmpty()) {
      List<Long> sessionIds =
          sessionRepository.findByQuizIdIn(quizIds).stream().map(QuizSession::getId).toList();
      if (!sessionIds.isEmpty()) {
        participantAnswerRepository.deleteSelectionsBySessionIdIn(sessionIds);
        participantAnswerRepository.deleteBySessionIdIn(sessionIds);
        participantRepository.deleteBySessionIdIn(sessionIds);
        sessionRepository.deleteAllByIdInBatch(sessionIds);
      }
    }
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
