package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.QuizSnapshot;
import dev.hishaam.hermes.entity.AnswerOption;
import dev.hishaam.hermes.entity.ParticipantAnswer;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class AnswerScoringService {

  public int computeScore(ParticipantAnswer answer, QuizSnapshot.QuestionSnapshot question) {
    Map<Long, Integer> pointsByOptionId = new LinkedHashMap<>();
    question.options().forEach(o -> pointsByOptionId.put(o.id(), o.pointValue()));

    int rawScore =
        answer.getSelectedOptions().stream()
            .map(AnswerOption::getId)
            .map(pointsByOptionId::get)
            .filter(Objects::nonNull)
            .mapToInt(Integer::intValue)
            .sum();

    return Math.max(rawScore, 0);
  }

  public boolean isCorrectSelection(
      ParticipantAnswer answer, QuizSnapshot.QuestionSnapshot question) {
    if (answer == null || question == null) {
      return false;
    }

    Set<Long> selectedOptionIds =
        answer.getSelectedOptions().stream()
            .map(AnswerOption::getId)
            .collect(java.util.LinkedHashSet::new, Set::add, Set::addAll);
    Set<Long> correctOptionIds =
        question.options().stream()
            .filter(option -> option.pointValue() > 0)
            .map(QuizSnapshot.OptionSnapshot::id)
            .collect(java.util.LinkedHashSet::new, Set::add, Set::addAll);

    return !selectedOptionIds.isEmpty() && selectedOptionIds.equals(correctOptionIds);
  }

  public Map<Long, Long> sumScoresByParticipant(List<ParticipantAnswer> answers) {
    Map<Long, Long> participantTotals = new LinkedHashMap<>();
    answers.forEach(
        answer ->
            participantTotals.merge(
                answer.getParticipantId(),
                Long.valueOf(answer.getScore() != null ? answer.getScore() : 0),
                (a, b) -> Long.sum(Objects.requireNonNull(a), Objects.requireNonNull(b))));
    return participantTotals;
  }

  public long computeAnswerTimeMs(
      OffsetDateTime answeredAt, long timerStartedAtEpochMs, int timeLimitSeconds) {
    long answeredAtMs = answeredAt.toInstant().toEpochMilli();
    long elapsed = answeredAtMs - timerStartedAtEpochMs;
    long maxMs = (long) timeLimitSeconds * 1000;
    return Math.min(Math.max(elapsed, 0L), maxMs);
  }
}
