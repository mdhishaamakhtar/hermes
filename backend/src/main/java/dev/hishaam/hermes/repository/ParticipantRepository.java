package dev.hishaam.hermes.repository;

import dev.hishaam.hermes.entity.Participant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ParticipantRepository extends JpaRepository<Participant, Long> {
  Optional<Participant> findByRejoinToken(String rejoinToken);

  /**
   * Bulk delete rather than a derived one, so it executes immediately instead of being queued until
   * flush. Callers delete answers, then participants, then the sessions themselves — and {@code
   * EventService} removes sessions with an immediate batch delete, which would hit the participant
   * foreign key if these removals were still pending. Mirrors {@code
   * ParticipantAnswerRepository#deleteBySessionIdIn}.
   */
  @Modifying
  @Query("DELETE FROM Participant p WHERE p.session.id IN :sessionIds")
  void deleteBySessionIdIn(@Param("sessionIds") List<Long> sessionIds);

  long countBySessionId(Long sessionId);

  List<Participant> findBySessionId(Long sessionId);

  @Query(
      "SELECT p.session.id, COUNT(p) FROM Participant p WHERE p.session.id IN :sessionIds GROUP BY p.session.id")
  List<Object[]> countBySessionIds(@Param("sessionIds") List<Long> sessionIds);

  default Map<Long, Long> countMapBySessionIds(List<Long> sessionIds) {
    return countBySessionIds(sessionIds).stream()
        .collect(Collectors.toMap(r -> (Long) r[0], r -> (Long) r[1]));
  }
}
