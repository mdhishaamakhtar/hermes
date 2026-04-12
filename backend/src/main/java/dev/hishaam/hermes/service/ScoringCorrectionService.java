package dev.hishaam.hermes.service;

import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.dto.session.ScoringCorrectionRequest;
import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.entity.SessionStatus;
import dev.hishaam.hermes.entity.enums.QuestionLifecycleState;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.redis.SessionStateRedisRepository;
import dev.hishaam.hermes.service.session.SessionSnapshotService;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ScoringCorrectionService {

  private final OwnershipService ownershipService;
  private final SessionSnapshotService snapshotService;
  private final SessionStateRedisRepository stateStore;
  private final GradingService gradingService;

  public ScoringCorrectionService(
      OwnershipService ownershipService,
      SessionSnapshotService snapshotService,
      SessionStateRedisRepository stateStore,
      GradingService gradingService) {
    this.ownershipService = ownershipService;
    this.snapshotService = snapshotService;
    this.stateStore = stateStore;
    this.gradingService = gradingService;
  }

  @Transactional
  public void correctScoring(
      Long sessionId, Long questionId, ScoringCorrectionRequest request, Long userId) {
    QuizSession session = ownershipService.requireSessionOwner(sessionId, userId);

    if (session.getStatus() == SessionStatus.ACTIVE) {
      String questionState = stateStore.getQuestionState(sessionId);
      if (!QuestionLifecycleState.REVIEWING.name().equals(questionState)) {
        throw AppException.conflict(
            "Scoring can only be corrected while reviewing or after session ends");
      }
    } else if (session.getStatus() != SessionStatus.ENDED) {
      throw AppException.conflict(
          "Scoring can only be corrected while reviewing or after session ends");
    }

    String sid = sessionId.toString();
    QuizSnapshot snapshot = snapshotService.loadSnapshot(sid);
    if (snapshot.findQuestion(questionId) == null) {
      throw AppException.notFound("Question not found in session snapshot");
    }

    Map<Long, Integer> newPointValues =
        request.options().stream()
            .collect(
                Collectors.toMap(
                    ScoringCorrectionRequest.OptionScoring::optionId,
                    ScoringCorrectionRequest.OptionScoring::pointValue));

    QuizSnapshot updated =
        snapshot.withCorrectedScoring(questionId, newPointValues, OffsetDateTime.now());
    snapshotService.updateSnapshot(sid, sessionId, updated);

    gradingService.regradeQuestion(sessionId, questionId);
  }
}
