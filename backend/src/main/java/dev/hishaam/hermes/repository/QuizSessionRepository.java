package dev.hishaam.hermes.repository;

import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.entity.SessionStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface QuizSessionRepository extends JpaRepository<QuizSession, Long> {
  List<QuizSession> findByQuizIdOrderByCreatedAtDesc(Long quizId);

  boolean existsByQuizIdAndStatusIn(Long quizId, List<SessionStatus> statuses);

  @Query(
      "SELECT s FROM QuizSession s JOIN FETCH s.quiz q JOIN FETCH q.event e JOIN FETCH e.user WHERE s.id = :id")
  Optional<QuizSession> findByIdWithOwner(@Param("id") Long id);
}
