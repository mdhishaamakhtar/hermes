package dev.hishaam.hermes.service;

import dev.hishaam.hermes.entity.AnswerOption;
import dev.hishaam.hermes.entity.Event;
import dev.hishaam.hermes.entity.Passage;
import dev.hishaam.hermes.entity.Question;
import dev.hishaam.hermes.entity.Quiz;
import dev.hishaam.hermes.entity.enums.DisplayMode;
import dev.hishaam.hermes.entity.enums.PassageTimerMode;
import dev.hishaam.hermes.entity.enums.QuestionType;

/**
 * The quiz a new organiser can start from: seven questions that between them show off one answer
 * and several, a reading passage, a wrong answer that costs points, and a poll. Built fresh each
 * time, so it can be edited like any other quiz.
 */
final class SampleQuiz {

  private static final int TIMER = 20;
  private static final int PASSAGE_TIMER = 30;
  private static final int CORRECT = 10;
  private static final int PENALTY = -5;

  private SampleQuiz() {}

  static Quiz build(Event event, int orderIndex) {
    Quiz quiz =
        Quiz.builder()
            .event(event)
            .title("Sample quiz: a quick tour")
            .orderIndex(orderIndex)
            .displayMode(DisplayMode.LIVE)
            .build();

    question(
        quiz,
        0,
        "What is the largest ocean on Earth?",
        QuestionType.SINGLE_SELECT,
        option("Atlantic", 0),
        option("Indian", 0),
        option("Pacific", CORRECT),
        option("Arctic", 0));
    question(
        quiz,
        1,
        "In which year did people first walk on the Moon?",
        QuestionType.SINGLE_SELECT,
        option("1959", 0),
        option("1969", CORRECT),
        option("1975", 0),
        option("1981", 0));
    question(
        quiz,
        2,
        "Which of these are prime numbers?",
        QuestionType.MULTI_SELECT,
        option("2", CORRECT),
        option("9", 0),
        option("13", CORRECT),
        option("21", 0));

    Passage passage =
        Passage.builder()
            .quiz(quiz)
            .orderIndex(3)
            .timerMode(PassageTimerMode.PER_SUB_QUESTION)
            .text(
                "Honeybees tell each other where to find food with a waggle dance. A forager back"
                    + " at the hive runs a figure of eight, waggling through the straight middle"
                    + " stretch. The angle of that stretch from straight up shows the direction of"
                    + " the food relative to the sun, and the longer the waggle lasts, the farther"
                    + " away the food is. The Austrian scientist Karl von Frisch worked out what the"
                    + " dance means, and shared the 1973 Nobel Prize in Physiology or Medicine.")
            .build();
    subQuestion(
        passage,
        0,
        "What does the length of the waggle tell the other bees?",
        QuestionType.SINGLE_SELECT,
        option("How far away the food is", CORRECT),
        option("What kind of flower it is", 0),
        option("How much food there is", 0),
        option("Which bee found it", 0));
    subQuestion(
        passage,
        1,
        "Which of these does the passage say?",
        QuestionType.MULTI_SELECT,
        option("The dance's angle points the way, relative to the sun", CORRECT),
        option("Karl von Frisch worked out what the dance means", CORRECT),
        option("Bees dance in a perfect circle", 0),
        option("The dance was decoded this century", 0));
    quiz.getPassages().add(passage);

    question(
        quiz,
        4,
        "Which letter appears in no US state's name? A wrong pick costs 5 points.",
        QuestionType.SINGLE_SELECT,
        option("J", PENALTY),
        option("Q", CORRECT),
        option("X", PENALTY),
        option("Z", PENALTY));

    Question poll =
        build(
            quiz,
            null,
            5,
            "Where would you rather explore?",
            QuestionType.SINGLE_SELECT,
            TIMER,
            option("The deep ocean", 0),
            option("Outer space", 0),
            option("A rainforest", 0),
            option("The polar ice", 0));
    poll.setPoll(true);
    quiz.getQuestions().add(poll);
    return quiz;
  }

  private record OptionSpec(String text, int points) {}

  private static OptionSpec option(String text, int points) {
    return new OptionSpec(text, points);
  }

  private static void question(
      Quiz quiz, int orderIndex, String text, QuestionType type, OptionSpec... options) {
    quiz.getQuestions().add(build(quiz, null, orderIndex, text, type, TIMER, options));
  }

  private static void subQuestion(
      Passage passage, int orderIndex, String text, QuestionType type, OptionSpec... options) {
    passage
        .getSubQuestions()
        .add(build(passage.getQuiz(), passage, orderIndex, text, type, PASSAGE_TIMER, options));
  }

  private static Question build(
      Quiz quiz,
      Passage passage,
      int orderIndex,
      String text,
      QuestionType type,
      int timer,
      OptionSpec... options) {
    Question question =
        Question.builder()
            .quiz(quiz)
            .passage(passage)
            .text(text)
            .orderIndex(orderIndex)
            .questionType(type)
            .timeLimitSeconds(timer)
            .build();
    for (int index = 0; index < options.length; index++) {
      question
          .getOptions()
          .add(
              AnswerOption.builder()
                  .question(question)
                  .text(options[index].text())
                  .orderIndex(index)
                  .pointValue(options[index].points())
                  .build());
    }
    return question;
  }
}
