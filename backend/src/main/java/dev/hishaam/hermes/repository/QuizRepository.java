package dev.hishaam.hermes.repository;

import dev.hishaam.hermes.entity.Quiz;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface QuizRepository extends JpaRepository<Quiz, Long> {

  @Query("SELECT q FROM Quiz q JOIN FETCH q.event e JOIN FETCH e.user WHERE q.id = :id")
  Optional<Quiz> findByIdWithOwner(@Param("id") Long id);

  @Query(
      "SELECT q FROM Quiz q JOIN FETCH q.event e WHERE e.user.id = :userId ORDER BY q.createdAt DESC")
  List<Quiz> findByOwner(@Param("userId") Long userId);

  @Query("SELECT DISTINCT q FROM Quiz q LEFT JOIN FETCH q.questions WHERE q.id = :id")
  Optional<Quiz> findByIdWithQuestions(@Param("id") Long id);
}
