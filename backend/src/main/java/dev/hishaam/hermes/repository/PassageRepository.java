package dev.hishaam.hermes.repository;

import dev.hishaam.hermes.entity.Passage;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface PassageRepository extends JpaRepository<Passage, Long> {

  @Query(
      "SELECT p FROM Passage p JOIN FETCH p.quiz q JOIN FETCH q.event e JOIN FETCH e.user WHERE p.id = :id")
  Optional<Passage> findByIdWithOwner(@Param("id") Long id);
}
