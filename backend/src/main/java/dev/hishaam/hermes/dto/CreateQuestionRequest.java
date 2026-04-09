package dev.hishaam.hermes.dto;

import dev.hishaam.hermes.entity.enums.DisplayMode;
import dev.hishaam.hermes.entity.enums.QuestionType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record CreateQuestionRequest(
    @NotBlank String text,
    Integer orderIndex,
    Integer timeLimitSeconds,
    QuestionType questionType,
    DisplayMode displayModeOverride,
    @NotEmpty @Valid List<OptionRequest> options) {}
