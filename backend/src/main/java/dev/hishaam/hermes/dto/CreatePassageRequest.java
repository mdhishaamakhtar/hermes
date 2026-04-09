package dev.hishaam.hermes.dto;

import dev.hishaam.hermes.entity.enums.PassageTimerMode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record CreatePassageRequest(
    @NotBlank String text,
    Integer orderIndex,
    PassageTimerMode timerMode,
    Integer timeLimitSeconds,
    @NotEmpty @Valid List<CreateQuestionRequest> subQuestions) {}
