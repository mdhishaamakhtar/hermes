package dev.hishaam.hermes.service.session;

import dev.hishaam.hermes.dto.session.*;
import dev.hishaam.hermes.entity.Participant;
import dev.hishaam.hermes.entity.ParticipantAnswer;
import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.entity.enums.SessionStatus;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.ParticipantAnswerRepository;
import dev.hishaam.hermes.repository.ParticipantRepository;
import dev.hishaam.hermes.repository.QuizSessionRepository;
import dev.hishaam.hermes.service.LeaderboardService;
import dev.hishaam.hermes.service.OwnershipService;
import dev.hishaam.hermes.service.ParticipantService;
import dev.hishaam.hermes.service.ScoreCalculator;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Computes and serves post-session results for both organizers and individual participants. All
 * results are derived from the frozen PostgreSQL rows (answers, participants, the serialised quiz
 * snapshot) — Redis is not consulted after a session ends.
 */
@Service
public class SessionResultsService {

  private final QuizSessionRepository sessionRepository;
  private final ParticipantRepository participantRepository;
  private final ParticipantAnswerRepository answerRepository;
  private final OwnershipService ownershipService;
  private final SessionSnapshotService snapshotService;
  private final ParticipantService participantService;
  private final ScoreCalculator scoreCalculator;
  private final LeaderboardService leaderboardService;

  public SessionResultsService(
      QuizSessionRepository sessionRepository,
      ParticipantRepository participantRepository,
      ParticipantAnswerRepository answerRepository,
      OwnershipService ownershipService,
      SessionSnapshotService snapshotService,
      ParticipantService participantService,
      ScoreCalculator scoreCalculator,
      LeaderboardService leaderboardService) {
    this.sessionRepository = sessionRepository;
    this.participantRepository = participantRepository;
    this.answerRepository = answerRepository;
    this.ownershipService = ownershipService;
    this.snapshotService = snapshotService;
    this.participantService = participantService;
    this.scoreCalculator = scoreCalculator;
    this.leaderboardService = leaderboardService;
  }

  @Transactional(readOnly = true)
  public SessionResultsResponse getResults(Long sessionId, Long userId) {
    QuizSession session = ownershipService.requireSessionOwner(sessionId, userId);
    if (session.getStatus() != SessionStatus.ENDED) {
      throw AppException.conflict("Session has not ended yet");
    }
    return computeResults(session);
  }

  @Transactional(readOnly = true)
  public MyResultsResponse getMyResults(Long sessionId, String rejoinToken) {
    QuizSession session =
        sessionRepository
            .findById(sessionId)
            .orElseThrow(() -> AppException.notFound("Session not found"));
    if (session.getStatus() != SessionStatus.ENDED) {
      throw AppException.conflict("Session has not ended yet");
    }

    Long participantId = participantService.resolveParticipantId(rejoinToken, sessionId);
    Participant participant =
        participantRepository
            .findById(participantId)
            .orElseThrow(() -> AppException.notFound("Participant not found"));

    QuizSnapshot snapshot = snapshotService.deserialize(session.getSnapshot());
    List<ParticipantAnswer> answers = answerRepository.findByParticipantId(participantId);

    Map<Long, ParticipantAnswer> answerMap = new LinkedHashMap<>();
    answers.forEach(a -> answerMap.put(a.getQuestionId(), a));

    int correctCount =
        (int)
            answers.stream()
                .filter(
                    answer ->
                        scoreCalculator.isCorrectSelection(
                            answer, snapshot.findQuestion(answer.getQuestionId())))
                .count();
    int totalScore = answers.stream().mapToInt(ParticipantAnswer::getScore).sum();

    List<SessionResultsResponse.LeaderboardEntry> standings =
        leaderboardService.standings(sessionId);
    int rank =
        standings.stream()
            .filter(entry -> entry.participantId().equals(participantId))
            .mapToInt(SessionResultsResponse.LeaderboardEntry::rank)
            .findFirst()
            .orElse(0);

    List<MyResultsResponse.QuestionResult> questions =
        snapshot.questions().stream()
            .sorted(Comparator.comparingDouble(snapshot::globalSortKey))
            .map(
                q -> {
                  ParticipantAnswer ans = answerMap.get(q.id());
                  List<MyResultsResponse.OptionInfo> options =
                      q.options().stream()
                          .sorted(Comparator.comparingInt(QuizSnapshot.OptionSnapshot::orderIndex))
                          .map(
                              o ->
                                  new MyResultsResponse.OptionInfo(
                                      o.id(),
                                      o.text(),
                                      o.orderIndex(),
                                      o.pointValue() > 0,
                                      o.pointValue()))
                          .toList();
                  String passageText =
                      q.passageId() != null ? snapshot.requirePassage(q.passageId()).text() : null;
                  boolean isCorrect = scoreCalculator.isCorrectSelection(ans, q);
                  int pointsEarned = ans != null ? ans.getScore() : 0;
                  return new MyResultsResponse.QuestionResult(
                      q.id(),
                      q.text(),
                      snapshot.questionPosition(q.id()),
                      q.questionType().name(),
                      q.passageId(),
                      passageText,
                      selectedOptionIds(ans),
                      q.correctOptionIds(),
                      options,
                      isCorrect,
                      pointsEarned);
                })
            .toList();

    return new MyResultsResponse(
        participant.getId(),
        participant.getDisplayName(),
        totalScore,
        correctCount,
        snapshot.questions().size(),
        rank,
        standings.size(),
        questions);
  }

  private SessionResultsResponse computeResults(QuizSession session) {
    Long sessionId = session.getId();
    Long quizId = session.getQuiz().getId();
    Long eventId = session.getQuiz().getEvent().getId();
    String quizTitle = session.getQuiz().getTitle();

    QuizSnapshot snapshot = snapshotService.deserialize(session.getSnapshot());
    List<ParticipantAnswer> allAnswers = answerRepository.findBySessionId(sessionId);
    List<SessionResultsResponse.LeaderboardEntry> leaderboard =
        leaderboardService.standings(sessionId);

    // Build per-question results
    List<SessionResultsResponse.QuestionResult> questionResults =
        snapshot.questions().stream()
            .sorted(Comparator.comparingDouble(snapshot::globalSortKey))
            .map(
                q -> {
                  List<ParticipantAnswer> questionAnswers =
                      allAnswers.stream().filter(a -> a.getQuestionId().equals(q.id())).toList();
                  Map<Long, Long> optionCounts = new LinkedHashMap<>();
                  q.options().forEach(o -> optionCounts.put(o.id(), 0L));
                  questionAnswers.forEach(
                      answer ->
                          answer
                              .getSelectedOptionIds()
                              .forEach(optionId -> optionCounts.merge(optionId, 1L, Long::sum)));

                  long totalAnswers =
                      questionAnswers.stream()
                          .filter(answer -> answer.getAnsweredAt() != null)
                          .count();
                  String passageText =
                      q.passageId() != null ? snapshot.requirePassage(q.passageId()).text() : null;

                  List<SessionResultsResponse.OptionInfo> options =
                      q.options().stream()
                          .map(
                              o ->
                                  new SessionResultsResponse.OptionInfo(
                                      o.id(),
                                      o.text(),
                                      o.pointValue() > 0,
                                      o.orderIndex(),
                                      optionCounts.getOrDefault(o.id(), 0L),
                                      o.pointValue()))
                          .toList();

                  return new SessionResultsResponse.QuestionResult(
                      q.id(),
                      q.text(),
                      snapshot.questionPosition(q.id()),
                      q.timeLimitSeconds(),
                      q.passageId(),
                      passageText,
                      totalAnswers,
                      options);
                })
            .toList();

    return new SessionResultsResponse(
        sessionId,
        quizId,
        eventId,
        quizTitle,
        session.getStartedAt(),
        session.getEndedAt(),
        leaderboard.size(),
        questionResults,
        leaderboard);
  }

  private List<Long> selectedOptionIds(ParticipantAnswer answer) {
    if (answer == null || answer.getSelectedOptionIds().isEmpty()) {
      return List.of();
    }
    return new ArrayList<>(answer.getSelectedOptionIds());
  }
}
