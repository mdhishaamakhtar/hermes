package dev.hishaam.hermes.repository;

import dev.hishaam.hermes.entity.ParticipantAnswer;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ParticipantAnswerRepository extends JpaRepository<ParticipantAnswer, Long> {

  List<ParticipantAnswer> findBySessionId(Long sessionId);

  List<ParticipantAnswer> findByParticipantId(Long participantId);

  List<ParticipantAnswer> findBySessionIdAndQuestionId(Long sessionId, Long questionId);

  List<Long> findQuestionIdByParticipantId(Long participantId);

  @Query(
      value = "SELECT question_id FROM participant_answers WHERE participant_id = :participantId",
      nativeQuery = true)
  List<Long> findAnsweredQuestionIds(@Param("participantId") Long participantId);

  @Modifying
  @Query(
      value =
          "INSERT INTO participant_answers"
              + " (session_id, participant_id, question_id, option_id, is_correct, answered_at)"
              + " VALUES (:sessionId, :participantId, :questionId, :optionId, :isCorrect, now())"
              + " ON CONFLICT (participant_id, question_id) DO NOTHING",
      nativeQuery = true)
  int insertAnswerIgnoreConflict(
      @Param("sessionId") Long sessionId,
      @Param("participantId") Long participantId,
      @Param("questionId") Long questionId,
      @Param("optionId") Long optionId,
      @Param("isCorrect") boolean isCorrect);
}
