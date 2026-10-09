package dev.hishaam.hermes.service.session;

import dev.hishaam.hermes.exception.AppException;
import dev.hishaam.hermes.repository.redis.SessionStateRedisRepository;
import java.time.Duration;
import org.springframework.stereotype.Component;

/**
 * Runs one session's lifecycle transitions one at a time, across threads and instances.
 *
 * <p>Every transition checks the lifecycle and then acts on it in several steps, so two that
 * overlap can both pass the check: two "next" presses advance twice and skip a question, two
 * "start" presses advance past the first, and a timer expiring while the host ends it early grades
 * the question twice. Those overlaps are ordinary, not exotic — a presenter's clicker that sends
 * its key twice, a host with the session open in two tabs. Holding this lock across the check and
 * the transaction makes the second caller see the first one's result, so it is refused as a
 * conflict (or, for the timer, finds nothing left to do).
 */
@Component
public class SessionTransitions {

  /** Longer than any transition takes, grading a large session included. */
  static final Duration LOCK_TTL = Duration.ofSeconds(30);

  private static final Duration HOST_WAIT = Duration.ofSeconds(5);
  private static final Duration POLL = Duration.ofMillis(20);

  private final SessionStateRedisRepository stateStore;

  public SessionTransitions(SessionStateRedisRepository stateStore) {
    this.stateStore = stateStore;
  }

  /**
   * Runs a host-requested transition under the lock. A host is refused with a conflict if another
   * transition holds the session for longer than a few seconds.
   */
  public void run(Long sessionId, Runnable transition) {
    runWaiting(sessionId, HOST_WAIT, transition);
  }

  /**
   * Runs a transition that must not be skipped, such as the timer expiring, waiting as long as a
   * holder could keep the lock.
   */
  public void runPatiently(Long sessionId, Runnable transition) {
    runWaiting(sessionId, LOCK_TTL, transition);
  }

  private void runWaiting(Long sessionId, Duration wait, Runnable transition) {
    String token = acquire(sessionId, wait);
    try {
      transition.run();
    } finally {
      stateStore.unlockTransitions(sessionId, token);
    }
  }

  private String acquire(Long sessionId, Duration wait) {
    long deadline = System.nanoTime() + wait.toNanos();
    while (true) {
      String token = stateStore.tryLockTransitions(sessionId, LOCK_TTL);
      if (token != null) return token;
      if (System.nanoTime() >= deadline) {
        throw AppException.conflict("The session is busy with another change. Try again.");
      }
      try {
        Thread.sleep(POLL);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        throw AppException.conflict("Interrupted while waiting for the session");
      }
    }
  }
}
