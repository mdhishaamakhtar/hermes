package dev.hishaam.hermes.dto;

import dev.hishaam.hermes.entity.enums.PassageTimerMode;
import jakarta.validation.constraints.NotBlank;

public record UpdatePassageRequest(
    @NotBlank String text, Integer orderIndex, PassageTimerMode timerMode, Integer timeLimitSeconds) {}
