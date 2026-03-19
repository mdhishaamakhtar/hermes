package dev.hishaam.hermes.repository;

import dev.hishaam.hermes.entity.Event;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface EventRepository extends JpaRepository<Event, Long> {
  List<Event> findByUserIdOrderByCreatedAtDesc(Long userId);

  @Query("SELECT e FROM Event e JOIN FETCH e.user WHERE e.id = :id")
  Optional<Event> findByIdWithUser(@Param("id") Long id);
}
