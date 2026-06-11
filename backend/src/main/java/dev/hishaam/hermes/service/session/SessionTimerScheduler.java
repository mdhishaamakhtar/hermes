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

/**
 * Schedules and cancels per-question Quartz jobs that fire {@link
 * dev.hishaam.hermes.jobs.SessionTimeoutJob} when a question's time limit expires. One job per
 * session; scheduling a new timer for the same session atomically replaces the old one.
 */
@Service
public class SessionTimerScheduler {

  private static final String GROUP = "session-timers";

  private final Scheduler scheduler;

  public SessionTimerScheduler(Scheduler scheduler) {
    this.scheduler = scheduler;
  }

  /**
   * Schedules a one-shot job to fire after {@code timeLimitSeconds}. The {@code
   * expectedQuestionSequence} is embedded in the job data so the job can detect stale firings and
   * no-op if the session has already advanced.
   */
  public void scheduleQuestionTimer(
      Long sessionId, int timeLimitSeconds, long expectedQuestionSequence) {
    JobKey jobKey = jobKey(sessionId);
    TriggerKey triggerKey = triggerKey(sessionId);

    JobDetail jobDetail =
        JobBuilder.newJob(SessionTimeoutJob.class)
            .withIdentity(jobKey)
            .usingJobData(SessionTimeoutJob.SESSION_ID, sessionId)
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

  /** Cancels the pending timer job for the session, if any. Safe to call when no job exists. */
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
