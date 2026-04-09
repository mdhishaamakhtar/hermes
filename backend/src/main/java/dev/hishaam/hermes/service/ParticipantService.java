package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.*;
import dev.hishaam.hermes.entity.Participant;
import dev.hishaam.hermes.entity.ParticipantAnswer;
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
  private final SessionSnapshotService snapshotService;
  private final SessionLiveStateService liveStateService;
  private final SessionCodeService sessionCodeService;
  private final StringRedisTemplate redis;
  private final SimpMessagingTemplate messaging;

  public ParticipantService(
      QuizSessionRepository sessionRepository,
      ParticipantRepository participantRepository,
      ParticipantAnswerRepository answerRepository,
      SessionRedisHelper redisHelper,
      SessionSnapshotService snapshotService,
      SessionLiveStateService liveStateService,
      SessionCodeService sessionCodeService,
      StringRedisTemplate redis,
      SimpMessagingTemplate messaging) {
    this.sessionRepository = sessionRepository;
    this.participantRepository = participantRepository;
    this.answerRepository = answerRepository;
    this.redisHelper = redisHelper;
    this.snapshotService = snapshotService;
    this.liveStateService = liveStateService;
    this.sessionCodeService = sessionCodeService;
    this.redis = redis;
    this.messaging = messaging;
  }

  @Transactional
  public JoinResponse joinSession(JoinSessionRequest request) {
    String sessionIdStr =
        liveStateService.getSessionIdForJoinCode(request.joinCode().toUpperCase());
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

    String rejoinToken = sessionCodeService.generateRejoinToken();
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
            redisHelper.participantTokenKey(rejoinToken),
            participant.getId().toString(),
            SessionRedisHelper.REJOIN_TTL);

    // Increment participant count
    long count = liveStateService.incrementParticipantCount(sid);

    // Cache display name in Redis for leaderboard building
    liveStateService.cacheParticipantName(sid, participant.getId(), request.displayName());

    // Initialize leaderboard entry with score 0 (so zero-correct participants appear)
    liveStateService.initLeaderboardEntry(sid, participant.getId());

    // Broadcast PARTICIPANT_JOINED
    messaging.convertAndSend(
        "/topic/session." + sessionId + ".control", new WsPayloads.ParticipantJoined(count));

    return new JoinResponse(participant.getId(), rejoinToken, sessionId);
  }

  @Transactional(readOnly = true)
  public RejoinResponse rejoinSession(RejoinRequest request) {
    Long sessionId = request.sessionId();
    Long participantId = resolveParticipantId(request.rejoinToken(), sessionId);

    String sid = sessionId.toString();

    QuizSession session =
        sessionRepository
            .findById(sessionId)
            .orElseThrow(() -> AppException.notFound("Session not found"));
    SessionStatus status = session.getStatus();
    String questionLifecycle = liveStateService.getQuestionState(sid);

    String currentQIdStr = liveStateService.getCurrentQuestionId(sid);
    Long currentQId =
        (currentQIdStr != null && !currentQIdStr.isEmpty()) ? Long.parseLong(currentQIdStr) : null;
    String currentPassageIdStr = liveStateService.getCurrentPassageId(sid);
    Long currentPassageId =
        (currentPassageIdStr != null && !currentPassageIdStr.isEmpty())
            ? Long.parseLong(currentPassageIdStr)
            : null;

    List<Long> answered = answerRepository.findAnsweredQuestionIds(participantId);

    QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
    int participantCount = (int) liveStateService.getParticipantCount(sid);

    RejoinResponse.CurrentQuestion currentQuestion = null;
    RejoinResponse.CurrentPassage currentPassage = null;
    Integer timeLeftSeconds = null;
    if (SessionStatus.ACTIVE == status && currentQId != null) {
      Long ttl = redis.getExpire(redisHelper.timerKey(sid), TimeUnit.SECONDS);
      if (ttl != null && ttl > 0) {
        timeLeftSeconds = ttl.intValue();
      }

      if (currentPassageId != null) {
        QuizSnapshot.PassageSnapshot passage = snapshot.findPassage(currentPassageId);
        if (passage != null) {
          List<RejoinResponse.QuestionInfo> subQuestions =
              passage.subQuestionIds().stream()
                  .map(snapshot::findQuestion)
                  .filter(java.util.Objects::nonNull)
                  .sorted(
                      java.util.Comparator.comparingInt(QuizSnapshot.QuestionSnapshot::orderIndex))
                  .map(qSnap -> buildQuestionInfo(participantId, qSnap))
                  .toList();

          currentPassage =
              new RejoinResponse.CurrentPassage(
                  passage.id(),
                  passage.text(),
                  passage.timerMode(),
                  snapshot.questionPosition(
                      subQuestions.isEmpty() ? currentQId : subQuestions.get(0).id()),
                  snapshot.questions().size(),
                  passage.timeLimitSeconds(),
                  subQuestions.isEmpty() ? null : subQuestions.get(0).effectiveDisplayMode(),
                  subQuestions);
        }
      } else {
        QuizSnapshot.QuestionSnapshot qSnap = snapshot.findQuestion(currentQId);
        if (qSnap != null) {
          currentQuestion = buildCurrentQuestion(participantId, qSnap, snapshot);
        }
      }
    }

    return new RejoinResponse(
        participantId,
        sessionId,
        status.name(),
        questionLifecycle,
        snapshot.title(),
        participantCount,
        currentQId,
        currentPassageId,
        answered,
        currentQuestion,
        currentPassage,
        timeLeftSeconds);
  }

  /** Resolves a participant ID from a rejoin token, checking Redis first with DB fallback. */
  public Long resolveParticipantId(String rejoinToken, Long sessionId) {
    String participantIdStr = redis.opsForValue().get(redisHelper.participantTokenKey(rejoinToken));
    Long participantId = null;

    if (participantIdStr != null) {
      participantId = Long.parseLong(participantIdStr);
    } else {
      Participant p =
          participantRepository
              .findByRejoinToken(rejoinToken)
              .orElseThrow(() -> AppException.notFound("Invalid rejoin token"));
      participantId = p.getId();
      redis
          .opsForValue()
          .set(
              redisHelper.participantTokenKey(rejoinToken),
              participantId.toString(),
              SessionRedisHelper.REJOIN_TTL);
    }

    // Security: Verify that this participant actually belongs to the sessionId from the request
    Participant p =
        participantRepository
            .findById(participantId)
            .orElseThrow(() -> AppException.notFound("Participant not found"));

    if (!p.getSession().getId().equals(sessionId)) {
      throw AppException.notFound("Invalid rejoin token for this session");
    }

    return participantId;
  }

  private RejoinResponse.CurrentQuestion buildCurrentQuestion(
      Long participantId, QuizSnapshot.QuestionSnapshot question, QuizSnapshot snapshot) {
    List<RejoinResponse.OptionInfo> options =
        question.options().stream()
            .map(o -> new RejoinResponse.OptionInfo(o.id(), o.text(), o.orderIndex()))
            .toList();
    ParticipantAnswer answer = currentAnswer(participantId, question.id());
    List<Long> selectedOptionIds = selectedOptionIds(answer);
    RejoinResponse.PassageInfo passageInfo =
        question.passageId() == null
            ? null
            : snapshot.findPassage(question.passageId()) == null
                ? null
                : new RejoinResponse.PassageInfo(
                    question.passageId(),
                    snapshot.findPassage(question.passageId()).text(),
                    snapshot.findPassage(question.passageId()).timerMode());

    return new RejoinResponse.CurrentQuestion(
        question.id(),
        question.text(),
        question.orderIndex(),
        snapshot.questions().size(),
        question.timeLimitSeconds(),
        question.questionType(),
        question.effectiveDisplayMode(),
        passageInfo,
        options,
        selectedOptionIds,
        answer != null && answer.isLockedIn());
  }

  private RejoinResponse.QuestionInfo buildQuestionInfo(
      Long participantId, QuizSnapshot.QuestionSnapshot question) {
    ParticipantAnswer answer = currentAnswer(participantId, question.id());
    List<RejoinResponse.OptionInfo> options =
        question.options().stream()
            .map(o -> new RejoinResponse.OptionInfo(o.id(), o.text(), o.orderIndex()))
            .toList();
    return new RejoinResponse.QuestionInfo(
        question.id(),
        question.text(),
        question.orderIndex(),
        question.timeLimitSeconds(),
        question.questionType(),
        question.effectiveDisplayMode(),
        options,
        selectedOptionIds(answer),
        answer != null && answer.isLockedIn());
  }

  private ParticipantAnswer currentAnswer(Long participantId, Long questionId) {
    return answerRepository
        .findByParticipantIdAndQuestionId(participantId, questionId)
        .orElse(null);
  }

  private List<Long> selectedOptionIds(ParticipantAnswer answer) {
    if (answer == null || answer.getSelectedOptions().isEmpty()) {
      return List.of();
    }
    return answer.getSelectedOptions().stream()
        .sorted(java.util.Comparator.comparingInt(option -> option.getOrderIndex()))
        .map(option -> option.getId())
        .toList();
  }
}
