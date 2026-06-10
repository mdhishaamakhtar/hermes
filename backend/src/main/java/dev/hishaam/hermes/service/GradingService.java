package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.dto.session.ScoringCorrectionRequest;
import dev.hishaam.hermes.entity.ParticipantAnswer;
import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.entity.SessionStatus;
import dev.hishaam.hermes.entity.enums.QuestionLifecycleState;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.ParticipantAnswerRepository;
import dev.hishaam.hermes.repository.redis.SessionScoringRedisRepository;
import dev.hishaam.hermes.repository.redis.SessionStateRedisRepository;
import dev.hishaam.hermes.service.session.SessionEventPublisher;
import dev.hishaam.hermes.service.session.SessionSnapshotService;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Grading orchestration: computes scores via {@link ScoreCalculator}, persists them, updates the
 * leaderboard, and broadcasts results. Also handles host scoring corrections (re-grades).
 */
@Service
public class GradingService {

  private final ParticipantAnswerRepository answerRepository;
  private final OwnershipService ownershipService;
  private final SessionSnapshotService snapshotService;
  private final SessionStateRedisRepository stateStore;
  private final SessionScoringRedisRepository scoringStore;
  private final SessionEventPublisher eventPublisher;
  private final ScoreCalculator scoreCalculator;

  public GradingService(
      ParticipantAnswerRepository answerRepository,
      OwnershipService ownershipService,
      SessionSnapshotService snapshotService,
      SessionStateRedisRepository stateStore,
      SessionScoringRedisRepository scoringStore,
      SessionEventPublisher eventPublisher,
      ScoreCalculator scoreCalculator) {
    this.answerRepository = answerRepository;
    this.ownershipService = ownershipService;
    this.snapshotService = snapshotService;
    this.stateStore = stateStore;
    this.scoringStore = scoringStore;
    this.eventPublisher = eventPublisher;
    this.scoreCalculator = scoreCalculator;
  }

  /** Grade a single question (standalone or PER_SUB_QUESTION sub-question). */
  @Transactional
  public void gradeQuestion(Long sessionId, Long questionId) {
    String sid = sessionId.toString();
    QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
    QuizSnapshot.QuestionSnapshot question = snapshot.findQuestion(questionId);
    if (question == null) return;

    Long timerStartedAt = stateStore.getTimerStartedAt(sessionId);
    Map<Long, Integer> participantScores =
        gradeAndSave(sessionId, questionId, question, timerStartedAt);

    // Update leaderboard
    participantScores.forEach(
        (participantId, score) -> scoringStore.incrementScore(sessionId, participantId, score));

    eventPublisher.publishQuestionReviewed(sessionId, questionId, question);
    eventPublisher.publishLeaderboardUpdates(sessionId);
  }

  /** Grade all sub-questions of an ENTIRE_PASSAGE passage together. */
  @Transactional
  public void gradePassage(Long sessionId, Long passageId) {
    String sid = sessionId.toString();
    QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
    QuizSnapshot.PassageSnapshot passage = snapshot.findPassage(passageId);
    if (passage == null) return;

    Long timerStartedAt = stateStore.getTimerStartedAt(sessionId);

    // Grade each sub-question; accumulate per-participant totals for one leaderboard update
    Map<Long, Integer> totalScores = new HashMap<>();
    for (Long subQuestionId : passage.subQuestionIds()) {
      QuizSnapshot.QuestionSnapshot question = snapshot.findQuestion(subQuestionId);
      if (question == null) continue;

      Map<Long, Integer> scores = gradeAndSave(sessionId, subQuestionId, question, timerStartedAt);
      scores.forEach(
          (pid, s) ->
              totalScores.merge(
                  pid,
                  s,
                  (a, b) -> Integer.sum(Objects.requireNonNull(a), Objects.requireNonNull(b))));
    }

    // Single leaderboard update for the whole passage
    totalScores.forEach(
        (participantId, score) -> scoringStore.incrementScore(sessionId, participantId, score));

    // Broadcast QUESTION_REVIEWED for each sub-question
    for (Long subQuestionId : passage.subQuestionIds()) {
      QuizSnapshot.QuestionSnapshot question = snapshot.findQuestion(subQuestionId);
      if (question != null) {
        eventPublisher.publishQuestionReviewed(sessionId, subQuestionId, question);
      }
    }
    eventPublisher.publishLeaderboardUpdates(sessionId);
  }

  /**
   * Host corrects the answer key for a question: validates ownership and lifecycle, rewrites the
   * snapshot's point values, then re-grades.
   */
  @Transactional
  public void correctScoring(
      Long sessionId, Long questionId, ScoringCorrectionRequest request, Long userId) {
    QuizSession session = ownershipService.requireSessionOwner(sessionId, userId);

    if (session.getStatus() == SessionStatus.ACTIVE) {
      String questionState = stateStore.getQuestionState(sessionId);
      if (!QuestionLifecycleState.REVIEWING.name().equals(questionState)) {
        throw AppException.conflict(
            "Scoring can only be corrected while reviewing or after session ends");
      }
    } else if (session.getStatus() != SessionStatus.ENDED) {
      throw AppException.conflict(
          "Scoring can only be corrected while reviewing or after session ends");
    }

    String sid = sessionId.toString();
    QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
    if (snapshot.findQuestion(questionId) == null) {
      throw AppException.notFound("Question not found in session snapshot");
    }

    Map<Long, Integer> newPointValues =
        request.options().stream()
            .collect(
                Collectors.toMap(
                    ScoringCorrectionRequest.OptionScoring::optionId,
                    ScoringCorrectionRequest.OptionScoring::pointValue));

    QuizSnapshot updated =
        snapshot.withCorrectedScoring(questionId, newPointValues, OffsetDateTime.now());
    snapshotService.updateSnapshot(sid, sessionId, updated);

    regradeQuestion(sessionId, questionId);
  }

  /**
   * Re-grade a question after the host corrects answer keys. Recomputes scores from the updated
   * snapshot, does a full leaderboard recompute from DB, and broadcasts corrected results.
   */
  private void regradeQuestion(Long sessionId, Long questionId) {
    String sid = sessionId.toString();
    QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
    QuizSnapshot.QuestionSnapshot question = snapshot.findQuestion(questionId);
    if (question == null) return;

    // Re-grade frozen answers for this question using updated point values
    List<ParticipantAnswer> answers =
        answerRepository.findFrozenBySessionIdAndQuestionId(sessionId, questionId);
    for (ParticipantAnswer answer : answers) {
      answer.setScore(scoreCalculator.computeScore(answer, question));
    }
    answerRepository.saveAll(answers);

    // Full leaderboard recompute from DB
    List<ParticipantAnswer> allGraded = answerRepository.findGradedBySessionId(sessionId);
    Map<Long, Long> participantTotals = scoreCalculator.sumScoresByParticipant(allGraded);

    // Update Redis ZSet (best-effort — no-op if Redis state was already cleaned up)
    participantTotals.forEach((pid, total) -> scoringStore.setScore(sessionId, pid, total));

    eventPublisher.publishScoringCorrected(sessionId, questionId, question);
    eventPublisher.publishLeaderboardFromDb(sessionId, participantTotals);
  }

  /**
   * Computes and persists scores for all frozen answers to the given question. Returns a map of
   * participantId → questionScore for leaderboard updates.
   */
  private Map<Long, Integer> gradeAndSave(
      Long sessionId,
      Long questionId,
      QuizSnapshot.QuestionSnapshot question,
      Long timerStartedAt) {
    List<ParticipantAnswer> answers =
        answerRepository.findFrozenBySessionIdAndQuestionId(sessionId, questionId);

    Map<Long, Integer> participantScores = new HashMap<>();

    for (ParticipantAnswer answer : answers) {
      int score = scoreCalculator.computeScore(answer, question);
      answer.setScore(score);

      if (answer.getAnsweredAt() != null && timerStartedAt != null) {
        long answerTimeMs =
            scoreCalculator.computeAnswerTimeMs(
                answer.getAnsweredAt(), timerStartedAt, question.timeLimitSeconds());
        scoringStore.incrementCumulativeTime(sessionId, answer.getParticipantId(), answerTimeMs);
      }

      if (score > 0) {
        participantScores.put(answer.getParticipantId(), score);
      }
    }

    answerRepository.saveAll(answers);
    return participantScores;
  }
}
