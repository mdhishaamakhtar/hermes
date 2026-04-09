package dev.hishaam.hermes.dto;

import dev.hishaam.hermes.entity.enums.DisplayMode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateQuizRequest(
    @NotBlank @Size(max = 255) String title, Integer orderIndex, DisplayMode displayMode) {}
