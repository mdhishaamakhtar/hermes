package dev.hishaam.hermes.repository;

import dev.hishaam.hermes.entity.ParticipantAnswer;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ParticipantAnswerRepository extends JpaRepository<ParticipantAnswer, Long> {

  @Query(
      "SELECT DISTINCT a FROM ParticipantAnswer a LEFT JOIN FETCH a.selectedOptions WHERE a.sessionId = :sessionId")
  List<ParticipantAnswer> findBySessionId(Long sessionId);

  @Query(
      "SELECT DISTINCT a FROM ParticipantAnswer a LEFT JOIN FETCH a.selectedOptions WHERE a.participantId = :participantId")
  List<ParticipantAnswer> findByParticipantId(Long participantId);

  @Query(
      "SELECT DISTINCT a FROM ParticipantAnswer a LEFT JOIN FETCH a.selectedOptions"
          + " WHERE a.participantId = :participantId AND a.questionId = :questionId")
  Optional<ParticipantAnswer> findByParticipantIdAndQuestionId(
      @Param("participantId") Long participantId, @Param("questionId") Long questionId);

  @Query(
      value =
          "SELECT question_id FROM participant_answers"
              + " WHERE participant_id = :participantId AND answered_at IS NOT NULL",
      nativeQuery = true)
  List<Long> findAnsweredQuestionIds(@Param("participantId") Long participantId);

  @Modifying
  @Query("DELETE FROM ParticipantAnswer a WHERE a.sessionId IN :sessionIds")
  void deleteBySessionIdIn(@Param("sessionIds") List<Long> sessionIds);

  @Modifying
  @Query(
      value =
          "DELETE FROM participant_answer_selections"
              + " WHERE participant_answer_id IN ("
              + "   SELECT id FROM participant_answers WHERE session_id IN (:sessionIds)"
              + " )",
      nativeQuery = true)
  void deleteSelectionsBySessionIdIn(@Param("sessionIds") List<Long> sessionIds);

  @Query("SELECT a FROM ParticipantAnswer a WHERE a.sessionId = :sessionId AND a.score IS NOT NULL")
  List<ParticipantAnswer> findGradedBySessionId(@Param("sessionId") Long sessionId);

  @Query(
      "SELECT DISTINCT a FROM ParticipantAnswer a LEFT JOIN FETCH a.selectedOptions"
          + " WHERE a.sessionId = :sessionId AND a.questionId = :questionId AND a.frozenAt IS NOT NULL")
  List<ParticipantAnswer> findFrozenBySessionIdAndQuestionId(
      @Param("sessionId") Long sessionId, @Param("questionId") Long questionId);

  @Modifying
  @Query(
      "UPDATE ParticipantAnswer a SET a.frozenAt = :frozenAt"
          + " WHERE a.sessionId = :sessionId AND a.questionId = :questionId AND a.frozenAt IS NULL")
  int freezeAnswersForQuestion(
      @Param("sessionId") Long sessionId,
      @Param("questionId") Long questionId,
      @Param("frozenAt") OffsetDateTime frozenAt);

  @Query(
      value = "SELECT COUNT(*) FROM participant_answer_selections WHERE option_id IN :optionIds",
      nativeQuery = true)
  long countSelectionsForOptions(@Param("optionIds") List<Long> optionIds);
}
