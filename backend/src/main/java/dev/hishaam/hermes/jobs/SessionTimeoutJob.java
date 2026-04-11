package dev.hishaam.hermes.jobs;

import dev.hishaam.hermes.service.session.SessionTimerOrchestrator;
import dev.hishaam.hermes.service.session.SessionTimerStateStore;
import org.quartz.DisallowConcurrentExecution;
import org.quartz.Job;
import org.quartz.JobDataMap;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;
import org.springframework.context.ApplicationContext;

@DisallowConcurrentExecution
public class SessionTimeoutJob implements Job {

  public static final String SESSION_ID = "sessionId";
  public static final String QUESTION_ID = "questionId";
  public static final String EXPECTED_QUESTION_SEQUENCE = "expectedQuestionSequence";

  @Override
  public void execute(JobExecutionContext context) throws JobExecutionException {
    try {
      ApplicationContext applicationContext =
          (ApplicationContext) context.getScheduler().getContext().get("applicationContext");
      JobDataMap jobDataMap = context.getMergedJobDataMap();

      Long sessionId = jobDataMap.getLong(SESSION_ID);
      long expectedQuestionSequence = jobDataMap.getLong(EXPECTED_QUESTION_SEQUENCE);

      SessionTimerStateStore timerStore = applicationContext.getBean(SessionTimerStateStore.class);
      SessionTimerOrchestrator timerOrchestrator =
          applicationContext.getBean(SessionTimerOrchestrator.class);

      long currentSequence = timerStore.getQuestionSequence(sessionId);
      if (currentSequence != expectedQuestionSequence) {
        return;
      }

      timerOrchestrator.onTimerExpired(sessionId);
    } catch (Exception e) {
      throw new JobExecutionException("Failed to execute session timeout job", e);
    }
  }
}
