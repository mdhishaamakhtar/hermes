package dev.hishaam.hermes.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record ScoringCorrectionRequest(@NotNull @NotEmpty List<OptionScoring> options) {

  public record OptionScoring(@NotNull Long optionId, @NotNull Integer pointValue) {}
}
