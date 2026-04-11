package dev.hishaam.hermes.util;

import dev.hishaam.hermes.dto.session.SessionResultsResponse;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

public final class LeaderboardBuilder {

  private LeaderboardBuilder() {}

  /**
   * Ranks participants by score (descending), assigning 1-based sequential ranks. Participants
   * absent from {@code names} fall back to "Unknown".
   */
  public static List<SessionResultsResponse.LeaderboardEntry> rank(
      Map<Long, Long> scores, Map<Long, String> names) {
    AtomicLong rank = new AtomicLong(1);
    return scores.entrySet().stream()
        .sorted(Map.Entry.<Long, Long>comparingByValue().reversed())
        .map(
            e ->
                new SessionResultsResponse.LeaderboardEntry(
                    (int) rank.getAndIncrement(),
                    e.getKey(),
                    names.getOrDefault(e.getKey(), "Unknown"),
                    e.getValue()))
        .toList();
  }
}
