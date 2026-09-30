package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.dto.session.ScoringCorrectionRequest;
import dev.hishaam.hermes.entity.ParticipantAnswer;
import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.entity.enums.QuestionLifecycleState;
import dev.hishaam.hermes.entity.enums.SessionStatus;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.ParticipantAnswerRepository;
import dev.hishaam.hermes.repository.redis.SessionStateRedisRepository;
import dev.hishaam.hermes.service.session.SessionEventPublisher;
import dev.hishaam.hermes.service.session.SessionSnapshotService;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Grading orchestration: computes scores via {@link ScoreCalculator}, persists them, and broadcasts
 * the results. Also handles host scoring corrections (re-grades).
 */
@Service
public class GradingService {

  private final ParticipantAnswerRepository answerRepository;
  private final OwnershipService ownershipService;
  private final SessionSnapshotService snapshotService;
  private final SessionStateRedisRepository stateStore;
  private final SessionEventPublisher eventPublisher;
  private final ScoreCalculator scoreCalculator;

  public GradingService(
      ParticipantAnswerRepository answerRepository,
      OwnershipService ownershipService,
      SessionSnapshotService snapshotService,
      SessionStateRedisRepository stateStore,
      SessionEventPublisher eventPublisher,
      ScoreCalculator scoreCalculator) {
    this.answerRepository = answerRepository;
    this.ownershipService = ownershipService;
    this.snapshotService = snapshotService;
    this.stateStore = stateStore;
    this.eventPublisher = eventPublisher;
    this.scoreCalculator = scoreCalculator;
  }

  /**
   * Grades the frozen answers to the given questions — one standalone question, or every
   * sub-question of an ENTIRE_PASSAGE block — then reveals each answer key and sends the standings
   * once for the lot.
   */
  @Transactional
  public void grade(Long sessionId, QuizSnapshot snapshot, List<Long> questionIds) {
    Long timerStartedAt = stateStore.getTimerStartedAt(sessionId);
    OffsetDateTime gradedAt = OffsetDateTime.now();
    List<QuizSnapshot.QuestionSnapshot> questions =
        questionIds.stream().map(snapshot::requireQuestion).toList();

    for (QuizSnapshot.QuestionSnapshot question : questions) {
      List<ParticipantAnswer> answers =
          answerRepository.findFrozenBySessionIdAndQuestionId(sessionId, question.id());
      for (ParticipantAnswer answer : answers) {
        answer.setScore(scoreCalculator.computeScore(answer, question));
        answer.setGradedAt(gradedAt);
        if (answer.getAnsweredAt() != null && timerStartedAt != null) {
          answer.setAnswerTimeMs(
              scoreCalculator.computeAnswerTimeMs(
                  answer.getAnsweredAt(), timerStartedAt, question.timeLimitSeconds()));
        }
      }
      answerRepository.saveAll(answers);
    }

    questions.forEach(question -> eventPublisher.publishQuestionReviewed(sessionId, question));
    eventPublisher.publishLeaderboard(sessionId);
  }

  /**
   * Host corrects the answer key for a question: validates ownership and lifecycle, rewrites the
   * snapshot's point values, re-scores the frozen answers against them, and broadcasts the
   * corrected key and standings.
   */
  @Transactional
  public void correctScoring(
      Long sessionId, Long questionId, ScoringCorrectionRequest request, Long userId) {
    QuizSession session = ownershipService.requireSessionOwner(sessionId, userId);

    boolean reviewing =
        session.getStatus() == SessionStatus.ACTIVE
            && stateStore.getQuestionState(sessionId) == QuestionLifecycleState.REVIEWING;
    if (!reviewing && session.getStatus() != SessionStatus.ENDED) {
      throw AppException.conflict(
          "Scoring can only be corrected while reviewing or after session ends");
    }

    QuizSnapshot snapshot = snapshotService.loadSnapshot(sessionId);
    snapshot.requireQuestion(questionId);

    Map<Long, Integer> newPointValues =
        request.options().stream()
            .collect(
                Collectors.toMap(
                    ScoringCorrectionRequest.OptionScoring::optionId,
                    ScoringCorrectionRequest.OptionScoring::pointValue));

    QuizSnapshot corrected =
        snapshot.withCorrectedScoring(questionId, newPointValues, OffsetDateTime.now());
    snapshotService.updateSnapshot(sessionId, corrected);
    QuizSnapshot.QuestionSnapshot question = corrected.requireQuestion(questionId);

    List<ParticipantAnswer> answers =
        answerRepository.findFrozenBySessionIdAndQuestionId(sessionId, questionId);
    OffsetDateTime regradedAt = OffsetDateTime.now();
    for (ParticipantAnswer answer : answers) {
      answer.setScore(scoreCalculator.computeScore(answer, question));
      answer.setGradedAt(regradedAt);
    }
    answerRepository.saveAll(answers);

    eventPublisher.publishScoringCorrected(sessionId, question);
    eventPublisher.publishLeaderboard(sessionId);
  }
}
