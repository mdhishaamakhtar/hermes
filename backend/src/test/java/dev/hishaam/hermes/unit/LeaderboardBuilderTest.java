package dev.hishaam.hermes.unit;

import static org.assertj.core.api.Assertions.assertThat;

import dev.hishaam.hermes.dto.session.SessionResultsResponse;
import dev.hishaam.hermes.util.LeaderboardBuilder;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for leaderboard ranking helpers.
 *
 * <p>This class verifies the pure ranking logic only: ordering, rank assignment, tie handling, and
 * name fallback behavior. It does not exercise any database, Redis, or session orchestration code.
 */
class LeaderboardBuilderTest {

  /**
   * Verifies that leaderboard entries are sorted by score in descending order and that ranks are
   * assigned sequentially from one.
   */
  @Test
  void ranksParticipantsByScoreInDescendingOrder() {
    Map<Long, Long> scores = new LinkedHashMap<>();
    scores.put(20L, 15L);
    scores.put(10L, 30L);
    scores.put(30L, 5L);

    Map<Long, String> names = Map.of(10L, "Ava", 20L, "Noah", 30L, "Mia");

    List<SessionResultsResponse.LeaderboardEntry> ranked = LeaderboardBuilder.rank(scores, names);

    assertThat(ranked)
        .extracting(
            SessionResultsResponse.LeaderboardEntry::rank,
            SessionResultsResponse.LeaderboardEntry::participantId,
            SessionResultsResponse.LeaderboardEntry::displayName,
            SessionResultsResponse.LeaderboardEntry::score)
        .containsExactly(
            org.assertj.core.groups.Tuple.tuple(1, 10L, "Ava", 30L),
            org.assertj.core.groups.Tuple.tuple(2, 20L, "Noah", 15L),
            org.assertj.core.groups.Tuple.tuple(3, 30L, "Mia", 5L));
  }

  /**
   * Verifies that tied scores retain the input iteration order and that missing participant names
   * fall back to {@code Unknown}.
   */
  @Test
  void preservesStableOrderForTiesAndFallsBackToUnknownNames() {
    Map<Long, Long> scores = new LinkedHashMap<>();
    scores.put(1L, 12L);
    scores.put(2L, 12L);
    scores.put(3L, 3L);

    Map<Long, String> names = Map.of(1L, "First");

    List<SessionResultsResponse.LeaderboardEntry> ranked = LeaderboardBuilder.rank(scores, names);

    assertThat(ranked)
        .extracting(
            SessionResultsResponse.LeaderboardEntry::rank,
            SessionResultsResponse.LeaderboardEntry::participantId,
            SessionResultsResponse.LeaderboardEntry::displayName,
            SessionResultsResponse.LeaderboardEntry::score)
        .containsExactly(
            org.assertj.core.groups.Tuple.tuple(1, 1L, "First", 12L),
            org.assertj.core.groups.Tuple.tuple(2, 2L, "Unknown", 12L),
            org.assertj.core.groups.Tuple.tuple(3, 3L, "Unknown", 3L));
  }
}
