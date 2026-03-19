package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.CreateQuestionRequest;
import dev.hishaam.hermes.dto.OptionRequest;
import dev.hishaam.hermes.dto.OptionResponse;
import dev.hishaam.hermes.dto.QuestionResponse;
import dev.hishaam.hermes.dto.UpdateQuestionRequest;
import dev.hishaam.hermes.entity.AnswerOption;
import dev.hishaam.hermes.entity.Question;
import dev.hishaam.hermes.entity.Quiz;
import dev.hishaam.hermes.entity.SessionStatus;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.QuestionRepository;
import dev.hishaam.hermes.repository.QuizSessionRepository;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class QuestionService {

  private static final List<SessionStatus> ACTIVE_STATUSES =
      List.of(SessionStatus.LOBBY, SessionStatus.ACTIVE);

  private final QuestionRepository questionRepository;
  private final QuizSessionRepository sessionRepository;
  private final OwnershipService ownershipService;

  public QuestionService(
      QuestionRepository questionRepository,
      QuizSessionRepository sessionRepository,
      OwnershipService ownershipService) {
    this.questionRepository = questionRepository;
    this.sessionRepository = sessionRepository;
    this.ownershipService = ownershipService;
  }

  @Transactional
  public QuestionResponse createQuestion(Long quizId, CreateQuestionRequest request, Long userId) {
    Quiz quiz = ownershipService.requireQuizOwner(quizId, userId);
    validateSingleCorrect(request.options().stream().map(o -> o.isCorrect()).toList());
    Question question =
        Question.builder()
            .quiz(quiz)
            .text(request.text())
            .orderIndex(request.orderIndex())
            .timeLimitSeconds(request.timeLimitSeconds())
            .build();
    question.getOptions().addAll(buildOptions(question, request.options()));
    question = questionRepository.save(question);
    return toResponse(question);
  }

  @Transactional
  public QuestionResponse updateQuestion(
      Long questionId, UpdateQuestionRequest request, Long userId) {
    Question question = ownershipService.requireQuestionOwner(questionId, userId);
    checkNoActiveSession(question.getQuiz().getId());
    validateSingleCorrect(request.options().stream().map(o -> o.isCorrect()).toList());

    question.setText(request.text());
    question.setOrderIndex(request.orderIndex());
    question.setTimeLimitSeconds(request.timeLimitSeconds());

    question.getOptions().clear();
    question.getOptions().addAll(buildOptions(question, request.options()));

    question = questionRepository.save(question);
    return toResponse(question);
  } 

  @Transactional
  public void deleteQuestion(Long questionId, Long userId) {
    Question question = ownershipService.requireQuestionOwner(questionId, userId);
    checkNoActiveSession(question.getQuiz().getId());
    questionRepository.delete(question);
  }

  public QuestionResponse toResponse(Question question) {
    List<OptionResponse> options =
        question.getOptions().stream()
            .map(o -> new OptionResponse(o.getId(), o.getText(), o.getOrderIndex(), o.isCorrect()))
            .toList();
    return new QuestionResponse(
        question.getId(),
        question.getQuiz().getId(),
        question.getText(),
        question.getOrderIndex(),
        question.getTimeLimitSeconds(),
        options);
  }

  private List<AnswerOption> buildOptions(Question question, List<OptionRequest> optionRequests) {
    List<AnswerOption> options = new ArrayList<>();
    for (int i = 0; i < optionRequests.size(); i++) {
      var req = optionRequests.get(i);
      options.add(
          AnswerOption.builder()
              .question(question)
              .text(req.text())
              .orderIndex(i + 1)
              .isCorrect(req.isCorrect())
              .build());
    }
    return options;
  }

  private void validateSingleCorrect(List<Boolean> correctFlags) {
    long count = correctFlags.stream().filter(Boolean::booleanValue).count();
    if (count != 1) {
      throw AppException.badRequest("Exactly one option must be marked as correct");
    }
  }

  private void checkNoActiveSession(Long quizId) {
    if (sessionRepository.existsByQuizIdAndStatusIn(quizId, ACTIVE_STATUSES)) {
      throw AppException.conflict("Quiz has an active session and cannot be edited.");
    }
  }
}
