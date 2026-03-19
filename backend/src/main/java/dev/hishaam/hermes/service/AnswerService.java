package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.AnswerRequest;
import dev.hishaam.hermes.dto.QuizSnapshot;
import dev.hishaam.hermes.entity.SessionStatus;
import dev.hishaam.hermes.repository.ParticipantAnswerRepository;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AnswerService {

  private static final Logger log = LoggerFactory.getLogger(AnswerService.class);

  private final ParticipantAnswerRepository answerRepository;
  private final SessionRedisHelper redisHelper;
  private final SessionEngine engine;
  private final StringRedisTemplate redis;

  public AnswerService(
      ParticipantAnswerRepository answerRepository,
      SessionRedisHelper redisHelper,
      SessionEngine engine,
      StringRedisTemplate redis) {
    this.answerRepository = answerRepository;
    this.redisHelper = redisHelper;
    this.engine = engine;
    this.redis = redis;
  }

  @Transactional
  public void submitAnswer(Long sessionId, AnswerRequest request) {
    String sid = sessionId.toString();

    // Step 1: resolve participantId from rejoin token
    String participantIdStr = redis.opsForValue().get("participant:" + request.rejoinToken());
    if (participantIdStr == null) {
      log.warn("Unknown rejoin token: {}", request.rejoinToken());
      return;
    }
    Long participantId = Long.parseLong(participantIdStr);

    // Step 2: check session is ACTIVE
    String status = redis.opsForValue().get(redisHelper.key(sid, "status"));
    if (!SessionStatus.ACTIVE.name().equals(status)) return;

    // Step 3: check current question matches
    String currentQIdStr = redis.opsForValue().get(redisHelper.key(sid, "current_question"));
    if (currentQIdStr == null || !currentQIdStr.equals(request.questionId().toString())) return;

    // Step 4: load snapshot and validate option
    QuizSnapshot snapshot = redisHelper.loadSnapshot(sid);
    QuizSnapshot.QuestionSnapshot question = snapshot.findQuestion(request.questionId());
    if (question == null) return;

    QuizSnapshot.OptionSnapshot option =
        question.options().stream()
            .filter(o -> o.id().equals(request.optionId()))
            .findFirst()
            .orElse(null);
    if (option == null) return;

    // Step 5: insert with ON CONFLICT DO NOTHING
    int inserted =
        answerRepository.insertAnswerIgnoreConflict(
            sessionId, participantId, request.questionId(), request.optionId(), option.isCorrect());
    if (inserted == 0) return; // duplicate answer

    // Step 6: update per-option counts
    String countsKey = redisHelper.key(sid, "question:" + request.questionId() + ":counts");
    redis.opsForHash().increment(countsKey, request.optionId().toString(), 1);

    // Step 7: update leaderboard score if correct
    if (option.isCorrect()) {
      redis
          .opsForZSet()
          .incrementScore(redisHelper.key(sid, "leaderboard"), participantId.toString(), 1);
    }

    // Step 8: broadcast ANSWER_UPDATE to organiser
    Map<Object, Object> rawCounts = redis.opsForHash().entries(countsKey);
    Map<Long, Long> counts = new LinkedHashMap<>();
    rawCounts.forEach(
        (k, v) -> counts.put(Long.parseLong(k.toString()), Long.parseLong(v.toString())));
    long totalAnswered = counts.values().stream().mapToLong(Long::longValue).sum();
    long totalParticipants = redisHelper.getParticipantCount(sid);

    engine.broadcastAnswerUpdate(
        sessionId, request.questionId(), counts, totalAnswered, totalParticipants);

    // Step 9: broadcast LEADERBOARD_UPDATE to organiser
    engine.broadcastLeaderboardUpdate(sessionId, sid);
  }
}
