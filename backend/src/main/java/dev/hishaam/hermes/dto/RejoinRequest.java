package dev.hishaam.hermes.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record RejoinRequest(@NotBlank String rejoinToken, @NotNull Long sessionId) {}
