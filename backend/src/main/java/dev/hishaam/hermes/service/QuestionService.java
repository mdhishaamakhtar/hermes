package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.CreateQuestionRequest;
import dev.hishaam.hermes.dto.OptionRequest;
import dev.hishaam.hermes.dto.OptionResponse;
import dev.hishaam.hermes.dto.QuestionResponse;
import dev.hishaam.hermes.dto.UpdateQuestionRequest;
import dev.hishaam.hermes.entity.AnswerOption;
import dev.hishaam.hermes.entity.Passage;
import dev.hishaam.hermes.entity.Question;
import dev.hishaam.hermes.entity.Quiz;
import dev.hishaam.hermes.entity.SessionStatus;
import dev.hishaam.hermes.entity.enums.PassageTimerMode;
import dev.hishaam.hermes.entity.enums.QuestionType;
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
    Question question = buildQuestionEntity(quiz, null, request, false);
    question = questionRepository.save(question);
    return toResponse(question);
  }

  @Transactional
  public QuestionResponse createPassageQuestion(
      Long passageId, CreateQuestionRequest request, Long userId) {
    Passage passage = ownershipService.requirePassageOwner(passageId, userId);
    checkNoActiveSession(passage.getQuiz().getId());
    Question question = buildQuestionEntity(passage.getQuiz(), passage, request, true);
    question = questionRepository.save(question);
    return toResponse(question);
  }

  @Transactional
  public QuestionResponse updateQuestion(
      Long questionId, UpdateQuestionRequest request, Long userId) {
    Question question = ownershipService.requireQuestionOwner(questionId, userId);
    checkNoActiveSession(question.getQuiz().getId());

    int normalizedOrderIndex = request.orderIndex() != null ? request.orderIndex() : 0;
    QuestionType questionType =
        request.questionType() != null ? request.questionType() : QuestionType.SINGLE_SELECT;
    int normalizedTimeLimitSeconds =
        resolveTimeLimitSeconds(question.getPassage(), request.timeLimitSeconds(), true);

    validateQuestionRequest(
        question.getQuiz(),
        question.getPassage(),
        normalizedOrderIndex,
        questionType,
        normalizedTimeLimitSeconds,
        request.options(),
        question.getId());

    question.setText(request.text());
    question.setOrderIndex(normalizedOrderIndex);
    question.setTimeLimitSeconds(normalizedTimeLimitSeconds);
    question.setQuestionType(questionType);
    question.setDisplayModeOverride(request.displayModeOverride());

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
            .map(
                o ->
                    new OptionResponse(
                        o.getId(), o.getText(), o.getOrderIndex(), o.getPointValue()))
            .toList();
    String displayModeOverride =
        question.getDisplayModeOverride() != null ? question.getDisplayModeOverride().name() : null;
    String effectiveDisplayMode =
        (question.getDisplayModeOverride() != null
                ? question.getDisplayModeOverride()
                : question.getQuiz().getDisplayMode())
            .name();
    return new QuestionResponse(
        question.getId(),
        question.getQuiz().getId(),
        question.getPassage() != null ? question.getPassage().getId() : null,
        question.getText(),
        question.getQuestionType().name(),
        question.getOrderIndex(),
        question.getTimeLimitSeconds(),
        displayModeOverride,
        effectiveDisplayMode,
        options);
  }

  Question buildQuestionEntity(
      Quiz quiz, Passage passage, CreateQuestionRequest request, boolean passageSubQuestion) {
    checkNoActiveSession(quiz.getId());
    int normalizedOrderIndex = request.orderIndex() != null ? request.orderIndex() : 0;
    QuestionType questionType =
        request.questionType() != null ? request.questionType() : QuestionType.SINGLE_SELECT;
    int normalizedTimeLimitSeconds =
        resolveTimeLimitSeconds(passage, request.timeLimitSeconds(), passageSubQuestion);

    validateQuestionRequest(
        quiz,
        passage,
        normalizedOrderIndex,
        questionType,
        normalizedTimeLimitSeconds,
        request.options(),
        null);

    Question question =
        Question.builder()
            .quiz(quiz)
            .passage(passage)
            .text(request.text())
            .orderIndex(normalizedOrderIndex)
            .timeLimitSeconds(normalizedTimeLimitSeconds)
            .questionType(questionType)
            .displayModeOverride(request.displayModeOverride())
            .build();
    question.getOptions().addAll(buildOptions(question, request.options()));
    return question;
  }

  private List<AnswerOption> buildOptions(Question question, List<OptionRequest> optionRequests) {
    List<AnswerOption> options = new ArrayList<>();
    for (int i = 0; i < optionRequests.size(); i++) {
      var req = optionRequests.get(i);
      options.add(
          AnswerOption.builder()
              .question(question)
              .text(req.normalizedText())
              .orderIndex(req.orderIndex() != null ? req.orderIndex() : i)
              .pointValue(req.pointValue())
              .build());
    }
    return options;
  }

  private void validateQuestionRequest(
      Quiz quiz,
      Passage passage,
      int orderIndex,
      QuestionType questionType,
      int timeLimitSeconds,
      List<OptionRequest> optionRequests,
      Long currentQuestionId) {
    if (optionRequests.size() < 2) {
      throw AppException.badRequest("Questions must have at least 2 options");
    }
    if (optionRequests.stream()
        .anyMatch(o -> o.normalizedText() == null || o.normalizedText().isBlank())) {
      throw AppException.badRequest("Option text is required");
    }

    long positiveOptionCount = optionRequests.stream().filter(o -> o.pointValue() > 0).count();
    if (questionType == QuestionType.SINGLE_SELECT && positiveOptionCount != 1) {
      throw AppException.badRequest(
          "SINGLE_SELECT questions must have exactly one option with pointValue > 0");
    }
    if (questionType == QuestionType.MULTI_SELECT && positiveOptionCount < 1) {
      throw AppException.badRequest(
          "MULTI_SELECT questions must have at least one option with pointValue > 0");
    }

    long uniqueOptionOrderIndexes =
        optionRequests.stream()
            .map(o -> o.orderIndex() != null ? o.orderIndex() : optionRequests.indexOf(o))
            .distinct()
            .count();
    if (uniqueOptionOrderIndexes != optionRequests.size()) {
      throw AppException.badRequest("Option orderIndex values must be unique within the question");
    }

    if (passage == null) {
      if (timeLimitSeconds <= 0) {
        throw AppException.badRequest("Questions must define a positive timeLimitSeconds");
      }
      validateQuizLevelOrderIndex(quiz, orderIndex, currentQuestionId);
      return;
    }

    if (passage.getTimerMode() == PassageTimerMode.PER_SUB_QUESTION && timeLimitSeconds <= 0) {
      throw AppException.badRequest(
          "PER_SUB_QUESTION passage sub-questions must define a positive timeLimitSeconds");
    }
    validatePassageLevelOrderIndex(passage, orderIndex, currentQuestionId);
  }

  private int resolveTimeLimitSeconds(
      Passage passage, Integer requestTimeLimitSeconds, boolean passageSubQuestion) {
    if (!passageSubQuestion || passage == null) {
      if (requestTimeLimitSeconds == null) {
        throw AppException.badRequest("Questions must define timeLimitSeconds");
      }
      return requestTimeLimitSeconds;
    }
    if (passage.getTimerMode() == PassageTimerMode.ENTIRE_PASSAGE) {
      return requestTimeLimitSeconds != null ? requestTimeLimitSeconds : 0;
    }
    if (requestTimeLimitSeconds == null) {
      throw AppException.badRequest(
          "PER_SUB_QUESTION passage sub-questions must define timeLimitSeconds");
    }
    return requestTimeLimitSeconds;
  }

  private void validateQuizLevelOrderIndex(Quiz quiz, int orderIndex, Long currentQuestionId) {
    boolean clashesWithQuestion =
        quiz.getQuestions().stream()
            .filter(q -> q.getPassage() == null)
            .filter(q -> currentQuestionId == null || !q.getId().equals(currentQuestionId))
            .anyMatch(q -> q.getOrderIndex() == orderIndex);
    if (clashesWithQuestion) {
      throw AppException.badRequest("orderIndex must be unique within the quiz");
    }
    boolean clashesWithPassage =
        quiz.getPassages().stream().anyMatch(p -> p.getOrderIndex() == orderIndex);
    if (clashesWithPassage) {
      throw AppException.badRequest("orderIndex must be unique within the quiz");
    }
  }

  private void validatePassageLevelOrderIndex(
      Passage passage, int orderIndex, Long currentQuestionId) {
    boolean clashes =
        passage.getSubQuestions().stream()
            .filter(q -> currentQuestionId == null || !q.getId().equals(currentQuestionId))
            .anyMatch(q -> q.getOrderIndex() == orderIndex);
    if (clashes) {
      throw AppException.badRequest("orderIndex must be unique within the passage");
    }
  }

  private void checkNoActiveSession(Long quizId) {
    if (sessionRepository.existsByQuizIdAndStatusIn(quizId, ACTIVE_STATUSES)) {
      throw AppException.conflict("Quiz has an active session and cannot be edited.");
    }
  }
}
