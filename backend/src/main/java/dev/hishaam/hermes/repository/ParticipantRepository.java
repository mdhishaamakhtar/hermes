package dev.hishaam.hermes.repository;

import dev.hishaam.hermes.entity.Participant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ParticipantRepository extends JpaRepository<Participant, Long> {
  Optional<Participant> findByRejoinToken(String rejoinToken);

  void deleteBySessionIdIn(List<Long> sessionIds);

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
