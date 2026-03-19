package dev.hishaam.hermes.dto;

import java.time.OffsetDateTime;

public record QuizSessionListResponse(
    Long id,
    String status,
    OffsetDateTime startedAt,
    OffsetDateTime endedAt,
    long participantCount) {}
