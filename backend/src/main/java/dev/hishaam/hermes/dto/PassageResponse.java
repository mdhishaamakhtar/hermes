package dev.hishaam.hermes.dto;

import java.util.List;

public record PassageResponse(
    Long id,
    Long quizId,
    String text,
    int orderIndex,
    String timerMode,
    Integer timeLimitSeconds,
    List<QuestionResponse> subQuestions) {}
