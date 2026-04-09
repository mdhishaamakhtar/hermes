package dev.hishaam.hermes.dto;

import dev.hishaam.hermes.entity.enums.DisplayMode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record CreateQuestionRequest(
    @NotBlank String text,
    @NotNull Integer orderIndex,
    @NotNull @Min(5) Integer timeLimitSeconds,
    DisplayMode displayModeOverride,
    @NotEmpty @Valid List<OptionRequest> options) {}
