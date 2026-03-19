package dev.hishaam.hermes.dto;

import jakarta.validation.constraints.NotBlank;

public record RejoinRequest(@NotBlank String rejoinToken) {}
