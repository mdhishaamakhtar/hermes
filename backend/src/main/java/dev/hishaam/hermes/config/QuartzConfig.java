package dev.hishaam.hermes.config;

import org.springframework.boot.quartz.autoconfigure.SchedulerFactoryBeanCustomizer;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class QuartzConfig {

  @Bean
  public SchedulerFactoryBeanCustomizer schedulerFactoryBeanCustomizer(
      ApplicationContext applicationContext) {
    return schedulerFactoryBean ->
        schedulerFactoryBean.setApplicationContextSchedulerContextKey("applicationContext");
  }
}
