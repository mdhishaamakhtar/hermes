package dev.hishaam.hermes.dto;

import java.util.List;

public record QuestionResponse(
    Long id,
    Long quizId,
    String text,
    int orderIndex,
    int timeLimitSeconds,
    String displayModeOverride,
    String effectiveDisplayMode,
    List<OptionResponse> options) {}
