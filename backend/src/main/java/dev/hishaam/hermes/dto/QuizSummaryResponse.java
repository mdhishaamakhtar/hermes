package dev.hishaam.hermes.dto;

import java.time.OffsetDateTime;

/**
 * A quiz as the organiser's quiz list shows it. {@code defaultEvent} marks a quiz that sits in no
 * event of the organiser's choosing, so the list doesn't name one.
 */
public record QuizSummaryResponse(
    Long id,
    String title,
    Long eventId,
    String eventTitle,
    boolean defaultEvent,
    int questionCount,
    OffsetDateTime createdAt) {}
