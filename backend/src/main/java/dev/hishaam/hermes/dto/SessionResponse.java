package dev.hishaam.hermes.dto;

import java.time.OffsetDateTime;

public record SessionResponse(
    Long id,
    Long quizId,
    String joinCode,
    String status,
    OffsetDateTime startedAt,
    OffsetDateTime endedAt,
    OffsetDateTime createdAt) {}
