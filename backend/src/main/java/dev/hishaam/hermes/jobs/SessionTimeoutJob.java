package dev.hishaam.hermes.jobs;

import dev.hishaam.hermes.repository.redis.SessionStateRedisRepository;
import dev.hishaam.hermes.service.session.SessionEngine;
import org.quartz.DisallowConcurrentExecution;
import org.quartz.Job;
import org.quartz.JobDataMap;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;
import org.springframework.context.ApplicationContext;

/**
 * Fires when a question/passage timer expires and hands off to {@code SessionEngine}. The question
 * sequence snapshot taken at scheduling time guards against stale firings: if the host advanced or
 * ended the session while this job was pending, the sequence in Redis has moved on and the job
 * no-ops.
 */
@DisallowConcurrentExecution
public class SessionTimeoutJob implements Job {

  public static final String SESSION_ID = "sessionId";
  public static final String EXPECTED_QUESTION_SEQUENCE = "expectedQuestionSequence";

  @Override
  public void execute(JobExecutionContext context) throws JobExecutionException {
    try {
      ApplicationContext applicationContext =
          (ApplicationContext) context.getScheduler().getContext().get("applicationContext");
      JobDataMap jobDataMap = context.getMergedJobDataMap();

      Long sessionId = jobDataMap.getLong(SESSION_ID);
      long expectedQuestionSequence = jobDataMap.getLong(EXPECTED_QUESTION_SEQUENCE);

      SessionStateRedisRepository stateStore =
          applicationContext.getBean(SessionStateRedisRepository.class);
      SessionEngine engine = applicationContext.getBean(SessionEngine.class);

      long currentSequence = stateStore.getQuestionSequence(sessionId);
      if (currentSequence != expectedQuestionSequence) {
        return;
      }

      engine.onTimerExpired(sessionId);
    } catch (Exception e) {
      throw new JobExecutionException("Failed to execute session timeout job", e);
    }
  }
}
