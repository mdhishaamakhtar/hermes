package dev.hishaam.hermes.repository;

import dev.hishaam.hermes.entity.Quiz;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface QuizRepository extends JpaRepository<Quiz, Long> {

  @Query("SELECT q FROM Quiz q JOIN FETCH q.event e JOIN FETCH e.user WHERE q.id = :id")
  Optional<Quiz> findByIdWithOwner(@Param("id") Long id);

  @Query("SELECT DISTINCT q FROM Quiz q LEFT JOIN FETCH q.questions WHERE q.id = :id")
  Optional<Quiz> findByIdWithQuestions(@Param("id") Long id);

  @Query(
      "SELECT DISTINCT q FROM Quiz q "
          + "LEFT JOIN FETCH q.questions qu "
          + "LEFT JOIN FETCH qu.options "
          + "LEFT JOIN FETCH q.passages p "
          + "LEFT JOIN FETCH p.subQuestions sq "
          + "LEFT JOIN FETCH sq.options "
          + "WHERE q.id = :id")
  Optional<Quiz> findByIdWithQuestionsAndPassages(@Param("id") Long id);
}
