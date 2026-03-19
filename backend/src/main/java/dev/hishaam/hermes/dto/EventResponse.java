package dev.hishaam.hermes.dto;

import java.time.OffsetDateTime;
import java.util.List;

public record EventResponse(
    Long id,
    Long userId,
    String title,
    String description,
    OffsetDateTime createdAt,
    List<QuizSummary> quizzes) {

  public record QuizSummary(Long id, String title, int orderIndex) {}
}
