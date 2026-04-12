package dev.hishaam.hermes.service.session;

import dev.hishaam.hermes.dto.session.AnswerStats;
import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.dto.session.SessionResultsResponse;
import dev.hishaam.hermes.dto.ws.WsPayloads;
import dev.hishaam.hermes.entity.enums.DisplayMode;
import dev.hishaam.hermes.repository.ParticipantRepository;
import dev.hishaam.hermes.repository.redis.SessionAnswerStatsRedisRepository;
import dev.hishaam.hermes.repository.redis.SessionLeaderboardRedisRepository;
import dev.hishaam.hermes.repository.redis.SessionStateRedisRepository;
import dev.hishaam.hermes.util.LeaderboardBuilder;
import dev.hishaam.hermes.util.WsTopics;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class SessionEventPublisher {

  private final SimpMessagingTemplate messaging;
  private final SessionSnapshotService snapshotService;
  private final SessionStateRedisRepository stateStore;
  private final SessionAnswerStatsRedisRepository answerStatsStore;
  private final SessionLeaderboardRedisRepository leaderboardStore;
  private final ParticipantRepository participantRepository;

  public SessionEventPublisher(
      SimpMessagingTemplate messaging,
      SessionSnapshotService snapshotService,
      SessionStateRedisRepository stateStore,
      SessionAnswerStatsRedisRepository answerStatsStore,
      SessionLeaderboardRedisRepository leaderboardStore,
      ParticipantRepository participantRepository) {
    this.messaging = messaging;
    this.snapshotService = snapshotService;
    this.stateStore = stateStore;
    this.answerStatsStore = answerStatsStore;
    this.leaderboardStore = leaderboardStore;
    this.participantRepository = participantRepository;
  }

  public void publishParticipantJoined(Long sessionId, long participantCount) {
    var payload = new WsPayloads.ParticipantJoined(participantCount);
    messaging.convertAndSend(WsTopics.sessionControl(sessionId), payload);
    messaging.convertAndSend(WsTopics.sessionQuestion(sessionId), payload);
  }

  public void publishQuestionDisplayed(
      Long sessionId, QuizSnapshot.QuestionSnapshot question, QuizSnapshot snapshot) {
    int questionIndex = snapshot.questionPosition(question.id());
    int totalQuestions = snapshot.questions().size();

    List<WsPayloads.Option> options =
        question.options().stream()
            .map(o -> new WsPayloads.Option(o.id(), o.text(), o.orderIndex()))
            .toList();

    WsPayloads.PassageContext passageContext = null;
    if (question.passageId() != null) {
      QuizSnapshot.PassageSnapshot passage = snapshot.findPassage(question.passageId());
      if (passage != null) {
        passageContext = new WsPayloads.PassageContext(passage.id(), passage.text());
      }
    }

    messaging.convertAndSend(
        WsTopics.sessionQuestion(sessionId),
        new WsPayloads.QuestionDisplayed(
            question.id(),
            question.text(),
            question.questionType().name(),
            options,
            questionIndex,
            totalQuestions,
            passageContext,
            question.effectiveDisplayMode().name()));
  }

  public void publishPassageDisplayed(
      Long sessionId,
      QuizSnapshot.PassageSnapshot passage,
      List<QuizSnapshot.QuestionSnapshot> subQuestions,
      QuizSnapshot snapshot) {
    int questionIndex = snapshot.questionPosition(subQuestions.get(0).id());
    int totalQuestions = snapshot.questions().size();

    List<WsPayloads.SubQuestion> wsSubQuestions =
        subQuestions.stream()
            .map(
                q -> {
                  List<WsPayloads.Option> opts =
                      q.options().stream()
                          .map(o -> new WsPayloads.Option(o.id(), o.text(), o.orderIndex()))
                          .toList();
                  return new WsPayloads.SubQuestion(
                      q.id(), q.text(), q.questionType().name(), opts);
                })
            .toList();

    String effectiveDisplayMode =
        subQuestions.isEmpty()
            ? DisplayMode.LIVE.name()
            : subQuestions.get(0).effectiveDisplayMode().name();

    messaging.convertAndSend(
        WsTopics.sessionQuestion(sessionId),
        new WsPayloads.PassageDisplayed(
            passage.id(),
            passage.text(),
            passage.timeLimitSeconds(),
            wsSubQuestions,
            questionIndex,
            totalQuestions,
            effectiveDisplayMode));
  }

  public void publishTimerStart(
      Long sessionId, Long questionId, Long passageId, int timeLimitSeconds) {
    messaging.convertAndSend(
        WsTopics.sessionQuestion(sessionId),
        new WsPayloads.TimerStart(questionId, passageId, timeLimitSeconds));
  }

  public void publishQuestionFrozen(Long sessionId, Long questionId) {
    messaging.convertAndSend(
        WsTopics.sessionQuestion(sessionId), new WsPayloads.QuestionFrozen(questionId));
  }

  public void publishPassageFrozen(Long sessionId, Long passageId, List<Long> subQuestionIds) {
    messaging.convertAndSend(
        WsTopics.sessionQuestion(sessionId),
        new WsPayloads.PassageFrozen(passageId, subQuestionIds));
  }

  public void publishSessionEnd(Long sessionId) {
    messaging.convertAndSend(WsTopics.sessionQuestion(sessionId), new WsPayloads.SessionEnd());
  }

  public void publishSessionEndAnalytics(Long sessionId) {
    List<SessionResultsResponse.LeaderboardEntry> leaderboard =
        leaderboardStore.buildLeaderboard(sessionId);
    long participantCount = stateStore.getParticipantCount(sessionId);
    messaging.convertAndSend(
        WsTopics.sessionAnalytics(sessionId),
        new WsPayloads.SessionEndAnalytics(leaderboard, participantCount));
  }

  public void publishQuestionReviewed(
      Long sessionId, Long questionId, QuizSnapshot.QuestionSnapshot question) {
    List<Long> correctOptionIds =
        question.options().stream()
            .filter(o -> o.pointValue() > 0)
            .map(QuizSnapshot.OptionSnapshot::id)
            .toList();

    Map<Long, Integer> optionPoints = new LinkedHashMap<>();
    question.options().forEach(o -> optionPoints.put(o.id(), o.pointValue()));

    messaging.convertAndSend(
        WsTopics.sessionQuestion(sessionId),
        new WsPayloads.QuestionReviewed(questionId, correctOptionIds, optionPoints));

    DisplayMode mode = question.effectiveDisplayMode();
    if (mode == DisplayMode.BLIND || mode == DisplayMode.CODE_DISPLAY) {
      Map<Long, Long> counts = answerStatsStore.getQuestionCounts(sessionId, questionId);
      long totalAnswered = answerStatsStore.getTotalAnswered(sessionId, questionId);
      long totalParticipants = stateStore.getParticipantCount(sessionId);

      var answerReveal =
          new WsPayloads.AnswerReveal(questionId, counts, totalAnswered, totalParticipants);
      messaging.convertAndSend(WsTopics.sessionAnalytics(sessionId), answerReveal);
      messaging.convertAndSend(WsTopics.sessionQuestion(sessionId), answerReveal);
    }
  }

  public void publishScoringCorrected(
      Long sessionId, Long questionId, QuizSnapshot.QuestionSnapshot question) {
    List<Long> correctOptionIds =
        question.options().stream()
            .filter(o -> o.pointValue() > 0)
            .map(QuizSnapshot.OptionSnapshot::id)
            .toList();

    Map<Long, Integer> optionPoints = new LinkedHashMap<>();
    question.options().forEach(o -> optionPoints.put(o.id(), o.pointValue()));

    messaging.convertAndSend(
        WsTopics.sessionQuestion(sessionId),
        new WsPayloads.ScoringCorrected(questionId, correctOptionIds, optionPoints));
  }

  public void publishLeaderboardFromDb(Long sessionId, Map<Long, Long> participantTotals) {
    Map<Long, String> names = new HashMap<>();
    participantRepository
        .findBySessionId(sessionId)
        .forEach(p -> names.put(p.getId(), p.getDisplayName()));
    long totalParticipants = participantRepository.countBySessionId(sessionId);

    List<SessionResultsResponse.LeaderboardEntry> leaderboard =
        LeaderboardBuilder.rank(participantTotals, names);

    messaging.convertAndSend(
        WsTopics.sessionAnalytics(sessionId), new WsPayloads.LeaderboardUpdate(leaderboard));

    messaging.convertAndSend(
        WsTopics.sessionQuestion(sessionId),
        new WsPayloads.ParticipantLeaderboard(
            leaderboard.stream()
                .map(
                    e ->
                        new WsPayloads.ParticipantLeaderboardEntry(
                            e.participantId(), e.rank(), e.displayName(), e.score()))
                .toList(),
            totalParticipants));
  }

  public void publishLeaderboardUpdates(Long sessionId) {
    List<SessionResultsResponse.LeaderboardEntry> leaderboard =
        leaderboardStore.buildLeaderboard(sessionId);
    long totalParticipants = stateStore.getParticipantCount(sessionId);

    messaging.convertAndSend(
        WsTopics.sessionAnalytics(sessionId), new WsPayloads.LeaderboardUpdate(leaderboard));

    messaging.convertAndSend(
        WsTopics.sessionQuestion(sessionId),
        new WsPayloads.ParticipantLeaderboard(
            leaderboard.stream()
                .sorted(Comparator.comparingInt(SessionResultsResponse.LeaderboardEntry::rank))
                .map(
                    e ->
                        new WsPayloads.ParticipantLeaderboardEntry(
                            e.participantId(), e.rank(), e.displayName(), e.score()))
                .toList(),
            totalParticipants));
  }

  public void publishAnswerUpdate(Long sessionId, Long questionId, AnswerStats stats) {
    String sid = sessionId.toString();
    QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
    QuizSnapshot.QuestionSnapshot question = snapshot.findQuestion(questionId);
    DisplayMode mode = question != null ? question.effectiveDisplayMode() : DisplayMode.LIVE;

    if (mode == DisplayMode.CODE_DISPLAY) {
      return;
    }

    Map<Long, Long> broadcastCounts = mode == DisplayMode.BLIND ? Map.of() : stats.optionCounts();
    var answerUpdate =
        new WsPayloads.AnswerUpdate(
            questionId,
            broadcastCounts,
            stats.totalAnswered(),
            stats.totalParticipants(),
            stats.totalLockedIn());
    messaging.convertAndSend(WsTopics.sessionAnalytics(sessionId), answerUpdate);
    messaging.convertAndSend(WsTopics.sessionQuestion(sessionId), answerUpdate);
  }

  public void publishAnswerAccepted(
      String username, String clientRequestId, Long questionId, boolean lockedIn) {
    if (username == null || clientRequestId == null || clientRequestId.isBlank()) {
      return;
    }
    messaging.convertAndSendToUser(
        username,
        "/queue/answers",
        new WsPayloads.AnswerAccepted(clientRequestId, questionId, lockedIn));
  }

  public void publishAnswerRejected(
      String username,
      String clientRequestId,
      Long questionId,
      String code,
      String message,
      boolean lockedIn) {
    if (username == null || clientRequestId == null || clientRequestId.isBlank()) {
      return;
    }
    messaging.convertAndSendToUser(
        username,
        "/queue/answers",
        new WsPayloads.AnswerRejected(clientRequestId, questionId, code, message, lockedIn));
  }
}
