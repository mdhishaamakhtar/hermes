package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.entity.ParticipantAnswer;
import dev.hishaam.hermes.repository.ParticipantAnswerRepository;
import dev.hishaam.hermes.repository.redis.SessionLeaderboardRedisRepository;
import dev.hishaam.hermes.repository.redis.SessionTimerRedisRepository;
import dev.hishaam.hermes.service.session.SessionEventPublisher;
import dev.hishaam.hermes.service.session.SessionSnapshotService;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GradingService {

  private final ParticipantAnswerRepository answerRepository;
  private final SessionSnapshotService snapshotService;
  private final SessionTimerRedisRepository timerStore;
  private final SessionLeaderboardRedisRepository leaderboardStore;
  private final SessionEventPublisher eventPublisher;
  private final AnswerScoringService scoringService;

  public GradingService(
      ParticipantAnswerRepository answerRepository,
      SessionSnapshotService snapshotService,
      SessionTimerRedisRepository timerStore,
      SessionLeaderboardRedisRepository leaderboardStore,
      SessionEventPublisher eventPublisher,
      AnswerScoringService scoringService) {
    this.answerRepository = answerRepository;
    this.snapshotService = snapshotService;
    this.timerStore = timerStore;
    this.leaderboardStore = leaderboardStore;
    this.eventPublisher = eventPublisher;
    this.scoringService = scoringService;
  }

  /** Grade a single question (standalone or PER_SUB_QUESTION sub-question). */
  @Transactional
  public void gradeQuestion(Long sessionId, Long questionId) {
    String sid = sessionId.toString();
    QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
    QuizSnapshot.QuestionSnapshot question = snapshot.findQuestion(questionId);
    if (question == null) return;

    Long timerStartedAt = timerStore.getTimerStartedAt(sessionId);
    Map<Long, Integer> participantScores =
        gradeAndSave(sessionId, questionId, question, timerStartedAt);

    // Update leaderboard
    participantScores.forEach(
        (participantId, score) -> leaderboardStore.incrementScore(sessionId, participantId, score));

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

    Long timerStartedAt = timerStore.getTimerStartedAt(sessionId);

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
        (participantId, score) -> leaderboardStore.incrementScore(sessionId, participantId, score));

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
   * Re-grade a question after the host corrects answer keys. Recomputes scores from the updated
   * snapshot, does a full leaderboard recompute from DB, and broadcasts corrected results.
   */
  @Transactional
  public void regradeQuestion(Long sessionId, Long questionId) {
    String sid = sessionId.toString();
    QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
    QuizSnapshot.QuestionSnapshot question = snapshot.findQuestion(questionId);
    if (question == null) return;

    // Re-grade frozen answers for this question using updated point values
    List<ParticipantAnswer> answers =
        answerRepository.findFrozenBySessionIdAndQuestionId(sessionId, questionId);
    for (ParticipantAnswer answer : answers) {
      answer.setScore(scoringService.computeScore(answer, question));
    }
    answerRepository.saveAll(answers);

    // Full leaderboard recompute from DB
    List<ParticipantAnswer> allGraded = answerRepository.findGradedBySessionId(sessionId);
    Map<Long, Long> participantTotals = scoringService.sumScoresByParticipant(allGraded);

    // Update Redis ZSet (best-effort — no-op if Redis state was already cleaned up)
    participantTotals.forEach((pid, total) -> leaderboardStore.setScore(sessionId, pid, total));

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
      int score = scoringService.computeScore(answer, question);
      answer.setScore(score);

      if (answer.getAnsweredAt() != null && timerStartedAt != null) {
        long answerTimeMs =
            scoringService.computeAnswerTimeMs(
                answer.getAnsweredAt(), timerStartedAt, question.timeLimitSeconds());
        leaderboardStore.incrementCumulativeTime(
            sessionId, answer.getParticipantId(), answerTimeMs);
      }

      if (score > 0) {
        participantScores.put(answer.getParticipantId(), score);
      }
    }

    answerRepository.saveAll(answers);
    return participantScores;
  }
}
