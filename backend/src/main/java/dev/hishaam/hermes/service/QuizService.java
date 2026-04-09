package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.CreateQuizRequest;
import dev.hishaam.hermes.dto.QuizResponse;
import dev.hishaam.hermes.dto.QuizSessionListResponse;
import dev.hishaam.hermes.dto.UpdateQuizRequest;
import dev.hishaam.hermes.entity.Event;
import dev.hishaam.hermes.entity.Quiz;
import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.entity.SessionStatus;
import dev.hishaam.hermes.entity.enums.DisplayMode;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.ParticipantAnswerRepository;
import dev.hishaam.hermes.repository.ParticipantRepository;
import dev.hishaam.hermes.repository.QuizRepository;
import dev.hishaam.hermes.repository.QuizSessionRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class QuizService {

  private static final List<SessionStatus> ACTIVE_STATUSES =
      List.of(SessionStatus.LOBBY, SessionStatus.ACTIVE);

  private final QuizRepository quizRepository;
  private final QuizSessionRepository sessionRepository;
  private final ParticipantRepository participantRepository;
  private final ParticipantAnswerRepository participantAnswerRepository;
  private final OwnershipService ownershipService;
  private final QuestionService questionService;

  public QuizService(
      QuizRepository quizRepository,
      QuizSessionRepository sessionRepository,
      ParticipantRepository participantRepository,
      ParticipantAnswerRepository participantAnswerRepository,
      OwnershipService ownershipService,
      QuestionService questionService) {
    this.quizRepository = quizRepository;
    this.sessionRepository = sessionRepository;
    this.participantRepository = participantRepository;
    this.participantAnswerRepository = participantAnswerRepository;
    this.ownershipService = ownershipService;
    this.questionService = questionService;
  }

  @Transactional
  public QuizResponse createQuiz(Long eventId, CreateQuizRequest request, Long userId) {
    Event event = ownershipService.requireEventOwner(eventId, userId);
    Quiz quiz =
        Quiz.builder()
            .event(event)
            .title(request.title())
            .orderIndex(request.orderIndex() != null ? request.orderIndex() : 0)
            .displayMode(request.displayMode() != null ? request.displayMode() : DisplayMode.BLIND)
            .build();
    return toResponse(quizRepository.save(quiz));
  }

  @Transactional(readOnly = true)
  public QuizResponse getQuiz(Long quizId, Long userId) {
    Quiz quiz = ownershipService.requireQuizOwner(quizId, userId);
    return toResponse(quiz);
  }

  @Transactional
  public QuizResponse updateQuiz(Long quizId, UpdateQuizRequest request, Long userId) {
    Quiz quiz = ownershipService.requireQuizOwner(quizId, userId);
    checkNoActiveSession(quizId);
    quiz.setTitle(request.title());
    quiz.setOrderIndex(request.orderIndex() != null ? request.orderIndex() : 0);
    quiz.setDisplayMode(request.displayMode() != null ? request.displayMode() : DisplayMode.BLIND);
    return toResponse(quizRepository.save(quiz));
  }

  @Transactional
  public void deleteQuiz(Long quizId, Long userId) {
    Quiz quiz = ownershipService.requireQuizOwner(quizId, userId);
    List<Long> sessionIds =
        sessionRepository.findByQuizIdOrderByCreatedAtDesc(quizId).stream()
            .map(QuizSession::getId)
            .toList();
    if (!sessionIds.isEmpty()) {
      participantAnswerRepository.deleteBySessionIdIn(sessionIds);
      participantRepository.deleteBySessionIdIn(sessionIds);
      sessionRepository.deleteAllByIdInBatch(sessionIds);
    }
    quizRepository.delete(quiz);
  }

  public List<QuizSessionListResponse> listSessions(Long quizId, Long userId) {
    ownershipService.requireQuizOwner(quizId, userId);
    var sessions = sessionRepository.findByQuizIdOrderByCreatedAtDesc(quizId).stream().toList();
    var sessionIds = sessions.stream().map(QuizSession::getId).toList();
    var counts = participantRepository.countMapBySessionIds(sessionIds);
    return sessions.stream()
        .map(
            s ->
                new QuizSessionListResponse(
                    s.getId(),
                    s.getStatus().name(),
                    s.getStartedAt(),
                    s.getEndedAt(),
                    counts.getOrDefault(s.getId(), 0L)))
        .toList();
  }

  private void checkNoActiveSession(Long quizId) {
    if (sessionRepository.existsByQuizIdAndStatusIn(quizId, ACTIVE_STATUSES)) {
      throw AppException.conflict("Quiz has an active session and cannot be edited.");
    }
  }

  private QuizResponse toResponse(Quiz quiz) {
    var questions = quiz.getQuestions().stream().map(questionService::toResponse).toList();
    return new QuizResponse(
        quiz.getId(),
        quiz.getEvent().getId(),
        quiz.getTitle(),
        quiz.getOrderIndex(),
        quiz.getDisplayMode().name(),
        quiz.getCreatedAt(),
        questions);
  }
}
