package dev.hishaam.hermes.dto;

import java.time.OffsetDateTime;
import java.util.List;

public record QuizResponse(
    Long id,
    Long eventId,
    String title,
    int orderIndex,
    String displayMode,
    OffsetDateTime createdAt,
    List<QuestionResponse> questions) {}
