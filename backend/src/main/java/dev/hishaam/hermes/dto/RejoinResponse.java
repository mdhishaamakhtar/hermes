package dev.hishaam.hermes.dto;

import java.util.List;

public record RejoinResponse(
    Long participantId,
    Long sessionId,
    String status,
    String sessionTitle,
    int participantCount,
    Long currentQuestionId,
    List<Long> alreadyAnswered,
    CurrentQuestion currentQuestion,
    Integer timeLeftSeconds) {

  public record CurrentQuestion(
      Long id,
      String text,
      int orderIndex,
      int totalQuestions,
      int timeLimitSeconds,
      List<OptionInfo> options) {}

  public record OptionInfo(Long id, String text, int orderIndex) {}
}
