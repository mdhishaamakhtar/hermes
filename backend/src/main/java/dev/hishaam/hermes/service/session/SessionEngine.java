package dev.hishaam.hermes.service.session;

import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.entity.SessionStatus;
import dev.hishaam.hermes.entity.enums.PassageTimerMode;
import dev.hishaam.hermes.entity.enums.QuestionLifecycleState;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.ParticipantAnswerRepository;
import dev.hishaam.hermes.repository.QuizSessionRepository;
import dev.hishaam.hermes.repository.redis.SessionAnswerStatsRedisRepository;
import dev.hishaam.hermes.repository.redis.SessionStateRedisRepository;
import dev.hishaam.hermes.service.*;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Transactional engine for session lifecycle: question advancement and session end. Timer start and
 * expiry have been extracted to {@link SessionTimerOrchestrator}.
 */
@Service
public class SessionEngine {

  private final QuizSessionRepository sessionRepository;
  private final ParticipantAnswerRepository answerRepository;
  private final SessionSnapshotService snapshotService;
  private final SessionStateRedisRepository stateStore;
  private final SessionAnswerStatsRedisRepository answerStatsStore;
  private final SessionEventPublisher eventPublisher;
  private final SessionTimerScheduler timerScheduler;
  private final GradingService gradingService;

  public SessionEngine(
      QuizSessionRepository sessionRepository,
      ParticipantAnswerRepository answerRepository,
      SessionSnapshotService snapshotService,
      SessionStateRedisRepository stateStore,
      SessionAnswerStatsRedisRepository answerStatsStore,
      SessionEventPublisher eventPublisher,
      SessionTimerScheduler timerScheduler,
      GradingService gradingService) {
    this.sessionRepository = sessionRepository;
    this.answerRepository = answerRepository;
    this.snapshotService = snapshotService;
    this.stateStore = stateStore;
    this.answerStatsStore = answerStatsStore;
    this.eventPublisher = eventPublisher;
    this.timerScheduler = timerScheduler;
    this.gradingService = gradingService;
  }

  @Transactional
  public void advanceSessionInternal(Long sessionId) {
    String sid = sessionId.toString();
    String status = stateStore.getStatus(sessionId);
    if (!SessionStatus.ACTIVE.name().equals(status)) return;

    QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
    String currentQIdStr = stateStore.getCurrentQuestionId(sessionId);
    Long currentQId =
        (currentQIdStr != null && !currentQIdStr.isEmpty()) ? Long.parseLong(currentQIdStr) : null;

    QuizSnapshot.QuestionSnapshot next = snapshot.findNextQuestion(currentQId);
    if (next == null) {
      doEndSession(sessionId, snapshot);
      return;
    }

    if (next.passageId() != null) {
      QuizSnapshot.PassageSnapshot passage = snapshot.findPassage(next.passageId());
      if (passage != null && PassageTimerMode.ENTIRE_PASSAGE == passage.timerMode()) {
        displayEntirePassage(sessionId, passage, snapshot);
        updateDbCurrentQuestion(sessionId, findLastSubQuestion(passage, snapshot));
        return;
      }
    }

    stateStore.setCurrentQuestion(sessionId, next.id());
    stateStore.clearCurrentPassage(sessionId);
    stateStore.setQuestionState(sessionId, QuestionLifecycleState.DISPLAYED.name());
    answerStatsStore.initQuestionCounts(sessionId, next);
    eventPublisher.publishQuestionDisplayed(sessionId, next, snapshot);
    updateDbCurrentQuestion(sessionId, next);
  }

  @Transactional
  public void doEndSession(Long sessionId) {
    QuizSnapshot snapshot = snapshotService.loadSnapshot(sessionId.toString());
    doEndSession(sessionId, snapshot);
  }

  @Transactional
  public void doEndSession(Long sessionId, QuizSnapshot snapshot) {
    timerScheduler.cancelQuestionTimer(sessionId);

    String currentPassageIdStr = stateStore.getCurrentPassageId(sessionId);
    String currentQIdStr = stateStore.getCurrentQuestionId(sessionId);
    String qState = stateStore.getQuestionState(sessionId);
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
    session.setCurrentQuestionId(null);
    sessionRepository.save(session);

    stateStore.cleanupSessionKeys(sessionId, snapshot, joinCode);
  }

  private void displayEntirePassage(
      Long sessionId, QuizSnapshot.PassageSnapshot passage, QuizSnapshot snapshot) {
    List<QuizSnapshot.QuestionSnapshot> subQuestions =
        passage.subQuestionIds().stream()
            .map(snapshot::findQuestion)
            .filter(Objects::nonNull)
            .sorted(Comparator.comparingInt(QuizSnapshot.QuestionSnapshot::orderIndex))
            .toList();

    QuizSnapshot.QuestionSnapshot lastSub = subQuestions.get(subQuestions.size() - 1);
    stateStore.setCurrentQuestion(sessionId, lastSub.id());
    stateStore.setCurrentPassage(sessionId, passage.id());
    stateStore.setQuestionState(sessionId, QuestionLifecycleState.DISPLAYED.name());
    subQuestions.forEach(q -> answerStatsStore.initQuestionCounts(sessionId, q));
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
              s.setCurrentQuestionId(question.id());
              sessionRepository.save(s);
            });
  }
}
