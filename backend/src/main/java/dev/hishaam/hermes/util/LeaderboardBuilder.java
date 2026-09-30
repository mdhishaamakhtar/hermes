package dev.hishaam.hermes.util;

import dev.hishaam.hermes.dto.session.SessionResultsResponse.LeaderboardEntry;
import dev.hishaam.hermes.entity.Participant;
import dev.hishaam.hermes.repository.ParticipantAnswerRepository.ParticipantTotal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

public final class LeaderboardBuilder {

  private static final ParticipantTotal NOTHING_YET = new ParticipantTotal(null, 0, 0);

  private LeaderboardBuilder() {}

  /**
   * Ranks every participant of a session, 1-based. Higher score wins; among equal scores the faster
   * cumulative answer time wins, and join order settles whatever is still level. A participant with
   * no graded answers is ranked on zero rather than left out.
   */
  public static List<LeaderboardEntry> rank(
      List<Participant> participants, List<ParticipantTotal> totals) {
    Map<Long, ParticipantTotal> totalsById =
        totals.stream()
            .collect(Collectors.toMap(ParticipantTotal::participantId, Function.identity()));
    Function<Participant, ParticipantTotal> totalOf =
        p -> totalsById.getOrDefault(p.getId(), NOTHING_YET);

    List<Participant> ordered =
        participants.stream()
            .sorted(
                Comparator.<Participant>comparingLong(p -> -totalOf.apply(p).score())
                    .thenComparingLong(p -> totalOf.apply(p).answerTimeMs())
                    .thenComparing(Participant::getId))
            .toList();

    List<LeaderboardEntry> leaderboard = new ArrayList<>(ordered.size());
    for (Participant participant : ordered) {
      leaderboard.add(
          new LeaderboardEntry(
              leaderboard.size() + 1,
              participant.getId(),
              participant.getDisplayName(),
              totalOf.apply(participant).score()));
    }
    return leaderboard;
  }
}
