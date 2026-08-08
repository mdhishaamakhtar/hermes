package dev.hishaam.hermes.repository;

import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.entity.enums.SessionStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface QuizSessionRepository extends JpaRepository<QuizSession, Long> {
  List<QuizSession> findByQuizIdOrderByCreatedAtDesc(Long quizId);

  /**
   * Projects ids only. Deletion paths bulk-delete sessions and then cascade-remove the owning quiz
   * or event; loading the session entities first would leave them managed and stale, and Hibernate
   * would fail the flush on their now-removed quiz reference.
   */
  @Query("SELECT s.id FROM QuizSession s WHERE s.quiz.id IN :quizIds")
  List<Long> findIdsByQuizIdIn(@Param("quizIds") List<Long> quizIds);

  boolean existsByQuizIdAndStatusIn(Long quizId, List<SessionStatus> statuses);

  @Query(
      "SELECT s FROM QuizSession s JOIN FETCH s.quiz q JOIN FETCH q.event e JOIN FETCH e.user WHERE s.id = :id")
  Optional<QuizSession> findByIdWithOwner(@Param("id") Long id);
}
