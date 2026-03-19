package dev.hishaam.hermes.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record JoinSessionRequest(
    @NotBlank @Size(min = 6, max = 6) String joinCode,
    @NotBlank @Size(max = 30) String displayName) {}
