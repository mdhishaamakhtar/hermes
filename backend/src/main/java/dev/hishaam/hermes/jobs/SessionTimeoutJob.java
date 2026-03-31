package dev.hishaam.hermes.jobs;

import dev.hishaam.hermes.service.SessionEngine;
import dev.hishaam.hermes.service.SessionRedisHelper;
import org.quartz.DisallowConcurrentExecution;
import org.quartz.Job;
import org.quartz.JobDataMap;
import org.quartz.JobExecutionContext;
import org.quartz.JobExecutionException;
import org.springframework.context.ApplicationContext;
import org.springframework.data.redis.core.StringRedisTemplate;

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

      StringRedisTemplate redis = applicationContext.getBean(StringRedisTemplate.class);
      SessionRedisHelper redisHelper = applicationContext.getBean(SessionRedisHelper.class);
      SessionEngine sessionEngine = applicationContext.getBean(SessionEngine.class);

      String currentSequence =
          redis.opsForValue().get(redisHelper.key(sessionId.toString(), "question_seq"));
      if (currentSequence == null || Long.parseLong(currentSequence) != expectedQuestionSequence) {
        return;
      }

      sessionEngine.advanceSessionInternal(sessionId);
    } catch (Exception e) {
      throw new JobExecutionException("Failed to execute session timeout job", e);
    }
  }
}
