package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.QuizSnapshot;
import dev.hishaam.hermes.dto.SessionResultsResponse;
import dev.hishaam.hermes.dto.WsPayloads;
import dev.hishaam.hermes.entity.AnswerOption;
import dev.hishaam.hermes.entity.ParticipantAnswer;
import dev.hishaam.hermes.repository.ParticipantAnswerRepository;
import dev.hishaam.hermes.repository.ParticipantRepository;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GradingService {

  private final ParticipantAnswerRepository answerRepository;
  private final ParticipantRepository participantRepository;
  private final SessionSnapshotService snapshotService;
  private final SessionLiveStateService liveStateService;
  private final SimpMessagingTemplate messaging;

  public GradingService(
      ParticipantAnswerRepository answerRepository,
      ParticipantRepository participantRepository,
      SessionSnapshotService snapshotService,
      SessionLiveStateService liveStateService,
      SimpMessagingTemplate messaging) {
    this.answerRepository = answerRepository;
    this.participantRepository = participantRepository;
    this.snapshotService = snapshotService;
    this.liveStateService = liveStateService;
    this.messaging = messaging;
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  /** Grade a single question (standalone or PER_SUB_QUESTION sub-question). */
  @Transactional
  public void gradeQuestion(Long sessionId, Long questionId) {
    String sid = sessionId.toString();
    QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
    QuizSnapshot.QuestionSnapshot question = snapshot.findQuestion(questionId);
    if (question == null) return;

    Long timerStartedAt = liveStateService.getTimerStartedAt(sid);
    Map<Long, Integer> participantScores =
        gradeAndSave(sessionId, questionId, question, timerStartedAt);

    // Update leaderboard
    participantScores.forEach(
        (participantId, score) ->
            liveStateService.incrementLeaderboardScore(sid, participantId, score));

    broadcastQuestionReviewed(sessionId, questionId, question);
    broadcastLeaderboardUpdates(sessionId, sid);
  }

  /** Grade all sub-questions of an ENTIRE_PASSAGE passage together. */
  @Transactional
  public void gradePassage(Long sessionId, Long passageId) {
    String sid = sessionId.toString();
    QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
    QuizSnapshot.PassageSnapshot passage = snapshot.findPassage(passageId);
    if (passage == null) return;

    Long timerStartedAt = liveStateService.getTimerStartedAt(sid);

    // Grade each sub-question; accumulate per-participant totals for one leaderboard update
    Map<Long, Integer> totalScores = new HashMap<>();
    for (Long subQuestionId : passage.subQuestionIds()) {
      QuizSnapshot.QuestionSnapshot question = snapshot.findQuestion(subQuestionId);
      if (question == null) continue;

      Map<Long, Integer> scores = gradeAndSave(sessionId, subQuestionId, question, timerStartedAt);
      scores.forEach((pid, s) -> totalScores.merge(pid, s, Integer::sum));
    }

    // Single leaderboard update for the whole passage
    totalScores.forEach(
        (participantId, score) ->
            liveStateService.incrementLeaderboardScore(sid, participantId, score));

    // Broadcast QUESTION_REVIEWED for each sub-question
    for (Long subQuestionId : passage.subQuestionIds()) {
      QuizSnapshot.QuestionSnapshot question = snapshot.findQuestion(subQuestionId);
      if (question != null) {
        broadcastQuestionReviewed(sessionId, subQuestionId, question);
      }
    }
    broadcastLeaderboardUpdates(sessionId, sid);
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
      answer.setScore(computeScore(answer, question));
    }
    answerRepository.saveAll(answers);

    // Full leaderboard recompute from DB
    List<ParticipantAnswer> allGraded = answerRepository.findGradedBySessionId(sessionId);
    Map<Long, Long> participantTotals = new HashMap<>();
    for (ParticipantAnswer a : allGraded) {
      participantTotals.merge(
          a.getParticipantId(), Long.valueOf(a.getScore() != null ? a.getScore() : 0), Long::sum);
    }

    // Update Redis ZSet (best-effort — no-op if Redis state was already cleaned up)
    participantTotals.forEach(
        (pid, total) -> liveStateService.setLeaderboardScore(sid, pid, total));

    broadcastScoringCorrected(sessionId, questionId, question);
    broadcastLeaderboardFromDb(sessionId, participantTotals);
  }

  // ─── Core grading logic ───────────────────────────────────────────────────────

  /**
   * Computes and persists scores for all frozen answers to the given question. Returns a map of
   * participantId → questionScore for leaderboard updates.
   */
  private Map<Long, Integer> gradeAndSave(
      Long sessionId,
      Long questionId,
      QuizSnapshot.QuestionSnapshot question,
      Long timerStartedAt) {
    String sid = sessionId.toString();
    List<ParticipantAnswer> answers =
        answerRepository.findFrozenBySessionIdAndQuestionId(sessionId, questionId);

    Map<Long, Integer> participantScores = new HashMap<>();

    for (ParticipantAnswer answer : answers) {
      int score = computeScore(answer, question);
      answer.setScore(score);

      if (answer.getAnsweredAt() != null && timerStartedAt != null) {
        long answerTimeMs =
            computeAnswerTimeMs(
                answer.getAnsweredAt(), timerStartedAt, question.timeLimitSeconds());
        liveStateService.incrementCumulativeTime(sid, answer.getParticipantId(), answerTimeMs);
      }

      if (score > 0) {
        participantScores.put(answer.getParticipantId(), score);
      }
    }

    answerRepository.saveAll(answers);
    return participantScores;
  }

  private int computeScore(ParticipantAnswer answer, QuizSnapshot.QuestionSnapshot question) {
    Map<Long, Integer> pointsByOptionId = new LinkedHashMap<>();
    question.options().forEach(o -> pointsByOptionId.put(o.id(), o.pointValue()));

    int rawScore =
        answer.getSelectedOptions().stream()
            .map(AnswerOption::getId)
            .map(pointsByOptionId::get)
            .filter(Objects::nonNull)
            .mapToInt(Integer::intValue)
            .sum();

    return Math.max(rawScore, 0);
  }

  private long computeAnswerTimeMs(
      OffsetDateTime answeredAt, long timerStartedAtEpochMs, int timeLimitSeconds) {
    long answeredAtMs = answeredAt.toInstant().toEpochMilli();
    long elapsed = answeredAtMs - timerStartedAtEpochMs;
    // Cap at the question's time limit to guard against clock skew or late writes
    long maxMs = (long) timeLimitSeconds * 1000;
    return Math.min(Math.max(elapsed, 0L), maxMs);
  }

  // ─── Broadcasting ─────────────────────────────────────────────────────────────

  private void broadcastQuestionReviewed(
      Long sessionId, Long questionId, QuizSnapshot.QuestionSnapshot question) {
    List<Long> correctOptionIds =
        question.options().stream()
            .filter(o -> o.pointValue() > 0)
            .map(QuizSnapshot.OptionSnapshot::id)
            .toList();

    Map<Long, Integer> optionPoints = new LinkedHashMap<>();
    question.options().forEach(o -> optionPoints.put(o.id(), o.pointValue()));

    messaging.convertAndSend(
        "/topic/session." + sessionId + ".question",
        new WsPayloads.QuestionReviewed(questionId, correctOptionIds, optionPoints));

    // For BLIND/CODE_DISPLAY modes, reveal the full answer distribution after grading
    String mode = question.effectiveDisplayMode();
    if ("BLIND".equals(mode) || "CODE_DISPLAY".equals(mode)) {
      String sid = sessionId.toString();
      Map<Long, Long> counts = liveStateService.getQuestionCounts(sid, questionId);
      long totalAnswered = liveStateService.getTotalAnswered(sid, questionId);
      long totalParticipants = liveStateService.getParticipantCount(sid);

      messaging.convertAndSend(
          "/topic/session." + sessionId + ".analytics",
          new WsPayloads.AnswerReveal(questionId, counts, totalAnswered, totalParticipants));
    }
  }

  private void broadcastScoringCorrected(
      Long sessionId, Long questionId, QuizSnapshot.QuestionSnapshot question) {
    List<Long> correctOptionIds =
        question.options().stream()
            .filter(o -> o.pointValue() > 0)
            .map(QuizSnapshot.OptionSnapshot::id)
            .toList();

    Map<Long, Integer> optionPoints = new LinkedHashMap<>();
    question.options().forEach(o -> optionPoints.put(o.id(), o.pointValue()));

    messaging.convertAndSend(
        "/topic/session." + sessionId + ".question",
        new WsPayloads.ScoringCorrected(questionId, correctOptionIds, optionPoints));
  }

  private void broadcastLeaderboardFromDb(Long sessionId, Map<Long, Long> participantTotals) {
    Map<Long, String> names = new HashMap<>();
    participantRepository
        .findBySessionId(sessionId)
        .forEach(p -> names.put(p.getId(), p.getDisplayName()));
    long totalParticipants = participantRepository.countBySessionId(sessionId);

    AtomicLong rank = new AtomicLong(1);
    List<SessionResultsResponse.LeaderboardEntry> leaderboard =
        participantTotals.entrySet().stream()
            .sorted(Map.Entry.<Long, Long>comparingByValue().reversed())
            .map(
                e ->
                    new SessionResultsResponse.LeaderboardEntry(
                        (int) rank.getAndIncrement(),
                        e.getKey(),
                        names.getOrDefault(e.getKey(), "Unknown"),
                        e.getValue()))
            .toList();

    messaging.convertAndSend(
        "/topic/session." + sessionId + ".analytics",
        new WsPayloads.LeaderboardUpdate(leaderboard));

    messaging.convertAndSend(
        "/topic/session." + sessionId + ".question",
        new WsPayloads.ParticipantLeaderboard(
            leaderboard.stream()
                .map(
                    e ->
                        new WsPayloads.ParticipantLeaderboardEntry(
                            e.participantId(), e.rank(), e.displayName(), e.score()))
                .toList(),
            totalParticipants));
  }

  private void broadcastLeaderboardUpdates(Long sessionId, String sid) {
    List<SessionResultsResponse.LeaderboardEntry> leaderboard =
        liveStateService.buildLeaderboard(sid);
    long totalParticipants = liveStateService.getParticipantCount(sid);

    // Full leaderboard to organiser
    messaging.convertAndSend(
        "/topic/session." + sessionId + ".analytics",
        new WsPayloads.LeaderboardUpdate(leaderboard));

    messaging.convertAndSend(
        "/topic/session." + sessionId + ".question",
        new WsPayloads.ParticipantLeaderboard(
            leaderboard.stream()
                .sorted(Comparator.comparingInt(SessionResultsResponse.LeaderboardEntry::rank))
                .map(
                    e ->
                        new WsPayloads.ParticipantLeaderboardEntry(
                            e.participantId(), e.rank(), e.displayName(), e.score()))
                .toList(),
            totalParticipants));
  }
}
