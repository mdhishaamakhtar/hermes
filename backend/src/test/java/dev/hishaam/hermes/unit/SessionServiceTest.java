package dev.hishaam.hermes.unit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import dev.hishaam.hermes.dto.session.CreateSessionRequest;
import dev.hishaam.hermes.dto.session.QuizSnapshot;
import dev.hishaam.hermes.dto.session.SessionResponse;
import dev.hishaam.hermes.entity.Question;
import dev.hishaam.hermes.entity.Quiz;
import dev.hishaam.hermes.entity.QuizSession;
import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.ParticipantAnswerRepository;
import dev.hishaam.hermes.repository.ParticipantRepository;
import dev.hishaam.hermes.repository.QuizRepository;
import dev.hishaam.hermes.repository.QuizSessionRepository;
import dev.hishaam.hermes.repository.redis.SessionScoringRedisRepository;
import dev.hishaam.hermes.repository.redis.SessionStateRedisRepository;
import dev.hishaam.hermes.service.GradingService;
import dev.hishaam.hermes.service.OwnershipService;
import dev.hishaam.hermes.service.session.SessionEngine;
import dev.hishaam.hermes.service.session.SessionEventPublisher;
import dev.hishaam.hermes.service.session.SessionService;
import dev.hishaam.hermes.service.session.SessionSnapshotService;
import dev.hishaam.hermes.service.session.SessionTimerScheduler;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Unit tests for the parts of {@link SessionService} that depend on infrastructure misbehaving.
 *
 * <p>Join-code collisions and Redis outages are both real but rare, and neither can be provoked
 * against a live Testcontainers stack — a random six-character code effectively never repeats, and
 * a healthy Redis never throws. Everything else about sessions is covered end to end by the
 * integration suites.
 */
@ExtendWith(MockitoExtension.class)
class SessionServiceTest {

  private static final Long SESSION_ID = 42L;
  private static final Long QUIZ_ID = 9L;
  private static final Long USER_ID = 7L;

  @Mock private QuizSessionRepository sessionRepository;
  @Mock private QuizRepository quizRepository;
  @Mock private ParticipantAnswerRepository participantAnswerRepository;
  @Mock private ParticipantRepository participantRepository;
  @Mock private OwnershipService ownershipService;
  @Mock private SessionSnapshotService snapshotService;
  @Mock private SessionStateRedisRepository stateStore;
  @Mock private SessionScoringRedisRepository scoringStore;
  @Mock private SessionEngine engine;
  @Mock private SessionEventPublisher eventPublisher;
  @Mock private SessionTimerScheduler timerScheduler;
  @Mock private GradingService gradingService;

  @InjectMocks private SessionService sessionService;

  @Nested
  class JoinCodeGeneration {

    private void quizWithOneQuestion() {
      Quiz quiz =
          Quiz.builder()
              .id(QUIZ_ID)
              .title("Quiz")
              .questions(List.of(Question.builder().id(1L).text("Q").build()))
              .build();
      when(quizRepository.findByIdWithQuestions(QUIZ_ID)).thenReturn(Optional.of(quiz));
      when(snapshotService.buildSnapshot(quiz))
          .thenReturn(new QuizSnapshot(QUIZ_ID, "Quiz", List.of(), List.of()));
      when(snapshotService.serialize(any())).thenReturn("{}");
      when(sessionRepository.save(any()))
          .thenAnswer(invocation -> invocation.<QuizSession>getArgument(0));
    }

    /** A code that is already reserved is discarded and a fresh one drawn, transparently. */
    @Test
    void collidingJoinCodesAreRetriedUntilOneIsReserved() {
      quizWithOneQuestion();
      when(stateStore.tryReserveJoinCode(anyString()))
          .thenReturn(false)
          .thenReturn(false)
          .thenReturn(true);

      SessionResponse response =
          sessionService.createSession(new CreateSessionRequest(QUIZ_ID), USER_ID);

      assertThat(response.joinCode()).hasSize(6);
      verify(stateStore, times(3)).tryReserveJoinCode(anyString());
      verify(sessionRepository).save(any());
    }

    /**
     * If ten draws in a row collide, something is badly wrong with the code space — fail loudly
     * rather than loop or hand out a duplicate that would route participants to another session.
     */
    @Test
    void exhaustingEveryAttemptFailsInsteadOfIssuingADuplicateCode() {
      Quiz quiz =
          Quiz.builder()
              .id(QUIZ_ID)
              .title("Quiz")
              .questions(List.of(Question.builder().id(1L).text("Q").build()))
              .build();
      when(quizRepository.findByIdWithQuestions(QUIZ_ID)).thenReturn(Optional.of(quiz));
      when(snapshotService.buildSnapshot(quiz))
          .thenReturn(new QuizSnapshot(QUIZ_ID, "Quiz", List.of(), List.of()));
      when(snapshotService.serialize(any())).thenReturn("{}");
      when(stateStore.tryReserveJoinCode(anyString())).thenReturn(false);

      assertThatThrownBy(
              () -> sessionService.createSession(new CreateSessionRequest(QUIZ_ID), USER_ID))
          .isInstanceOf(AppException.class)
          .hasMessage("Failed to generate unique join code");

      verify(stateStore, times(10)).tryReserveJoinCode(anyString());
      verify(sessionRepository, never()).save(any());
    }

    /** A quiz with no questions cannot be run, and must not consume a join code. */
    @Test
    void sessionsAreRefusedForQuizzesWithoutQuestions() {
      when(quizRepository.findByIdWithQuestions(QUIZ_ID))
          .thenReturn(Optional.of(Quiz.builder().id(QUIZ_ID).title("Empty").build()));

      assertThatThrownBy(
              () -> sessionService.createSession(new CreateSessionRequest(QUIZ_ID), USER_ID))
          .isInstanceOf(AppException.class)
          .hasMessage("Quiz must have at least one question");

      verify(stateStore, never()).tryReserveJoinCode(anyString());
    }
  }

  @Nested
  class Abandon {

    /**
     * A Redis failure while cleaning up must be swallowed so the PostgreSQL rows are still deleted
     * — otherwise an evicted snapshot would leave an undeletable session behind.
     */
    @Test
    void abandonDeletesPersistedRowsEvenWhenRedisCleanupFails() {
      when(snapshotService.loadSnapshot(SESSION_ID.toString()))
          .thenThrow(new IllegalStateException("snapshot key evicted"));

      assertThatCode(() -> sessionService.abandonSession(SESSION_ID, USER_ID))
          .doesNotThrowAnyException();

      verify(ownershipService).requireSessionOwner(SESSION_ID, USER_ID);
      verify(timerScheduler).cancelQuestionTimer(SESSION_ID);
      verify(stateStore).clearTimer(SESSION_ID);
      verify(participantAnswerRepository).deleteBySessionIdIn(List.of(SESSION_ID));
      verify(participantRepository).deleteBySessionIdIn(List.of(SESSION_ID));
      verify(sessionRepository).deleteById(SESSION_ID);
    }

    /** With Redis healthy, both the state and scoring key sets are cleaned before the rows go. */
    @Test
    void abandonCleansRedisStateAndScoringKeysWhenTheSnapshotLoads() {
      QuizSnapshot snapshot = new QuizSnapshot(QUIZ_ID, "Quiz", List.of(), List.of());
      when(snapshotService.loadSnapshot(SESSION_ID.toString())).thenReturn(snapshot);

      sessionService.abandonSession(SESSION_ID, USER_ID);

      verify(stateStore).cleanupSessionKeys(SESSION_ID, null);
      verify(scoringStore).cleanupScoringKeys(SESSION_ID, snapshot);
      verify(sessionRepository).deleteById(SESSION_ID);
    }

    /** Ownership is checked before anything is touched, so a failed check deletes nothing. */
    @Test
    void abandonDeletesNothingWhenOwnershipCheckFails() {
      when(ownershipService.requireSessionOwner(SESSION_ID, USER_ID))
          .thenThrow(new IllegalStateException("not the owner"));

      assertThatCode(() -> sessionService.abandonSession(SESSION_ID, USER_ID))
          .isInstanceOf(IllegalStateException.class);

      verify(sessionRepository, never()).deleteById(any());
      verify(participantRepository, never()).deleteBySessionIdIn(any());
    }
  }
}
