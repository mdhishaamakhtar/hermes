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
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SessionResultsService {

  private final QuizSessionRepository sessionRepository;
  private final ParticipantRepository participantRepository;
  private final ParticipantAnswerRepository answerRepository;
  private final OwnershipService ownershipService;
  private final SessionRedisHelper redisHelper;
  private final ParticipantService participantService;

  public SessionResultsService(
      QuizSessionRepository sessionRepository,
      ParticipantRepository participantRepository,
      ParticipantAnswerRepository answerRepository,
      OwnershipService ownershipService,
      SessionRedisHelper redisHelper,
      ParticipantService participantService) {
    this.sessionRepository = sessionRepository;
    this.participantRepository = participantRepository;
    this.answerRepository = answerRepository;
    this.ownershipService = ownershipService;
    this.redisHelper = redisHelper;
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

    Long participantId = participantService.resolveParticipantId(rejoinToken);
    Participant participant =
        participantRepository
            .findById(participantId)
            .orElseThrow(() -> AppException.notFound("Participant not found"));

    QuizSnapshot snapshot = redisHelper.deserializeSnapshot(session.getSnapshot());
    List<ParticipantAnswer> answers = answerRepository.findByParticipantId(participantId);

    Map<Long, ParticipantAnswer> answerMap = new LinkedHashMap<>();
    answers.forEach(a -> answerMap.put(a.getQuestionId(), a));

    int correctCount = (int) answers.stream().filter(ParticipantAnswer::isCorrect).count();

    // Compute rank from all session answers
    List<ParticipantAnswer> allAnswers = answerRepository.findBySessionId(sessionId);
    long totalParticipants = participantRepository.countBySessionId(sessionId);

    Map<Long, Long> scores = new LinkedHashMap<>();
    // Initialize all participants with 0 so zero-correct participants get ranked
    participantRepository.findBySessionId(sessionId).forEach(p -> scores.put(p.getId(), 0L));
    allAnswers.stream()
        .filter(ParticipantAnswer::isCorrect)
        .forEach(a -> scores.merge(a.getParticipantId(), 1L, Long::sum));

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
                  Long selectedOptionId = ans != null ? ans.getOptionId() : null;
                  String selectedOptionText =
                      selectedOptionId != null
                          ? q.options().stream()
                              .filter(o -> o.id().equals(selectedOptionId))
                              .map(QuizSnapshot.OptionSnapshot::text)
                              .findFirst()
                              .orElse(null)
                          : null;
                  QuizSnapshot.OptionSnapshot correct =
                      q.options().stream()
                          .filter(QuizSnapshot.OptionSnapshot::isCorrect)
                          .findFirst()
                          .orElse(null);
                  boolean isCorrect = ans != null && ans.isCorrect();
                  return new MyResultsResponse.QuestionResult(
                      q.id(),
                      q.text(),
                      q.orderIndex(),
                      selectedOptionId,
                      selectedOptionText,
                      correct != null ? correct.id() : null,
                      correct != null ? correct.text() : null,
                      isCorrect,
                      isCorrect ? 1 : 0);
                })
            .toList();

    return new MyResultsResponse(
        participant.getId(),
        participant.getDisplayName(),
        correctCount,
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

    QuizSnapshot snapshot = redisHelper.deserializeSnapshot(session.getSnapshot());
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
                  Map<Long, Long> optionCounts = new LinkedHashMap<>();
                  q.options().forEach(o -> optionCounts.put(o.id(), 0L));
                  allAnswers.stream()
                      .filter(a -> a.getQuestionId().equals(q.id()))
                      .forEach(a -> optionCounts.merge(a.getOptionId(), 1L, Long::sum));

                  long totalAnswers =
                      optionCounts.values().stream().mapToLong(Long::longValue).sum();

                  List<SessionResultsResponse.OptionInfo> options =
                      q.options().stream()
                          .map(
                              o ->
                                  new SessionResultsResponse.OptionInfo(
                                      o.id(),
                                      o.text(),
                                      o.isCorrect(),
                                      o.orderIndex(),
                                      optionCounts.getOrDefault(o.id(), 0L)))
                          .toList();

                  return new SessionResultsResponse.QuestionResult(
                      q.id(),
                      q.text(),
                      q.orderIndex(),
                      q.timeLimitSeconds(),
                      totalAnswers,
                      options);
                })
            .toList();

    // Build leaderboard — include ALL participants (zero-correct get score 0)
    Map<Long, Long> scores = new LinkedHashMap<>();
    participants.forEach(p -> scores.put(p.getId(), 0L));
    allAnswers.stream()
        .filter(ParticipantAnswer::isCorrect)
        .forEach(a -> scores.merge(a.getParticipantId(), 1L, Long::sum));

    List<SessionResultsResponse.LeaderboardEntry> leaderboard = new ArrayList<>();
    scores.entrySet().stream()
        .sorted(Map.Entry.<Long, Long>comparingByValue().reversed())
        .forEach(
            e ->
                leaderboard.add(
                    new SessionResultsResponse.LeaderboardEntry(
                        leaderboard.size() + 1,
                        e.getKey(),
                        displayNames.getOrDefault(e.getKey(), "Unknown"),
                        e.getValue())));

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
}
