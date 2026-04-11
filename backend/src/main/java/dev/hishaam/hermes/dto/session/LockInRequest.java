package dev.hishaam.hermes.dto.session;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record LockInRequest(
    @NotBlank String rejoinToken, @NotNull Long questionId, String clientRequestId) {}
