package dev.hishaam.hermes.jobs;

import dev.hishaam.hermes.repository.redis.SessionStateRedisRepository;
import dev.hishaam.hermes.service.session.SessionEngine;
import dev.hishaam.hermes.service.session.SessionTransitions;
import org.quartz.DisallowConcurrentExecution;
import org.quartz.Job;
import org.quartz.JobDataMap;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;

/**
 * Fires when a question/passage timer expires and hands off to {@code SessionEngine}. The question
 * sequence snapshot taken at scheduling time guards against stale firings: if the host advanced or
 * ended the session while this job was pending, the sequence in Redis has moved on and the job
 * no-ops. The check and the expiry run under the session's transition lock, so a host ending the
 * timer early, or advancing, cannot interleave with them. Spring Boot's job factory builds each
 * instance, which is how the collaborators arrive.
 */
@DisallowConcurrentExecution
public class SessionTimeoutJob implements Job {

  public static final String SESSION_ID = "sessionId";
  public static final String EXPECTED_QUESTION_SEQUENCE = "expectedQuestionSequence";

  private final SessionStateRedisRepository stateStore;
  private final SessionEngine engine;
  private final SessionTransitions transitions;

  public SessionTimeoutJob(
      SessionStateRedisRepository stateStore,
      SessionEngine engine,
      SessionTransitions transitions) {
    this.stateStore = stateStore;
    this.engine = engine;
    this.transitions = transitions;
  }

  @Override
  public void execute(JobExecutionContext context) throws JobExecutionException {
    try {
      JobDataMap jobDataMap = context.getMergedJobDataMap();
      Long sessionId = jobDataMap.getLong(SESSION_ID);
      long expectedQuestionSequence = jobDataMap.getLong(EXPECTED_QUESTION_SEQUENCE);

      transitions.runPatiently(
          sessionId,
          () -> {
            if (stateStore.getQuestionSequence(sessionId) == expectedQuestionSequence) {
              engine.onTimerExpired(sessionId);
            }
          });
    } catch (Exception e) {
      throw new JobExecutionException("Failed to execute session timeout job", e);
    }
  }
}
