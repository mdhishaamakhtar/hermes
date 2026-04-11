package dev.hishaam.hermes.dto.session;

import java.util.List;

public record RejoinResponse(
    Long participantId,
    Long sessionId,
    String status,
    String questionLifecycle,
    String sessionTitle,
    int participantCount,
    Long currentQuestionId,
    Long currentPassageId,
    List<Long> alreadyAnswered,
    CurrentQuestion currentQuestion,
    CurrentPassage currentPassage,
    Integer timeLeftSeconds) {

  public record CurrentQuestion(
      Long id,
      String text,
      int orderIndex,
      int totalQuestions,
      int timeLimitSeconds,
      String questionType,
      String effectiveDisplayMode,
      PassageInfo passage,
      List<OptionInfo> options,
      List<Long> selectedOptionIds,
      boolean lockedIn) {}

  public record CurrentPassage(
      Long id,
      String text,
      String timerMode,
      int questionIndex,
      int totalQuestions,
      Integer timeLimitSeconds,
      String effectiveDisplayMode,
      List<QuestionInfo> subQuestions) {}

  public record QuestionInfo(
      Long id,
      String text,
      int orderIndex,
      int timeLimitSeconds,
      String questionType,
      String effectiveDisplayMode,
      List<OptionInfo> options,
      List<Long> selectedOptionIds,
      boolean lockedIn) {}

  public record PassageInfo(Long id, String text, String timerMode) {}

  public record OptionInfo(Long id, String text, int orderIndex) {}
}
