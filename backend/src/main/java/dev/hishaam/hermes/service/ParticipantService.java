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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ParticipantService {

  private final QuizSessionRepository sessionRepository;
  private final ParticipantRepository participantRepository;
  private final ParticipantAnswerRepository answerRepository;
  private final SessionSnapshotService snapshotService;
  private final SessionLiveStateService liveStateService;
  private final SessionCodeService sessionCodeService;
  private final SessionEventPublisher eventPublisher;
  private final ParticipantRejoinTokenStore rejoinTokenStore;

  public ParticipantService(
      QuizSessionRepository sessionRepository,
      ParticipantRepository participantRepository,
      ParticipantAnswerRepository answerRepository,
      SessionSnapshotService snapshotService,
      SessionLiveStateService liveStateService,
      SessionCodeService sessionCodeService,
      SessionEventPublisher eventPublisher,
      ParticipantRejoinTokenStore rejoinTokenStore) {
    this.sessionRepository = sessionRepository;
    this.participantRepository = participantRepository;
    this.answerRepository = answerRepository;
    this.snapshotService = snapshotService;
    this.liveStateService = liveStateService;
    this.sessionCodeService = sessionCodeService;
    this.eventPublisher = eventPublisher;
    this.rejoinTokenStore = rejoinTokenStore;
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

    rejoinTokenStore.store(rejoinToken, participant.getId());

    long count = liveStateService.incrementParticipantCount(sessionId);
    liveStateService.cacheParticipantName(sessionId, participant.getId(), request.displayName());
    // Initialize with score 0 so zero-correct participants appear in leaderboard
    liveStateService.initLeaderboardEntry(sessionId, participant.getId());

    eventPublisher.publishParticipantJoined(sessionId, count);

    return new JoinResponse(participant.getId(), rejoinToken, sessionId);
  }

  @Transactional(readOnly = true)
  public RejoinResponse rejoinSession(RejoinRequest request) {
    Long sessionId = request.sessionId();
    Long participantId = resolveParticipantId(request.rejoinToken(), sessionId);

    QuizSession session =
        sessionRepository
            .findById(sessionId)
            .orElseThrow(() -> AppException.notFound("Session not found"));
    SessionStatus status = session.getStatus();
    SessionLiveStateService.RejoinContext ctx = liveStateService.buildRejoinContext(sessionId);

    List<Long> answered = answerRepository.findAnsweredQuestionIds(participantId);

    QuizSnapshot snapshot = snapshotService.loadSnapshot(sessionId.toString());

    RejoinResponse.CurrentQuestion currentQuestion = null;
    RejoinResponse.CurrentPassage currentPassage = null;
    if (SessionStatus.ACTIVE == status && ctx.currentQuestionId() != null) {
      if (ctx.currentPassageId() != null) {
        QuizSnapshot.PassageSnapshot passage = snapshot.findPassage(ctx.currentPassageId());
        if (passage != null) {
          List<RejoinResponse.QuestionInfo> subQuestions =
              passage.subQuestionIds().stream()
                  .map(snapshot::findQuestion)
                  .filter(java.util.Objects::nonNull)
                  .sorted(
                      java.util.Comparator.comparingInt(QuizSnapshot.QuestionSnapshot::orderIndex))
                  .map(qSnap -> buildQuestionInfo(participantId, qSnap, snapshot))
                  .toList();

          currentPassage =
              new RejoinResponse.CurrentPassage(
                  passage.id(),
                  passage.text(),
                  passage.timerMode().name(),
                  snapshot.questionPosition(
                      subQuestions.isEmpty() ? ctx.currentQuestionId() : subQuestions.get(0).id()),
                  snapshot.questions().size(),
                  passage.timeLimitSeconds(),
                  subQuestions.isEmpty() ? null : subQuestions.get(0).effectiveDisplayMode(),
                  subQuestions);
        }
      } else {
        QuizSnapshot.QuestionSnapshot qSnap = snapshot.findQuestion(ctx.currentQuestionId());
        if (qSnap != null) {
          currentQuestion = buildCurrentQuestion(participantId, qSnap, snapshot);
        }
      }
    }

    return new RejoinResponse(
        participantId,
        sessionId,
        status.name(),
        ctx.questionLifecycle(),
        snapshot.title(),
        ctx.participantCount(),
        ctx.currentQuestionId(),
        ctx.currentPassageId(),
        answered,
        currentQuestion,
        currentPassage,
        ctx.timeLeftSeconds());
  }

  /** Resolves a participant ID from a rejoin token, checking Redis first with DB fallback. */
  public Long resolveParticipantId(String rejoinToken, Long sessionId) {
    return rejoinTokenStore.resolveParticipantId(rejoinToken, sessionId);
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
                    snapshot.findPassage(question.passageId()).timerMode().name());

    return new RejoinResponse.CurrentQuestion(
        question.id(),
        question.text(),
        snapshot.questionPosition(question.id()),
        snapshot.questions().size(),
        question.timeLimitSeconds(),
        question.questionType().name(),
        question.effectiveDisplayMode().name(),
        passageInfo,
        options,
        selectedOptionIds,
        answer != null && answer.isLockedIn());
  }

  private RejoinResponse.QuestionInfo buildQuestionInfo(
      Long participantId, QuizSnapshot.QuestionSnapshot question, QuizSnapshot snapshot) {
    ParticipantAnswer answer = currentAnswer(participantId, question.id());
    List<RejoinResponse.OptionInfo> options =
        question.options().stream()
            .map(o -> new RejoinResponse.OptionInfo(o.id(), o.text(), o.orderIndex()))
            .toList();
    return new RejoinResponse.QuestionInfo(
        question.id(),
        question.text(),
        snapshot.questionPosition(question.id()),
        question.timeLimitSeconds(),
        question.questionType().name(),
        question.effectiveDisplayMode().name(),
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
