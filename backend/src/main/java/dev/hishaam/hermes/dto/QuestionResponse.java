package dev.hishaam.hermes.dto;

import java.util.List;

public record QuestionResponse(
    Long id,
    Long quizId,
    Long passageId,
    String text,
    String questionType,
    int orderIndex,
    int timeLimitSeconds,
    String displayModeOverride,
    String effectiveDisplayMode,
    List<OptionResponse> options) {}
