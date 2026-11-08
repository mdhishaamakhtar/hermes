package dev.hishaam.hermes.dto.session;

import jakarta.validation.constraints.NotNull;

public record CreateSessionRequest(@NotNull Long quizId) {}
