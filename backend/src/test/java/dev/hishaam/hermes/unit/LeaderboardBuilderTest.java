package dev.hishaam.hermes.unit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.groups.Tuple.tuple;

import dev.hishaam.hermes.dto.session.SessionResultsResponse.LeaderboardEntry;
import dev.hishaam.hermes.entity.Participant;
import dev.hishaam.hermes.repository.ParticipantAnswerRepository.ParticipantTotal;
import dev.hishaam.hermes.util.LeaderboardBuilder;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for leaderboard ranking.
 *
 * <p>This class verifies the pure ranking logic only: ordering, rank assignment and the two
 * tie-breaks. It does not exercise any database, Redis, or session orchestration code.
 */
class LeaderboardBuilderTest {

  /**
   * Verifies that entries are sorted by score in descending order and that ranks are assigned
   * sequentially from one, whatever order the participants and totals arrive in.
   */
  @Test
  void ranksParticipantsByScoreInDescendingOrder() {
    List<LeaderboardEntry> ranked =
        LeaderboardBuilder.rank(
            List.of(participant(20L, "Noah"), participant(10L, "Ava"), participant(30L, "Mia")),
            List.of(total(30L, 5, 900), total(20L, 15, 100), total(10L, 30, 5000)));

    assertThat(ranked)
        .extracting(
            LeaderboardEntry::rank,
            LeaderboardEntry::participantId,
            LeaderboardEntry::displayName,
            LeaderboardEntry::score)
        .containsExactly(
            tuple(1, 10L, "Ava", 30L), tuple(2, 20L, "Noah", 15L), tuple(3, 30L, "Mia", 5L));
  }

  /**
   * Verifies that equal scores are separated by the faster cumulative answer time, and that join
   * order — the participant id — settles a tie on both.
   */
  @Test
  void breaksScoreTiesByAnswerTimeAndThenByJoinOrder() {
    List<LeaderboardEntry> ranked =
        LeaderboardBuilder.rank(
            List.of(
                participant(1L, "Slow"),
                participant(2L, "Fast"),
                participant(4L, "Level, joined later"),
                participant(3L, "Level, joined earlier")),
            List.of(
                total(1L, 12, 8000), total(2L, 12, 2000), total(3L, 7, 400), total(4L, 7, 400)));

    assertThat(ranked)
        .extracting(LeaderboardEntry::rank, LeaderboardEntry::displayName)
        .containsExactly(
            tuple(1, "Fast"),
            tuple(2, "Slow"),
            tuple(3, "Level, joined earlier"),
            tuple(4, "Level, joined later"));
  }

  /**
   * Verifies that a participant with no graded answers still appears, ranked on zero, rather than
   * dropping off the board.
   */
  @Test
  void participantsWithoutAnyGradedAnswersAreRankedOnZero() {
    List<LeaderboardEntry> ranked =
        LeaderboardBuilder.rank(
            List.of(participant(1L, "Silent"), participant(2L, "Scorer")),
            List.of(total(2L, 10, 1500)));

    assertThat(ranked)
        .extracting(LeaderboardEntry::rank, LeaderboardEntry::displayName, LeaderboardEntry::score)
        .containsExactly(tuple(1, "Scorer", 10L), tuple(2, "Silent", 0L));
  }

  private static Participant participant(Long id, String name) {
    return Participant.builder().id(id).displayName(name).build();
  }

  private static ParticipantTotal total(Long participantId, long score, long answerTimeMs) {
    return new ParticipantTotal(participantId, score, answerTimeMs);
  }
}
