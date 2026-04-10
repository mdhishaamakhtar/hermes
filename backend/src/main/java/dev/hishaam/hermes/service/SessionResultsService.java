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
import dev.hishaam.hermes.util.LeaderboardBuilder;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SessionResultsService {

  private final QuizSessionRepository sessionRepository;
  private final ParticipantRepository participantRepository;
  private final ParticipantAnswerRepository answerRepository;
  private final OwnershipService ownershipService;
  private final SessionSnapshotService snapshotService;
  private final ParticipantService participantService;

  public SessionResultsService(
      QuizSessionRepository sessionRepository,
      ParticipantRepository participantRepository,
      ParticipantAnswerRepository answerRepository,
      OwnershipService ownershipService,
      SessionSnapshotService snapshotService,
      ParticipantService participantService) {
    this.sessionRepository = sessionRepository;
    this.participantRepository = participantRepository;
    this.answerRepository = answerRepository;
    this.ownershipService = ownershipService;
    this.snapshotService = snapshotService;
    this.participantService = participantService;
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
                        isCorrectSelection(answer, snapshot.findQuestion(answer.getQuestionId())))
                .count();
    int totalScore =
        answers.stream()
            .mapToInt(answer -> answer.getScore() != null ? answer.getScore() : 0)
            .sum();

    // Compute rank from all session answers
    List<ParticipantAnswer> allAnswers = answerRepository.findBySessionId(sessionId);
    long totalParticipants = participantRepository.countBySessionId(sessionId);

    Map<Long, Long> scores = new LinkedHashMap<>();
    // Initialize all participants with 0 so zero-score participants get ranked
    participantRepository.findBySessionId(sessionId).forEach(p -> scores.put(p.getId(), 0L));
    allAnswers.stream()
        .forEach(
            answer -> {
              scores.merge(
                  answer.getParticipantId(),
                  (long) (answer.getScore() != null ? answer.getScore() : 0),
                  Long::sum);
            });

    List<Long> sortedIds =
        scores.entrySet().stream()
            .sorted(Map.Entry.<Long, Long>comparingByValue().reversed())
            .map(Map.Entry::getKey)
            .toList();
    int rank = sortedIds.indexOf(participantId) + 1;
    if (rank == 0) rank = (int) totalParticipants; // shouldn't happen now, but safety net

    List<MyResultsResponse.QuestionResult> questions =
        snapshot.questions().stream()
            .sorted(Comparator.comparingInt(QuizSnapshot.QuestionSnapshot::orderIndex))
            .map(
                q -> {
                  ParticipantAnswer ans = answerMap.get(q.id());
                  List<Long> selectedOptionIds = selectedOptionIds(ans);
                  List<Long> correctOptionIds =
                      q.options().stream()
                          .filter(o -> o.pointValue() > 0)
                          .map(QuizSnapshot.OptionSnapshot::id)
                          .toList();
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
                      q.passageId() != null
                          ? snapshot.findPassage(q.passageId()) != null
                              ? snapshot.findPassage(q.passageId()).text()
                              : null
                          : null;
                  boolean isCorrect = isCorrectSelection(ans, q);
                  int pointsEarned = ans != null && ans.getScore() != null ? ans.getScore() : 0;
                  return new MyResultsResponse.QuestionResult(
                      q.id(),
                      q.text(),
                      q.orderIndex(),
                      q.questionType().name(),
                      passageText,
                      selectedOptionIds,
                      correctOptionIds,
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
        totalParticipants,
        questions);
  }

  private SessionResultsResponse computeResults(QuizSession session) {
    Long sessionId = session.getId();
    Long quizId = session.getQuiz().getId();
    Long eventId = session.getQuiz().getEvent().getId();
    String quizTitle = session.getQuiz().getTitle();

    QuizSnapshot snapshot = snapshotService.deserialize(session.getSnapshot());
    List<ParticipantAnswer> allAnswers = answerRepository.findBySessionId(sessionId);
    List<Participant> participants = participantRepository.findBySessionId(sessionId);

    Map<Long, String> displayNames = new LinkedHashMap<>();
    participants.forEach(p -> displayNames.put(p.getId(), p.getDisplayName()));

    // Build per-question results
    List<SessionResultsResponse.QuestionResult> questionResults =
        snapshot.questions().stream()
            .sorted(Comparator.comparingInt(QuizSnapshot.QuestionSnapshot::orderIndex))
            .map(
                q -> {
                  List<ParticipantAnswer> questionAnswers =
                      allAnswers.stream().filter(a -> a.getQuestionId().equals(q.id())).toList();
                  Map<Long, Long> optionCounts = new LinkedHashMap<>();
                  q.options().forEach(o -> optionCounts.put(o.id(), 0L));
                  questionAnswers.forEach(
                      answer ->
                          answer
                              .getSelectedOptions()
                              .forEach(
                                  option -> optionCounts.merge(option.getId(), 1L, Long::sum)));

                  long totalAnswers =
                      questionAnswers.stream()
                          .filter(answer -> answer.getAnsweredAt() != null)
                          .count();
                  String passageText =
                      q.passageId() != null
                          ? snapshot.findPassage(q.passageId()) != null
                              ? snapshot.findPassage(q.passageId()).text()
                              : null
                          : null;

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
                      q.orderIndex(),
                      q.timeLimitSeconds(),
                      passageText,
                      totalAnswers,
                      options);
                })
            .toList();

    // Build leaderboard — include ALL participants (zero-score get score 0)
    Map<Long, Long> scores = new LinkedHashMap<>();
    participants.forEach(p -> scores.put(p.getId(), 0L));
    allAnswers.forEach(
        answer ->
            scores.merge(
                answer.getParticipantId(),
                Long.valueOf(answer.getScore() != null ? answer.getScore() : 0),
                Long::sum));

    List<SessionResultsResponse.LeaderboardEntry> leaderboard =
        LeaderboardBuilder.rank(scores, displayNames);

    return new SessionResultsResponse(
        sessionId,
        quizId,
        eventId,
        quizTitle,
        session.getStartedAt(),
        session.getEndedAt(),
        participants.size(),
        questionResults,
        leaderboard);
  }

  private List<Long> selectedOptionIds(ParticipantAnswer answer) {
    if (answer == null || answer.getSelectedOptions().isEmpty()) {
      return List.of();
    }
    return answer.getSelectedOptions().stream()
        .sorted(Comparator.comparingInt(option -> option.getOrderIndex()))
        .map(option -> option.getId())
        .toList();
  }

  private boolean isCorrectSelection(
      ParticipantAnswer answer, QuizSnapshot.QuestionSnapshot questionSnapshot) {
    if (answer == null || questionSnapshot == null) {
      return false;
    }

    Set<Long> selectedOptionIds =
        answer.getSelectedOptions().stream()
            .map(option -> option.getId())
            .collect(LinkedHashSet::new, Set::add, Set::addAll);
    Set<Long> correctOptionIds =
        questionSnapshot.options().stream()
            .filter(option -> option.pointValue() > 0)
            .map(QuizSnapshot.OptionSnapshot::id)
            .collect(LinkedHashSet::new, Set::add, Set::addAll);

    return !selectedOptionIds.isEmpty() && selectedOptionIds.equals(correctOptionIds);
  }
}
