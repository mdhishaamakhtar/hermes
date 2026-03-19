package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.*;
import dev.hishaam.hermes.entity.Participant;
import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.entity.SessionStatus;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.ParticipantAnswerRepository;
import dev.hishaam.hermes.repository.ParticipantRepository;
import dev.hishaam.hermes.repository.QuizSessionRepository;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ParticipantService {

  private final QuizSessionRepository sessionRepository;
  private final ParticipantRepository participantRepository;
  private final ParticipantAnswerRepository answerRepository;
  private final SessionRedisHelper redisHelper;
  private final StringRedisTemplate redis;
  private final SimpMessagingTemplate messaging;

  public ParticipantService(
      QuizSessionRepository sessionRepository,
      ParticipantRepository participantRepository,
      ParticipantAnswerRepository answerRepository,
      SessionRedisHelper redisHelper,
      StringRedisTemplate redis,
      SimpMessagingTemplate messaging) {
    this.sessionRepository = sessionRepository;
    this.participantRepository = participantRepository;
    this.answerRepository = answerRepository;
    this.redisHelper = redisHelper;
    this.redis = redis;
    this.messaging = messaging;
  }

  @Transactional
  public JoinResponse joinSession(JoinSessionRequest request) {
    String sessionIdStr = redis.opsForValue().get("joincode:" + request.joinCode().toUpperCase());
    if (sessionIdStr == null) {
      throw AppException.notFound("Invalid or expired join code");
    }
    Long sessionId;
    try {
      sessionId = Long.parseLong(sessionIdStr);
    } catch (NumberFormatException e) {
      throw AppException.notFound("Invalid or expired join code");
    }

    QuizSession session =
        sessionRepository
            .findById(sessionId)
            .orElseThrow(() -> AppException.notFound("Session not found"));

    // Only allow joining LOBBY sessions
    if (session.getStatus() != SessionStatus.LOBBY) {
      throw AppException.conflict("Session is no longer accepting participants");
    }

    String rejoinToken = redisHelper.generateRejoinToken();
    Participant participant =
        Participant.builder()
            .session(session)
            .displayName(request.displayName())
            .rejoinToken(rejoinToken)
            .build();
    participant = participantRepository.save(participant);

    String sid = sessionId.toString();

    // Store rejoin token in Redis
    redis
        .opsForValue()
        .set(
            "participant:" + rejoinToken,
            participant.getId().toString(),
            SessionRedisHelper.REJOIN_TTL);

    // Increment participant count
    redis.opsForValue().increment(redisHelper.key(sid, "participant_count"));

    // Cache display name in Redis for leaderboard building
    redisHelper.cacheParticipantName(sid, participant.getId(), request.displayName());

    // Initialize leaderboard entry with score 0 (so zero-correct participants appear)
    redisHelper.initLeaderboardEntry(sid, participant.getId());

    // Broadcast PARTICIPANT_JOINED
    long count = redisHelper.getParticipantCount(sid);
    messaging.convertAndSend(
        "/topic/session." + sessionId + ".control", new WsPayloads.ParticipantJoined(count));

    return new JoinResponse(participant.getId(), rejoinToken, sessionId);
  }

  @Transactional(readOnly = true)
  public RejoinResponse rejoinSession(RejoinRequest request) {
    Long participantId = resolveParticipantId(request.rejoinToken());

    Participant participant =
        participantRepository
            .findById(participantId)
            .orElseThrow(() -> AppException.notFound("Participant not found"));

    Long sessionId = participant.getSession().getId();
    String sid = sessionId.toString();

    QuizSession session =
        sessionRepository
            .findById(sessionId)
            .orElseThrow(() -> AppException.notFound("Session not found"));
    SessionStatus status = session.getStatus();

    String currentQIdStr = redis.opsForValue().get(redisHelper.key(sid, "current_question"));
    Long currentQId =
        (currentQIdStr != null && !currentQIdStr.isEmpty()) ? Long.parseLong(currentQIdStr) : null;

    List<Long> answered = answerRepository.findAnsweredQuestionIds(participantId);

    QuizSnapshot snapshot = redisHelper.loadSnapshot(sid);
    int participantCount = (int) redisHelper.getParticipantCount(sid);

    RejoinResponse.CurrentQuestion currentQuestion = null;
    Integer timeLeftSeconds = null;
    if (SessionStatus.ACTIVE == status && currentQId != null) {
      QuizSnapshot.QuestionSnapshot qSnap = snapshot.findQuestion(currentQId);
      if (qSnap != null) {
        List<RejoinResponse.OptionInfo> options =
            qSnap.options().stream()
                .map(o -> new RejoinResponse.OptionInfo(o.id(), o.text(), o.orderIndex()))
                .toList();
        int questionIndex = snapshot.questionPosition(currentQId);
        currentQuestion =
            new RejoinResponse.CurrentQuestion(
                qSnap.id(),
                qSnap.text(),
                questionIndex,
                snapshot.questions().size(),
                qSnap.timeLimitSeconds(),
                options);
        Long ttl = redis.getExpire(redisHelper.key(sid, "timer"), TimeUnit.SECONDS);
        if (ttl != null && ttl > 0) {
          timeLeftSeconds = ttl.intValue();
        }
      }
    }

    return new RejoinResponse(
        participantId,
        sessionId,
        status.name(),
        snapshot.title(),
        participantCount,
        currentQId,
        answered,
        currentQuestion,
        timeLeftSeconds);
  }

  /** Resolves a participant ID from a rejoin token, checking Redis first with DB fallback. */
  public Long resolveParticipantId(String rejoinToken) {
    String participantIdStr = redis.opsForValue().get("participant:" + rejoinToken);
    if (participantIdStr != null) {
      return Long.parseLong(participantIdStr);
    }
    Participant p =
        participantRepository
            .findByRejoinToken(rejoinToken)
            .orElseThrow(() -> AppException.notFound("Invalid rejoin token"));
    redis
        .opsForValue()
        .set("participant:" + rejoinToken, p.getId().toString(), SessionRedisHelper.REJOIN_TTL);
    return p.getId();
  }
}
