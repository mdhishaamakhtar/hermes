package dev.hishaam.hermes.dto.session;

/**
 * How a session scores, said up front so nobody learns the rules from a deduction: whether a wrong
 * pick can cost points, and whether a faster right answer earns more. Ties are always broken by
 * total answer time, so that needs no flag.
 */
public record ScoringRules(boolean penalties, boolean speedScoring) {

  public static ScoringRules of(QuizSnapshot snapshot) {
    return new ScoringRules(snapshot.hasPenalties(), false);
  }
}
