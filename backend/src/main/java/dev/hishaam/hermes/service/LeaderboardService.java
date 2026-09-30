package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.session.SessionResultsResponse.LeaderboardEntry;
import dev.hishaam.hermes.repository.ParticipantAnswerRepository;
import dev.hishaam.hermes.repository.ParticipantRepository;
import dev.hishaam.hermes.util.LeaderboardBuilder;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * The one place a session's standings are computed — during play, at the final whistle, and on the
 * results pages afterwards — so a player's rank never changes between those screens. Read straight
 * from the graded answers in PostgreSQL, which also makes it correct after a scoring correction or
 * a Redis eviction.
 */
@Service
public class LeaderboardService {

  private final ParticipantRepository participantRepository;
  private final ParticipantAnswerRepository answerRepository;

  public LeaderboardService(
      ParticipantRepository participantRepository, ParticipantAnswerRepository answerRepository) {
    this.participantRepository = participantRepository;
    this.answerRepository = answerRepository;
  }

  public List<LeaderboardEntry> standings(Long sessionId) {
    return LeaderboardBuilder.rank(
        participantRepository.findBySessionId(sessionId),
        answerRepository.totalsBySessionId(sessionId));
  }
}
