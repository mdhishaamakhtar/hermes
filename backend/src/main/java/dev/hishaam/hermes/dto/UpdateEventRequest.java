package dev.hishaam.hermes.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateEventRequest(@NotBlank @Size(max = 255) String title, String description) {}
