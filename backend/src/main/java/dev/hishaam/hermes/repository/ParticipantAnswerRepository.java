package dev.hishaam.hermes.repository;

import dev.hishaam.hermes.entity.ParticipantAnswer;
import jakarta.persistence.LockModeType;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ParticipantAnswerRepository extends JpaRepository<ParticipantAnswer, Long> {

  /** A participant's score and answer time summed over every question of a session. */
  record ParticipantTotal(Long participantId, long score, long answerTimeMs) {}

  @Query("SELECT a FROM ParticipantAnswer a WHERE a.sessionId = :sessionId")
  List<ParticipantAnswer> findBySessionId(Long sessionId);

  @Query("SELECT a FROM ParticipantAnswer a WHERE a.participantId = :participantId")
  List<ParticipantAnswer> findByParticipantId(Long participantId);

  @Query(
      "SELECT a FROM ParticipantAnswer a"
          + " WHERE a.participantId = :participantId AND a.questionId = :questionId")
  Optional<ParticipantAnswer> findByParticipantIdAndQuestionId(
      @Param("participantId") Long participantId, @Param("questionId") Long questionId);

  /**
   * The same lookup, holding a row lock until the transaction ends. Answer changes read the
   * previous selection and then move the live tallies by the difference, so two changes from one
   * participant must not overlap — and a player's client does send duplicates, retrying over HTTP
   * when a WebSocket acknowledgement is slow.
   */
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query(
      "SELECT a FROM ParticipantAnswer a"
          + " WHERE a.participantId = :participantId AND a.questionId = :questionId")
  Optional<ParticipantAnswer> findForUpdate(
      @Param("participantId") Long participantId, @Param("questionId") Long questionId);

  @Query(
      value =
          "SELECT question_id FROM participant_answers"
              + " WHERE participant_id = :participantId AND answered_at IS NOT NULL",
      nativeQuery = true)
  List<Long> findAnsweredQuestionIds(@Param("participantId") Long participantId);

  @Query(
      "SELECT new dev.hishaam.hermes.repository.ParticipantAnswerRepository$ParticipantTotal("
          + "a.participantId, SUM(a.score), COALESCE(SUM(a.answerTimeMs), 0L))"
          + " FROM ParticipantAnswer a WHERE a.sessionId = :sessionId GROUP BY a.participantId")
  List<ParticipantTotal> totalsBySessionId(@Param("sessionId") Long sessionId);

  @Modifying
  @Query("DELETE FROM ParticipantAnswer a WHERE a.sessionId IN :sessionIds")
  void deleteBySessionIdIn(@Param("sessionIds") List<Long> sessionIds);

  /**
   * Counts submitted answers the grading engine has never scored. Used when ending a session whose
   * Redis lifecycle state is gone, to decide whether the in-progress question still needs grading.
   * Already-graded answers count zero, so this cannot trigger a double grade.
   */
  @Query(
      "SELECT COUNT(a) FROM ParticipantAnswer a"
          + " WHERE a.sessionId = :sessionId AND a.questionId IN :questionIds"
          + " AND a.answeredAt IS NOT NULL AND a.gradedAt IS NULL")
  long countUngradedAnswers(
      @Param("sessionId") Long sessionId, @Param("questionIds") List<Long> questionIds);

  @Query(
      "SELECT a FROM ParticipantAnswer a"
          + " WHERE a.sessionId = :sessionId AND a.questionId = :questionId AND a.frozenAt IS NOT NULL")
  List<ParticipantAnswer> findFrozenBySessionIdAndQuestionId(
      @Param("sessionId") Long sessionId, @Param("questionId") Long questionId);

  @Modifying
  @Query(
      "UPDATE ParticipantAnswer a SET a.frozenAt = :frozenAt"
          + " WHERE a.sessionId = :sessionId AND a.questionId = :questionId AND a.frozenAt IS NULL")
  void freezeAnswersForQuestion(
      @Param("sessionId") Long sessionId,
      @Param("questionId") Long questionId,
      @Param("frozenAt") OffsetDateTime frozenAt);
}
