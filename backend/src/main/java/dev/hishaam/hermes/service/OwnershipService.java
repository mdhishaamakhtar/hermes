package dev.hishaam.hermes.service;

import dev.hishaam.hermes.entity.*;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.*;
import org.springframework.stereotype.Service;

@Service
public class OwnershipService {

  private final EventRepository eventRepository;
  private final QuizRepository quizRepository;
  private final QuestionRepository questionRepository;
  private final PassageRepository passageRepository;
  private final QuizSessionRepository sessionRepository;

  public OwnershipService(
      EventRepository eventRepository,
      QuizRepository quizRepository,
      QuestionRepository questionRepository,
      PassageRepository passageRepository,
      QuizSessionRepository sessionRepository) {
    this.eventRepository = eventRepository;
    this.quizRepository = quizRepository;
    this.questionRepository = questionRepository;
    this.passageRepository = passageRepository;
    this.sessionRepository = sessionRepository;
  }

  public Event requireEventOwner(Long eventId, Long userId) {
    Event event =
        eventRepository
            .findByIdWithUser(eventId)
            .orElseThrow(() -> AppException.notFound("Event not found"));
    if (!event.getUser().getId().equals(userId)) {
      throw AppException.forbidden("Access denied");
    }
    return event;
  }

  public Quiz requireQuizOwner(Long quizId, Long userId) {
    Quiz quiz =
        quizRepository
            .findByIdWithOwner(quizId)
            .orElseThrow(() -> AppException.notFound("Quiz not found"));
    if (!quiz.getEvent().getUser().getId().equals(userId)) {
      throw AppException.forbidden("Access denied");
    }
    return quiz;
  }

  public Question requireQuestionOwner(Long questionId, Long userId) {
    Question question =
        questionRepository
            .findByIdWithOwner(questionId)
            .orElseThrow(() -> AppException.notFound("Question not found"));
    if (!question.getQuiz().getEvent().getUser().getId().equals(userId)) {
      throw AppException.forbidden("Access denied");
    }
    return question;
  }

  public Passage requirePassageOwner(Long passageId, Long userId) {
    Passage passage =
        passageRepository
            .findByIdWithOwner(passageId)
            .orElseThrow(() -> AppException.notFound("Passage not found"));
    if (!passage.getQuiz().getEvent().getUser().getId().equals(userId)) {
      throw AppException.forbidden("Access denied");
    }
    return passage;
  }

  public QuizSession requireSessionOwner(Long sessionId, Long userId) {
    QuizSession session =
        sessionRepository
            .findByIdWithOwner(sessionId)
            .orElseThrow(() -> AppException.notFound("Session not found"));
    if (!session.getQuiz().getEvent().getUser().getId().equals(userId)) {
      throw AppException.forbidden("Access denied");
    }
    return session;
  }
}
