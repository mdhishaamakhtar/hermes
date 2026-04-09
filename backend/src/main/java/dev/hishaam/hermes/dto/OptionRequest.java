package dev.hishaam.hermes.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record OptionRequest(
    @NotBlank String text, Integer orderIndex, @NotNull Integer pointValue) {

  public String normalizedText() {
    return text != null ? text.trim() : null;
  }
}
