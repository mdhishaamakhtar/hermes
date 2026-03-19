package dev.hishaam.hermes.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateQuizRequest(
    @NotBlank @Size(max = 255) String title, @NotNull Integer orderIndex) {}
