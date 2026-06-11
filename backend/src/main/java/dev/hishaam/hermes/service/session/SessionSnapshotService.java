package dev.hishaam.hermes.service.session;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.entity.Passage;
import dev.hishaam.hermes.entity.Question;
import dev.hishaam.hermes.entity.Quiz;
import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.entity.enums.DisplayMode;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.QuizSessionRepository;
import dev.hishaam.hermes.repository.redis.SessionStateRedisRepository;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Builds, serializes, and persists the immutable quiz snapshot a session runs against. The snapshot
 * JSON is cached in Redis with a PostgreSQL fallback.
 */
@Service
public class SessionSnapshotService {

  private final ObjectMapper objectMapper;
  private final QuizSessionRepository sessionRepository;
  private final SessionStateRedisRepository stateStore;

  public SessionSnapshotService(
      ObjectMapper objectMapper,
      QuizSessionRepository sessionRepository,
      SessionStateRedisRepository stateStore) {
    this.objectMapper = objectMapper;
    this.sessionRepository = sessionRepository;
    this.stateStore = stateStore;
  }

  /** Captures the quiz's questions, options, and passages as an immutable snapshot. */
  public QuizSnapshot buildSnapshot(Quiz quiz) {
    List<QuizSnapshot.QuestionSnapshot> questions =
        quiz.getQuestions().stream()
            .map(
                q -> {
                  List<QuizSnapshot.OptionSnapshot> options =
                      q.getOptions().stream()
                          .map(
                              o ->
                                  new QuizSnapshot.OptionSnapshot(
                                      o.getId(), o.getText(), o.getPointValue(), o.getOrderIndex()))
                          .toList();
                  return new QuizSnapshot.QuestionSnapshot(
                      q.getId(),
                      q.getText(),
                      q.getQuestionType(),
                      q.getOrderIndex(),
                      q.getTimeLimitSeconds(),
                      q.getPassage() != null ? q.getPassage().getId() : null,
                      resolveEffectiveDisplayMode(quiz, q),
                      options,
                      null);
                })
            .toList();
    List<QuizSnapshot.PassageSnapshot> passages =
        quiz.getPassages().stream().map(this::toPassageSnapshot).toList();
    return new QuizSnapshot(quiz.getId(), quiz.getTitle(), questions, passages);
  }

  public String serialize(QuizSnapshot snapshot) {
    try {
      return objectMapper.writeValueAsString(snapshot);
    } catch (JsonProcessingException e) {
      throw AppException.internalError("Failed to serialize snapshot");
    }
  }

  public QuizSnapshot deserialize(String json) {
    try {
      return objectMapper.readValue(json, QuizSnapshot.class);
    } catch (Exception e) {
      throw AppException.internalError("Failed to deserialize snapshot");
    }
  }

  /** Persists the updated snapshot to both Redis and PostgreSQL. */
  public void updateSnapshot(String sid, Long sessionId, QuizSnapshot updated) {
    String json = serialize(updated);
    stateStore.setSnapshotJson(sid, json);
    sessionRepository
        .findById(sessionId)
        .ifPresent(
            session -> {
              session.setSnapshot(json);
              sessionRepository.save(session);
            });
  }

  /**
   * Loads the snapshot for the given session, checking Redis first and falling back to the {@code
   * snapshot} column in PostgreSQL. Re-populates Redis on a cache miss so subsequent loads are
   * served from memory.
   */
  public QuizSnapshot loadSnapshot(String sid) {
    String json = stateStore.getSnapshotJson(sid);
    if (json == null || json.isEmpty()) {
      QuizSession session =
          sessionRepository
              .findById(Long.parseLong(sid))
              .orElseThrow(() -> AppException.notFound("Session not found"));
      json = session.getSnapshot();
      stateStore.setSnapshotJson(sid, json);
    }
    return deserialize(json);
  }

  private QuizSnapshot.PassageSnapshot toPassageSnapshot(Passage passage) {
    List<Long> subQuestionIds = passage.getSubQuestions().stream().map(Question::getId).toList();
    return new QuizSnapshot.PassageSnapshot(
        passage.getId(),
        passage.getText(),
        passage.getOrderIndex(),
        passage.getTimerMode(),
        passage.getTimeLimitSeconds(),
        subQuestionIds);
  }

  private DisplayMode resolveEffectiveDisplayMode(Quiz quiz, Question question) {
    return question.getDisplayModeOverride() != null
        ? question.getDisplayModeOverride()
        : quiz.getDisplayMode();
  }
}
