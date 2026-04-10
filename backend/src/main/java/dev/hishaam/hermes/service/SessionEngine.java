package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.QuizSnapshot;
import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.entity.SessionStatus;
import dev.hishaam.hermes.entity.enums.PassageTimerMode;
import dev.hishaam.hermes.entity.enums.QuestionLifecycleState;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.ParticipantAnswerRepository;
import dev.hishaam.hermes.repository.QuestionRepository;
import dev.hishaam.hermes.repository.QuizSessionRepository;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Core transactional engine for session lifecycle operations. Extracted from SessionService to fix
 * Spring's @Transactional proxy self-invocation issue — these methods are now called cross-bean.
 */
@Service
public class SessionEngine {

  private final QuizSessionRepository sessionRepository;
  private final QuestionRepository questionRepository;
  private final ParticipantAnswerRepository answerRepository;
  private final SessionSnapshotService snapshotService;
  private final SessionLiveStateService liveStateService;
  private final SessionEventPublisher eventPublisher;
  private final SessionTimerScheduler timerScheduler;
  private final GradingService gradingService;

  public SessionEngine(
      QuizSessionRepository sessionRepository,
      QuestionRepository questionRepository,
      ParticipantAnswerRepository answerRepository,
      SessionSnapshotService snapshotService,
      SessionLiveStateService liveStateService,
      SessionEventPublisher eventPublisher,
      SessionTimerScheduler timerScheduler,
      GradingService gradingService) {
    this.sessionRepository = sessionRepository;
    this.questionRepository = questionRepository;
    this.answerRepository = answerRepository;
    this.snapshotService = snapshotService;
    this.liveStateService = liveStateService;
    this.eventPublisher = eventPublisher;
    this.timerScheduler = timerScheduler;
    this.gradingService = gradingService;
  }

  @Transactional
  public void advanceSessionInternal(Long sessionId) {
    String sid = sessionId.toString();
    String status = liveStateService.getStatus(sessionId);
    if (!SessionStatus.ACTIVE.name().equals(status)) return;

    QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
    String currentQIdStr = liveStateService.getCurrentQuestionId(sessionId);
    Long currentQId =
        (currentQIdStr != null && !currentQIdStr.isEmpty()) ? Long.parseLong(currentQIdStr) : null;

    QuizSnapshot.QuestionSnapshot next = snapshot.findNextQuestion(currentQId);
    if (next == null) {
      doEndSession(sessionId, snapshot);
      return;
    }

    // Check if the next question belongs to an ENTIRE_PASSAGE passage
    if (next.passageId() != null) {
      QuizSnapshot.PassageSnapshot passage = snapshot.findPassage(next.passageId());
      if (passage != null && PassageTimerMode.ENTIRE_PASSAGE == passage.timerMode()) {
        displayEntirePassage(sessionId, passage, snapshot);
        updateDbCurrentQuestion(sessionId, findLastSubQuestion(passage, snapshot));
        return;
      }
    }

    // Regular (standalone or PER_SUB_QUESTION) question display
    liveStateService.setCurrentQuestion(sessionId, next.id());
    liveStateService.clearCurrentPassage(sessionId);
    liveStateService.setQuestionState(sessionId, QuestionLifecycleState.DISPLAYED.name());
    liveStateService.initQuestionCounts(sessionId, next);
    eventPublisher.publishQuestionDisplayed(sessionId, next, snapshot);
    updateDbCurrentQuestion(sessionId, next);
  }

  @Transactional
  public void startTimerInternal(Long sessionId) {
    String sid = sessionId.toString();
    String status = liveStateService.getStatus(sessionId);
    if (!SessionStatus.ACTIVE.name().equals(status)) {
      throw AppException.conflict("Session is not active");
    }

    String questionState = liveStateService.getQuestionState(sessionId);
    if (!QuestionLifecycleState.DISPLAYED.name().equals(questionState)) {
      throw AppException.conflict("Timer can only be started when question is in DISPLAYED state");
    }

    // Determine timer target and duration
    String currentPassageIdStr = liveStateService.getCurrentPassageId(sessionId);
    String currentQIdStr = liveStateService.getCurrentQuestionId(sessionId);

    if (currentPassageIdStr != null && !currentPassageIdStr.isEmpty()) {
      // ENTIRE_PASSAGE mode — use passage timer
      Long passageId = Long.parseLong(currentPassageIdStr);
      QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
      QuizSnapshot.PassageSnapshot passage = snapshot.findPassage(passageId);
      if (passage == null || passage.timeLimitSeconds() == null) {
        throw AppException.conflict("Passage has no time limit configured");
      }

      liveStateService.setQuestionState(sessionId, QuestionLifecycleState.TIMED.name());
      liveStateService.setTimer(sessionId, passage.timeLimitSeconds());
      liveStateService.recordTimerStartedAt(sessionId, Instant.now().toEpochMilli());

      eventPublisher.publishTimerStart(sessionId, null, passageId, passage.timeLimitSeconds());

      long seqAtStart = liveStateService.getQuestionSequence(sessionId);
      Long anchorQuestionId = Long.parseLong(currentQIdStr);
      timerScheduler.scheduleQuestionTimer(
          sessionId, anchorQuestionId, passage.timeLimitSeconds(), seqAtStart);

    } else {
      // Standalone or PER_SUB_QUESTION question
      if (currentQIdStr == null || currentQIdStr.isEmpty()) {
        throw AppException.conflict("No current question to start timer for");
      }
      Long questionId = Long.parseLong(currentQIdStr);
      QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
      QuizSnapshot.QuestionSnapshot question = snapshot.findQuestion(questionId);
      if (question == null) {
        throw AppException.notFound("Question not found in session snapshot");
      }

      liveStateService.setQuestionState(sessionId, QuestionLifecycleState.TIMED.name());
      liveStateService.setTimer(sessionId, question.timeLimitSeconds());
      liveStateService.recordTimerStartedAt(sessionId, Instant.now().toEpochMilli());

      eventPublisher.publishTimerStart(sessionId, questionId, null, question.timeLimitSeconds());

      long seqAtStart = liveStateService.getQuestionSequence(sessionId);
      timerScheduler.scheduleQuestionTimer(
          sessionId, questionId, question.timeLimitSeconds(), seqAtStart);
    }
  }

  @Transactional
  public void onTimerExpired(Long sessionId) {
    String sid = sessionId.toString();
    String status = liveStateService.getStatus(sessionId);
    if (!SessionStatus.ACTIVE.name().equals(status)) return;

    // Only act if still in TIMED state (guard against double-fire)
    String questionState = liveStateService.getQuestionState(sessionId);
    if (!QuestionLifecycleState.TIMED.name().equals(questionState)) return;

    String currentPassageIdStr = liveStateService.getCurrentPassageId(sessionId);
    String currentQIdStr = liveStateService.getCurrentQuestionId(sessionId);

    if (currentPassageIdStr != null && !currentPassageIdStr.isEmpty()) {
      // ENTIRE_PASSAGE mode — freeze all sub-questions, then grade passage
      Long passageId = Long.parseLong(currentPassageIdStr);
      QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
      QuizSnapshot.PassageSnapshot passage = snapshot.findPassage(passageId);

      List<Long> subQuestionIds = passage != null ? passage.subQuestionIds() : List.of();
      subQuestionIds.forEach(
          qid -> answerRepository.freezeAnswersForQuestion(sessionId, qid, OffsetDateTime.now()));

      eventPublisher.publishPassageFrozen(sessionId, passageId, subQuestionIds);

      gradingService.gradePassage(sessionId, passageId);

    } else {
      // Standalone / PER_SUB_QUESTION question
      if (currentQIdStr != null && !currentQIdStr.isEmpty()) {
        Long questionId = Long.parseLong(currentQIdStr);
        answerRepository.freezeAnswersForQuestion(sessionId, questionId, OffsetDateTime.now());

        eventPublisher.publishQuestionFrozen(sessionId, questionId);

        gradingService.gradeQuestion(sessionId, questionId);
      }
    }

    liveStateService.setQuestionState(sessionId, QuestionLifecycleState.REVIEWING.name());
  }

  @Transactional
  public void doEndSession(Long sessionId) {
    QuizSnapshot snapshot = snapshotService.loadSnapshot(sessionId.toString());
    doEndSession(sessionId, snapshot);
  }

  @Transactional
  public void doEndSession(Long sessionId, QuizSnapshot snapshot) {
    String sid = sessionId.toString();
    timerScheduler.cancelQuestionTimer(sessionId);

    // Freeze and GRADE any outstanding answers before ending
    String currentPassageIdStr = liveStateService.getCurrentPassageId(sessionId);
    String currentQIdStr = liveStateService.getCurrentQuestionId(sessionId);
    String qState = liveStateService.getQuestionState(sessionId);
    boolean shouldGrade =
        QuestionLifecycleState.TIMED.name().equals(qState)
            || QuestionLifecycleState.FROZEN.name().equals(qState);

    if (currentPassageIdStr != null && !currentPassageIdStr.isEmpty()) {
      Long passageId = Long.parseLong(currentPassageIdStr);
      QuizSnapshot.PassageSnapshot passage = snapshot.findPassage(passageId);
      if (passage != null) {
        passage
            .subQuestionIds()
            .forEach(
                qid ->
                    answerRepository.freezeAnswersForQuestion(
                        sessionId, qid, OffsetDateTime.now()));
        if (shouldGrade) {
          gradingService.gradePassage(sessionId, passageId);
        }
      }
    } else if (currentQIdStr != null && !currentQIdStr.isBlank()) {
      Long questionId = Long.parseLong(currentQIdStr);
      answerRepository.freezeAnswersForQuestion(sessionId, questionId, OffsetDateTime.now());
      if (shouldGrade) {
        gradingService.gradeQuestion(sessionId, questionId);
      }
    }

    QuizSession session =
        sessionRepository
            .findById(sessionId)
            .orElseThrow(() -> AppException.notFound("Session not found"));
    String joinCode = session.getJoinCode();

    if (session.getStatus() != SessionStatus.LOBBY) {
      eventPublisher.publishSessionEnd(sessionId);
      eventPublisher.publishSessionEndAnalytics(sessionId);
    }

    session.setStatus(SessionStatus.ENDED);
    session.setEndedAt(OffsetDateTime.now());
    session.setCurrentQuestion(null);
    sessionRepository.save(session);

    liveStateService.cleanupSessionKeys(sessionId, snapshot, joinCode);
  }

  private void displayEntirePassage(
      Long sessionId, QuizSnapshot.PassageSnapshot passage, QuizSnapshot snapshot) {
    List<QuizSnapshot.QuestionSnapshot> subQuestions =
        passage.subQuestionIds().stream()
            .map(snapshot::findQuestion)
            .filter(Objects::nonNull)
            .sorted(Comparator.comparingInt(QuizSnapshot.QuestionSnapshot::orderIndex))
            .toList();

    // last sub-question is the "current" pointer so findNextQuestion advances past the passage
    QuizSnapshot.QuestionSnapshot lastSub = subQuestions.get(subQuestions.size() - 1);
    liveStateService.setCurrentQuestion(sessionId, lastSub.id());
    liveStateService.setCurrentPassage(sessionId, passage.id());
    liveStateService.setQuestionState(sessionId, QuestionLifecycleState.DISPLAYED.name());

    subQuestions.forEach(q -> liveStateService.initQuestionCounts(sessionId, q));

    eventPublisher.publishPassageDisplayed(sessionId, passage, subQuestions, snapshot);
  }

  private QuizSnapshot.QuestionSnapshot findLastSubQuestion(
      QuizSnapshot.PassageSnapshot passage, QuizSnapshot snapshot) {
    return passage.subQuestionIds().stream()
        .map(snapshot::findQuestion)
        .filter(Objects::nonNull)
        .max(Comparator.comparingInt(QuizSnapshot.QuestionSnapshot::orderIndex))
        .orElseThrow(() -> AppException.badRequest("Passage has no sub-questions"));
  }

  private void updateDbCurrentQuestion(Long sessionId, QuizSnapshot.QuestionSnapshot question) {
    sessionRepository
        .findById(sessionId)
        .ifPresent(
            s -> {
              s.setCurrentQuestion(questionRepository.getReferenceById(question.id()));
              sessionRepository.save(s);
            });
  }
}
