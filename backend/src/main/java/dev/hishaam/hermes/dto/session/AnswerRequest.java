package dev.hishaam.hermes.dto.session;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record AnswerRequest(
    @NotBlank String rejoinToken,
    @NotNull Long questionId,
    @NotNull List<@NotNull Long> selectedOptionIds,
    String clientRequestId) {}
