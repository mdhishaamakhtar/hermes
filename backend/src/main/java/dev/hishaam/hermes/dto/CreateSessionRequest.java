package dev.hishaam.hermes.dto;

import jakarta.validation.constraints.NotNull;

public record CreateSessionRequest(@NotNull Long quizId) {}
