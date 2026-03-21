package dev.hishaam.hermes.repository;

import dev.hishaam.hermes.entity.Question;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface QuestionRepository extends JpaRepository<Question, Long> {

  @Query(
      "SELECT q FROM Question q JOIN FETCH q.quiz qu JOIN FETCH qu.event e JOIN FETCH e.user WHERE q.id = :id")
  Optional<Question> findByIdWithOwner(@Param("id") Long id);
}
