package dev.hishaam.hermes.dto;

import java.time.OffsetDateTime;
import java.util.List;

public record QuizResponse(
    Long id,
    Long eventId,
    String eventTitle,
    boolean defaultEvent,
    String title,
    int orderIndex,
    String displayMode,
    boolean speedScoring,
    OffsetDateTime createdAt,
    List<QuestionResponse> questions,
    List<PassageResponse> passages) {}
