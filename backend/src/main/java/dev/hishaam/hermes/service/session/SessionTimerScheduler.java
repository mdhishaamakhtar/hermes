package dev.hishaam.hermes.service.session;

import dev.hishaam.hermes.jobs.SessionTimeoutJob;
import java.time.Instant;
import java.util.Date;
import org.quartz.JobBuilder;
import org.quartz.JobDetail;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;
import org.quartz.TriggerKey;
import org.springframework.stereotype.Service;

@Service
public class SessionTimerScheduler {

  private static final String GROUP = "session-timers";

  private final Scheduler scheduler;

  public SessionTimerScheduler(Scheduler scheduler) {
    this.scheduler = scheduler;
  }

  public void scheduleQuestionTimer(
      Long sessionId, Long questionId, int timeLimitSeconds, long expectedQuestionSequence) {
    JobKey jobKey = jobKey(sessionId);
    TriggerKey triggerKey = triggerKey(sessionId);

    JobDetail jobDetail =
        JobBuilder.newJob(SessionTimeoutJob.class)
            .withIdentity(jobKey)
            .usingJobData(SessionTimeoutJob.SESSION_ID, sessionId)
            .usingJobData(SessionTimeoutJob.QUESTION_ID, questionId)
            .usingJobData(SessionTimeoutJob.EXPECTED_QUESTION_SEQUENCE, expectedQuestionSequence)
            .storeDurably()
            .build();

    Trigger trigger =
        TriggerBuilder.newTrigger()
            .withIdentity(triggerKey)
            .forJob(jobKey)
            .startAt(Date.from(Instant.now().plusSeconds(timeLimitSeconds)))
            .build();

    try {
      scheduler.unscheduleJob(triggerKey);
      scheduler.addJob(jobDetail, true);
      scheduler.scheduleJob(trigger);
    } catch (SchedulerException e) {
      throw new IllegalStateException(
          "Failed to schedule question timer for session " + sessionId, e);
    }
  }

  public void cancelQuestionTimer(Long sessionId) {
    JobKey jobKey = jobKey(sessionId);
    TriggerKey triggerKey = triggerKey(sessionId);

    try {
      scheduler.unscheduleJob(triggerKey);
      scheduler.deleteJob(jobKey);
    } catch (SchedulerException e) {
      throw new IllegalStateException(
          "Failed to cancel question timer for session " + sessionId, e);
    }
  }

  private JobKey jobKey(Long sessionId) {
    return JobKey.jobKey("session-" + sessionId, GROUP);
  }

  private TriggerKey triggerKey(Long sessionId) {
    return TriggerKey.triggerKey("session-" + sessionId, GROUP);
  }
}
