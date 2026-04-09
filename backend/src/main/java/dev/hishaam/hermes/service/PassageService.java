package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.CreatePassageRequest;
import dev.hishaam.hermes.dto.CreateQuestionRequest;
import dev.hishaam.hermes.dto.PassageResponse;
import dev.hishaam.hermes.dto.UpdatePassageRequest;
import dev.hishaam.hermes.entity.Passage;
import dev.hishaam.hermes.entity.Quiz;
import dev.hishaam.hermes.entity.SessionStatus;
import dev.hishaam.hermes.entity.enums.PassageTimerMode;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.PassageRepository;
import dev.hishaam.hermes.repository.QuizSessionRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PassageService {

  private static final List<SessionStatus> ACTIVE_STATUSES =
      List.of(SessionStatus.LOBBY, SessionStatus.ACTIVE);

  private final PassageRepository passageRepository;
  private final QuizSessionRepository sessionRepository;
  private final OwnershipService ownershipService;
  private final QuestionService questionService;

  public PassageService(
      PassageRepository passageRepository,
      QuizSessionRepository sessionRepository,
      OwnershipService ownershipService,
      QuestionService questionService) {
    this.passageRepository = passageRepository;
    this.sessionRepository = sessionRepository;
    this.ownershipService = ownershipService;
    this.questionService = questionService;
  }

  @Transactional
  public PassageResponse createPassage(Long quizId, CreatePassageRequest request, Long userId) {
    Quiz quiz = ownershipService.requireQuizOwner(quizId, userId);
    checkNoActiveSession(quiz.getId());
    validatePassageRequest(quiz, request);

    Passage passage =
        Passage.builder()
            .quiz(quiz)
            .text(request.text())
            .orderIndex(request.orderIndex() != null ? request.orderIndex() : 0)
            .timerMode(
                request.timerMode() != null
                    ? request.timerMode()
                    : PassageTimerMode.PER_SUB_QUESTION)
            .timeLimitSeconds(
                (request.timerMode() != null
                            ? request.timerMode()
                            : PassageTimerMode.PER_SUB_QUESTION)
                        == PassageTimerMode.ENTIRE_PASSAGE
                    ? request.timeLimitSeconds()
                    : null)
            .build();

    for (CreateQuestionRequest subQuestionRequest : request.subQuestions()) {
      passage
          .getSubQuestions()
          .add(questionService.buildQuestionEntity(quiz, passage, subQuestionRequest, true));
    }

    return toResponse(passageRepository.save(passage));
  }

  @Transactional
  public PassageResponse updatePassage(Long passageId, UpdatePassageRequest request, Long userId) {
    Passage passage = ownershipService.requirePassageOwner(passageId, userId);
    checkNoActiveSession(passage.getQuiz().getId());
    validatePassageUpdateRequest(passage, request);

    PassageTimerMode timerMode =
        request.timerMode() != null ? request.timerMode() : PassageTimerMode.PER_SUB_QUESTION;
    passage.setText(request.text());
    passage.setOrderIndex(request.orderIndex() != null ? request.orderIndex() : 0);
    passage.setTimerMode(timerMode);
    passage.setTimeLimitSeconds(
        timerMode == PassageTimerMode.ENTIRE_PASSAGE ? request.timeLimitSeconds() : null);

    return toResponse(passageRepository.save(passage));
  }

  @Transactional
  public void deletePassage(Long passageId, Long userId) {
    Passage passage = ownershipService.requirePassageOwner(passageId, userId);
    checkNoActiveSession(passage.getQuiz().getId());
    passageRepository.delete(passage);
  }

  public PassageResponse toResponse(Passage passage) {
    return new PassageResponse(
        passage.getId(),
        passage.getQuiz().getId(),
        passage.getText(),
        passage.getOrderIndex(),
        passage.getTimerMode().name(),
        passage.getTimeLimitSeconds(),
        passage.getSubQuestions().stream().map(questionService::toResponse).toList());
  }

  private void validatePassageRequest(Quiz quiz, CreatePassageRequest request) {
    PassageTimerMode timerMode =
        request.timerMode() != null ? request.timerMode() : PassageTimerMode.PER_SUB_QUESTION;
    if (request.subQuestions().isEmpty()) {
      throw AppException.badRequest("Passage must have at least 1 sub-question");
    }
    validatePassageLevelOrderIndex(
        quiz, request.orderIndex() != null ? request.orderIndex() : 0, null);
    validatePassageTimerMode(timerMode, request.timeLimitSeconds());

    long uniqueSubQuestionOrders =
        request.subQuestions().stream()
            .map(q -> q.orderIndex() != null ? q.orderIndex() : 0)
            .distinct()
            .count();
    if (uniqueSubQuestionOrders != request.subQuestions().size()) {
      throw AppException.badRequest(
          "Sub-question orderIndex values must be unique within the passage");
    }
  }

  private void validatePassageUpdateRequest(Passage passage, UpdatePassageRequest request) {
    PassageTimerMode timerMode =
        request.timerMode() != null ? request.timerMode() : PassageTimerMode.PER_SUB_QUESTION;
    validatePassageLevelOrderIndex(
        passage.getQuiz(),
        request.orderIndex() != null ? request.orderIndex() : 0,
        passage.getId());
    validatePassageTimerMode(timerMode, request.timeLimitSeconds());
  }

  private void validatePassageTimerMode(PassageTimerMode timerMode, Integer timeLimitSeconds) {
    if (timerMode == PassageTimerMode.ENTIRE_PASSAGE
        && (timeLimitSeconds == null || timeLimitSeconds <= 0)) {
      throw AppException.badRequest(
          "ENTIRE_PASSAGE passages must define a positive timeLimitSeconds");
    }
  }

  private void validatePassageLevelOrderIndex(Quiz quiz, int orderIndex, Long currentPassageId) {
    boolean clashesWithQuestion =
        quiz.getQuestions().stream()
            .filter(q -> q.getPassage() == null)
            .anyMatch(q -> q.getOrderIndex() == orderIndex);
    if (clashesWithQuestion) {
      throw AppException.badRequest("orderIndex must be unique within the quiz");
    }
    boolean clashesWithPassage =
        quiz.getPassages().stream()
            .filter(p -> currentPassageId == null || !p.getId().equals(currentPassageId))
            .anyMatch(p -> p.getOrderIndex() == orderIndex);
    if (clashesWithPassage) {
      throw AppException.badRequest("orderIndex must be unique within the quiz");
    }
  }

  private void checkNoActiveSession(Long quizId) {
    if (sessionRepository.existsByQuizIdAndStatusIn(quizId, ACTIVE_STATUSES)) {
      throw AppException.conflict("Quiz has an active session and cannot be edited.");
    }
  }
}
