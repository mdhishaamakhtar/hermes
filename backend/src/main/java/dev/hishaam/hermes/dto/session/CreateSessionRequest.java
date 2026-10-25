package dev.hishaam.hermes.dto.session;

import jakarta.validation.constraints.NotNull;

/** {@code rehearsal} opens a run-through that stays out of past sessions and standings. */
public record CreateSessionRequest(@NotNull Long quizId, Boolean rehearsal) {}
