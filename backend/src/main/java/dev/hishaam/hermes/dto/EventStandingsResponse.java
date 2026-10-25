package dev.hishaam.hermes.dto;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Standings across an event's rounds: each quiz's latest finished session, added up. Players are
 * anonymous to each session, so a player is matched across rounds by the name they joined with.
 */
public record EventStandingsResponse(Long eventId, List<Round> rounds, List<Entry> standings) {

  public record Round(Long quizId, String quizTitle, Long sessionId, OffsetDateTime endedAt) {}

  /** {@code roundScores} follows {@code rounds}; null where the player sat a round out. */
  public record Entry(int rank, String displayName, long total, List<Long> roundScores) {}
}
