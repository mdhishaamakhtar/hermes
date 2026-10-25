package dev.hishaam.hermes.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** A quiz started from the quiz list. Without an event it goes to the organiser's own quizzes. */
public record NewQuizRequest(@NotBlank @Size(max = 255) String title, Long eventId) {}
