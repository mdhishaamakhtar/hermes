package dev.hishaam.hermes.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * A quiz's whole running order, top to bottom: every standalone question and passage exactly once.
 * A passage may also give its questions' order; left out, they keep theirs.
 */
public record ReorderRequest(@NotEmpty @Valid List<Block> blocks) {

  public enum Kind {
    QUESTION,
    PASSAGE
  }

  public record Block(@NotNull Kind kind, @NotNull Long id, List<Long> questionIds) {}
}
