package dev.hishaam.hermes.dto.session;

import java.util.List;

/** An answer option as shown during a live question — never carries its point value. */
public record OptionInfo(Long id, String text, int orderIndex) {

  public static List<OptionInfo> of(QuizSnapshot.QuestionSnapshot question) {
    return question.options().stream()
        .map(o -> new OptionInfo(o.id(), o.text(), o.orderIndex()))
        .toList();
  }
}
