package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.CreateQuizRequest;
import dev.hishaam.hermes.dto.NewQuizRequest;
import dev.hishaam.hermes.dto.PassageResponse;
import dev.hishaam.hermes.dto.QuizResponse;
import dev.hishaam.hermes.dto.QuizSummaryResponse;
import dev.hishaam.hermes.dto.ReorderRequest;
import dev.hishaam.hermes.dto.UpdateQuizRequest;
import dev.hishaam.hermes.dto.session.QuizSessionListResponse;
import dev.hishaam.hermes.entity.AnswerOption;
import dev.hishaam.hermes.entity.Event;
import dev.hishaam.hermes.entity.Passage;
import dev.hishaam.hermes.entity.Question;
import dev.hishaam.hermes.entity.Quiz;
import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.entity.enums.DisplayMode;
import dev.hishaam.hermes.entity.enums.SessionStatus;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.ParticipantAnswerRepository;
import dev.hishaam.hermes.repository.ParticipantRepository;
import dev.hishaam.hermes.repository.QuizRepository;
import dev.hishaam.hermes.repository.QuizSessionRepository;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class QuizService {

  private static final List<SessionStatus> ACTIVE_STATUSES =
      List.of(SessionStatus.LOBBY, SessionStatus.ACTIVE);
  private static final int MAX_TITLE = 255;

  private final QuizRepository quizRepository;
  private final QuizSessionRepository sessionRepository;
  private final ParticipantRepository participantRepository;
  private final ParticipantAnswerRepository participantAnswerRepository;
  private final OwnershipService ownershipService;
  private final EventService eventService;
  private final QuestionService questionService;
  private final PassageService passageService;

  public QuizService(
      QuizRepository quizRepository,
      QuizSessionRepository sessionRepository,
      ParticipantRepository participantRepository,
      ParticipantAnswerRepository participantAnswerRepository,
      OwnershipService ownershipService,
      EventService eventService,
      QuestionService questionService,
      PassageService passageService) {
    this.quizRepository = quizRepository;
    this.sessionRepository = sessionRepository;
    this.participantRepository = participantRepository;
    this.participantAnswerRepository = participantAnswerRepository;
    this.ownershipService = ownershipService;
    this.eventService = eventService;
    this.questionService = questionService;
    this.passageService = passageService;
  }

  /** Every quiz the organiser has, newest first, whichever event it sits in. */
  @Transactional(readOnly = true)
  public List<QuizSummaryResponse> listQuizzes(Long userId) {
    return quizRepository.findByOwner(userId).stream()
        .map(
            quiz ->
                new QuizSummaryResponse(
                    quiz.getId(),
                    quiz.getTitle(),
                    quiz.getEvent().getId(),
                    quiz.getEvent().getTitle(),
                    quiz.getEvent().isDefaultEvent(),
                    quiz.getQuestions().size(),
                    quiz.getCreatedAt()))
        .toList();
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

  /** A quiz started from the quiz list: in the event given, or the organiser's own quizzes. */
  @Transactional
  public QuizResponse createQuiz(NewQuizRequest request, Long userId) {
    Event event =
        request.eventId() != null
            ? ownershipService.requireEventOwner(request.eventId(), userId)
            : eventService.defaultEvent(userId);
    Quiz quiz =
        Quiz.builder()
            .event(event)
            .title(request.title().trim())
            .orderIndex(nextQuizIndex(event))
            .displayMode(DisplayMode.BLIND)
            .build();
    return toResponse(quizRepository.save(quiz));
  }

  /** A short, ready-to-run quiz that shows what Hermes does, in the organiser's own quizzes. */
  @Transactional
  public QuizResponse createSampleQuiz(Long userId) {
    Event event = eventService.defaultEvent(userId);
    return toResponse(quizRepository.save(SampleQuiz.build(event, nextQuizIndex(event))));
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
    if (request.speedScoring() != null) quiz.setSpeedScoring(request.speedScoring());
    return toResponse(quizRepository.save(quiz));
  }

  /** A full copy of the quiz, every passage, question and option, beside it in its event. */
  @Transactional
  public QuizResponse duplicateQuiz(Long quizId, Long userId) {
    Quiz source = ownershipService.requireQuizOwner(quizId, userId);
    Event event = source.getEvent();
    Quiz copy =
        Quiz.builder()
            .event(event)
            .title(copyTitle(source.getTitle()))
            .orderIndex(nextQuizIndex(event))
            .displayMode(source.getDisplayMode())
            .speedScoring(source.isSpeedScoring())
            .build();
    for (Passage passage : source.getPassages()) {
      Passage passageCopy =
          Passage.builder()
              .quiz(copy)
              .text(passage.getText())
              .orderIndex(passage.getOrderIndex())
              .timerMode(passage.getTimerMode())
              .timeLimitSeconds(passage.getTimeLimitSeconds())
              .build();
      // Sub-questions save through their passage, so the passage row exists before they
      // point at it.
      for (Question question : passage.getSubQuestions()) {
        passageCopy
            .getSubQuestions()
            .add(copyQuestion(question, copy, passageCopy, question.getOrderIndex()));
      }
      copy.getPassages().add(passageCopy);
    }
    for (Question question : source.getQuestions()) {
      if (question.getPassage() == null) {
        copy.getQuestions().add(copyQuestion(question, copy, null, question.getOrderIndex()));
      }
    }
    return toResponse(quizRepository.save(copy));
  }

  /**
   * Copies a question into the slot right after it, in the quiz or in its passage, moving
   * everything below down one. Returns the whole quiz, since every later position changes.
   */
  @Transactional
  public QuizResponse duplicateQuestion(Long questionId, Long userId) {
    Question source = ownershipService.requireQuestionOwner(questionId, userId);
    Quiz quiz = source.getQuiz();
    checkNoActiveSession(quiz.getId());
    int after = source.getOrderIndex();
    Passage passage = source.getPassage();

    if (passage == null) {
      quiz.getQuestions().stream()
          .filter(q -> q.getPassage() == null && q.getOrderIndex() > after)
          .forEach(q -> q.setOrderIndex(q.getOrderIndex() + 1));
      quiz.getPassages().stream()
          .filter(p -> p.getOrderIndex() > after)
          .forEach(p -> p.setOrderIndex(p.getOrderIndex() + 1));
    } else {
      passage.getSubQuestions().stream()
          .filter(q -> q.getOrderIndex() > after)
          .forEach(q -> q.setOrderIndex(q.getOrderIndex() + 1));
    }

    Question copy = copyQuestion(source, quiz, passage, after + 1);
    quiz.getQuestions().add(copy);
    if (passage != null) passage.getSubQuestions().add(copy);
    return toResponse(quizRepository.save(quiz));
  }

  /**
   * Sets the running order to the one given. The blocks must be exactly the quiz's standalone
   * questions and passages, each once, so a stale screen can't drop or invent one.
   */
  @Transactional
  public QuizResponse reorder(Long quizId, ReorderRequest request, Long userId) {
    Quiz quiz = ownershipService.requireQuizOwner(quizId, userId);
    checkNoActiveSession(quizId);

    Map<Long, Question> questions =
        quiz.getQuestions().stream()
            .filter(q -> q.getPassage() == null)
            .collect(Collectors.toMap(Question::getId, Function.identity()));
    Map<Long, Passage> passages =
        quiz.getPassages().stream().collect(Collectors.toMap(Passage::getId, Function.identity()));

    Set<Long> seenQuestions = new HashSet<>();
    Set<Long> seenPassages = new HashSet<>();
    for (ReorderRequest.Block block : request.blocks()) {
      boolean fresh =
          block.kind() == ReorderRequest.Kind.QUESTION
              ? questions.containsKey(block.id()) && seenQuestions.add(block.id())
              : passages.containsKey(block.id()) && seenPassages.add(block.id());
      if (!fresh) {
        throw AppException.conflict("The quiz has changed since this order was made.");
      }
    }
    if (seenQuestions.size() != questions.size() || seenPassages.size() != passages.size()) {
      throw AppException.conflict("The quiz has changed since this order was made.");
    }

    for (int index = 0; index < request.blocks().size(); index++) {
      ReorderRequest.Block block = request.blocks().get(index);
      if (block.kind() == ReorderRequest.Kind.QUESTION) {
        questions.get(block.id()).setOrderIndex(index);
      } else {
        Passage passage = passages.get(block.id());
        passage.setOrderIndex(index);
        if (block.questionIds() != null) reorderPassage(passage, block.questionIds());
      }
    }
    return toResponse(quizRepository.save(quiz));
  }

  private void reorderPassage(Passage passage, List<Long> questionIds) {
    Map<Long, Question> subQuestions =
        passage.getSubQuestions().stream()
            .collect(Collectors.toMap(Question::getId, Function.identity()));
    if (questionIds.size() != subQuestions.size()
        || !subQuestions.keySet().equals(new HashSet<>(questionIds))) {
      throw AppException.conflict("The passage has changed since this order was made.");
    }
    for (int index = 0; index < questionIds.size(); index++) {
      subQuestions.get(questionIds.get(index)).setOrderIndex(index);
    }
  }

  @Transactional
  public void deleteQuiz(Long quizId, Long userId) {
    Quiz quiz = ownershipService.requireQuizOwner(quizId, userId);
    List<Long> sessionIds = sessionRepository.findIdsByQuizIdIn(List.of(quizId));
    if (!sessionIds.isEmpty()) {
      participantAnswerRepository.deleteBySessionIdIn(sessionIds);
      participantRepository.deleteBySessionIdIn(sessionIds);
      sessionRepository.deleteAllByIdInBatch(sessionIds);
    }
    quizRepository.delete(quiz);
  }

  /** Past and running sessions. A finished rehearsal was only ever the host's, so it's left out. */
  public List<QuizSessionListResponse> listSessions(Long quizId, Long userId) {
    ownershipService.requireQuizOwner(quizId, userId);
    var sessions =
        sessionRepository.findByQuizIdOrderByCreatedAtDesc(quizId).stream()
            .filter(s -> !s.isRehearsal() || s.getStatus() != SessionStatus.ENDED)
            .toList();
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
                    counts.getOrDefault(s.getId(), 0L),
                    s.isRehearsal()))
        .toList();
  }

  private Question copyQuestion(Question source, Quiz quiz, Passage passage, int orderIndex) {
    Question copy =
        Question.builder()
            .quiz(quiz)
            .passage(passage)
            .text(source.getText())
            .orderIndex(orderIndex)
            .questionType(source.getQuestionType())
            .displayModeOverride(source.getDisplayModeOverride())
            .timeLimitSeconds(source.getTimeLimitSeconds())
            .poll(source.isPoll())
            .build();
    for (AnswerOption option : source.getOptions()) {
      copy.getOptions()
          .add(
              AnswerOption.builder()
                  .question(copy)
                  .text(option.getText())
                  .orderIndex(option.getOrderIndex())
                  .pointValue(option.getPointValue())
                  .build());
    }
    return copy;
  }

  private static String copyTitle(String title) {
    String suffix = " (copy)";
    return title.length() + suffix.length() > MAX_TITLE
        ? title.substring(0, MAX_TITLE - suffix.length()) + suffix
        : title + suffix;
  }

  private static int nextQuizIndex(Event event) {
    return event.getQuizzes().stream().mapToInt(Quiz::getOrderIndex).max().orElse(0) + 1;
  }

  private void checkNoActiveSession(Long quizId) {
    if (sessionRepository.existsByQuizIdAndStatusIn(quizId, ACTIVE_STATUSES)) {
      throw AppException.conflict("Quiz has an active session and cannot be edited.");
    }
  }

  private QuizResponse toResponse(Quiz quiz) {
    var questions =
        quiz.getQuestions().stream()
            .filter(q -> q.getPassage() == null)
            .map(questionService::toResponse)
            .toList();
    List<PassageResponse> passages =
        quiz.getPassages().stream().map(passageService::toResponse).toList();
    return new QuizResponse(
        quiz.getId(),
        quiz.getEvent().getId(),
        quiz.getEvent().getTitle(),
        quiz.getEvent().isDefaultEvent(),
        quiz.getTitle(),
        quiz.getOrderIndex(),
        quiz.getDisplayMode().name(),
        quiz.isSpeedScoring(),
        quiz.getCreatedAt(),
        questions,
        passages);
  }
}
