/**
 * The quiz editor's data model: drafts, validation, payloads, and the pure
 * updates that keep the cached quiz in step with the server.
 *
 * Drafts hold numbers as the strings being typed, so "-" and "" are valid
 * mid-edit states. They become numbers once, in the payload builders.
 */
import type {
  DisplayMode,
  Passage,
  PassageTimerMode,
  Question,
  QuestionType,
  Quiz,
} from "@/lib/types";
import type { Segment } from "@/components/ui/SegmentedControl";

export interface OptionDraft {
  text: string;
  points: string;
}

export interface QuestionDraft {
  text: string;
  /** No right answer: players vote and nobody scores. */
  poll: boolean;
  questionType: QuestionType;
  timeLimitSeconds: string;
  displayModeOverride: DisplayMode | null;
  options: OptionDraft[];
}

export interface PassageDraft {
  text: string;
  timerMode: PassageTimerMode;
  timeLimitSeconds: string;
}

export const MIN_OPTIONS = 2;
export const MIN_TIMER_SECONDS = 5;
const DEFAULT_TIMER = "30";
const DEFAULT_PASSAGE_TIMER = "120";
const CORRECT_POINTS = "10";

/* ── Choices, with the words the editor shows for them ────────────────────── */

export const QUESTION_TYPES: Segment<QuestionType>[] = [
  {
    value: "SINGLE_SELECT",
    label: "One answer",
    description: "Players pick one option.",
  },
  {
    value: "MULTI_SELECT",
    label: "Several answers",
    description: "Players pick every option that applies.",
  },
];

/*
 * How the big screen shows the answers coming in. The join code is on the
 * big screen all quiz long now, so the old code display behaves exactly
 * like hidden, and is shown and saved as hidden.
 */
/** Whether a question has a right answer, in the editor's words. */
export const QUESTION_KINDS: Segment<"QUIZ" | "POLL">[] = [
  {
    value: "QUIZ",
    label: "Quiz",
    description: "One or more answers are right, and they score.",
  },
  {
    value: "POLL",
    label: "Poll",
    description:
      "No right answer. Players vote, nobody scores, and the big screen shows how the room split.",
  },
];

export const SPEED_SCORING: Segment<"OFF" | "ON">[] = [
  {
    value: "OFF",
    label: "Off",
    description: "A right answer scores its full points, however long it took.",
  },
  {
    value: "ON",
    label: "On",
    description:
      "Faster right answers score more. An instant one keeps every point; one at the buzzer keeps half.",
  },
];

export const DISPLAY_MODES: Segment<DisplayMode>[] = [
  {
    value: "LIVE",
    label: "Live",
    description:
      "The spread of answers fills in on the big screen as players respond.",
  },
  {
    value: "BLIND",
    label: "Hidden",
    description:
      "The spread stays hidden until time is up, so nobody follows the crowd.",
  },
];

/** The choice a stored mode shows as: code display reads as hidden. */
export function displayChoice(mode: DisplayMode): DisplayMode {
  return mode === "CODE_DISPLAY" ? "BLIND" : mode;
}

export const TIMER_MODES: Segment<PassageTimerMode>[] = [
  {
    value: "PER_SUB_QUESTION",
    label: "One at a time",
    description: "Each question gets its own timer, with the passage pinned.",
  },
  {
    value: "ENTIRE_PASSAGE",
    label: "All together",
    description: "Every question shows at once, under one shared timer.",
  },
];

export function displayModeLabel(mode: DisplayMode): string {
  return (
    DISPLAY_MODES.find((option) => option.value === displayChoice(mode))
      ?.label ?? mode
  );
}

/** The display mode in a few plain words, for a question's facts. */
export function displayModeNote(mode: DisplayMode): string {
  return displayChoice(mode) === "LIVE"
    ? "Answers shown live"
    : "Answers hidden till time's up";
}

export function questionTypeLabel(type: QuestionType): string {
  return type === "MULTI_SELECT" ? "Several answers" : "One answer";
}

/* ── Drafts ───────────────────────────────────────────────────────────────── */

export function newQuestionDraft(): QuestionDraft {
  return {
    text: "",
    poll: false,
    questionType: "SINGLE_SELECT",
    timeLimitSeconds: DEFAULT_TIMER,
    displayModeOverride: null,
    options: [
      { text: "", points: CORRECT_POINTS },
      { text: "", points: "0" },
      { text: "", points: "0" },
      { text: "", points: "0" },
    ],
  };
}

export function draftFromQuestion(question: Question): QuestionDraft {
  return {
    text: question.text,
    poll: question.poll ?? false,
    questionType: question.questionType,
    timeLimitSeconds: String(
      question.timeLimitSeconds > 0 ? question.timeLimitSeconds : DEFAULT_TIMER,
    ),
    displayModeOverride: question.displayModeOverride,
    options: question.options
      .toSorted((a, b) => a.orderIndex - b.orderIndex)
      .map((option) => ({
        text: option.text,
        points: String(option.pointValue),
      })),
  };
}

export function newPassageDraft(): PassageDraft {
  return {
    text: "",
    timerMode: "PER_SUB_QUESTION",
    timeLimitSeconds: DEFAULT_PASSAGE_TIMER,
  };
}

export function draftFromPassage(passage: Passage): PassageDraft {
  return {
    text: passage.text,
    timerMode: passage.timerMode,
    timeLimitSeconds: String(passage.timeLimitSeconds ?? DEFAULT_PASSAGE_TIMER),
  };
}

function toInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function isCorrect(option: OptionDraft): boolean {
  return toInt(option.points) > 0;
}

/**
 * Flip an option between correct and not. A single-answer question keeps
 * exactly one correct option, so marking one clears the others.
 */
export function toggleCorrect(
  draft: QuestionDraft,
  index: number,
): QuestionDraft {
  const markCorrect = !isCorrect(draft.options[index]);
  return {
    ...draft,
    options: draft.options.map((option, i) => {
      if (i === index) {
        return { ...option, points: markCorrect ? CORRECT_POINTS : "0" };
      }
      if (markCorrect && draft.questionType === "SINGLE_SELECT") {
        return isCorrect(option) ? { ...option, points: "0" } : option;
      }
      return option;
    }),
  };
}

/**
 * Switching to one answer keeps the first correct option and zeroes the rest,
 * so the draft stays valid without the author redoing it.
 */
export function withQuestionType(
  draft: QuestionDraft,
  questionType: QuestionType,
): QuestionDraft {
  if (questionType === "MULTI_SELECT") return { ...draft, questionType };
  const firstCorrect = Math.max(0, draft.options.findIndex(isCorrect));
  return {
    ...draft,
    questionType,
    options: draft.options.map((option, i) => {
      if (i === firstCorrect) {
        return isCorrect(option)
          ? option
          : { ...option, points: CORRECT_POINTS };
      }
      return toInt(option.points) > 0 ? { ...option, points: "0" } : option;
    }),
  };
}

/** Whether a draft scores or displays any differently from the defaults. */
export function usesCustomScoring(draft: QuestionDraft): boolean {
  return (
    draft.displayModeOverride !== null ||
    (!draft.poll &&
      draft.options.some(
        (option) => option.points !== "0" && option.points !== CORRECT_POINTS,
      ))
  );
}

/** The scoring in a few words, for when its fields are folded away. */
export function scoringSummary(draft: QuestionDraft): string {
  if (draft.poll) {
    return draft.displayModeOverride
      ? displayModeLabel(draft.displayModeOverride)
      : "Follows the quiz";
  }
  return usesCustomScoring(draft)
    ? "Custom"
    : `${CORRECT_POINTS} points for a right answer`;
}

/**
 * Turning a question into a poll clears its key, since a poll has none;
 * turning it back marks the first option right, so the draft stays valid.
 */
export function withPoll(draft: QuestionDraft, poll: boolean): QuestionDraft {
  if (poll === draft.poll) return draft;
  return {
    ...draft,
    poll,
    options: draft.options.map((option, index) => ({
      ...option,
      points: !poll && index === 0 ? CORRECT_POINTS : "0",
    })),
  };
}

export function sameDraft(a: QuestionDraft, b: QuestionDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/* ── Validation ───────────────────────────────────────────────────────────── */

/** The first thing stopping this draft from saving, in the editor's words. */
export function validateQuestion(
  draft: QuestionDraft,
  { ownTimer }: { ownTimer: boolean },
): string | null {
  if (!draft.text.trim()) return "Write the question first.";
  if (ownTimer && toInt(draft.timeLimitSeconds) < MIN_TIMER_SECONDS) {
    return `Give players at least ${MIN_TIMER_SECONDS} seconds.`;
  }
  if (draft.options.length < MIN_OPTIONS) {
    return `A question needs at least ${MIN_OPTIONS} options.`;
  }
  if (draft.options.some((option) => !option.text.trim())) {
    return "Fill in every option, or remove the empty ones.";
  }
  if (draft.poll) return null;
  const correct = draft.options.filter(isCorrect).length;
  if (draft.questionType === "SINGLE_SELECT" && correct !== 1) {
    return "Mark exactly one option correct.";
  }
  if (correct < 1) return "Mark at least one option correct.";
  return null;
}

export function validatePassage(draft: PassageDraft): string | null {
  if (!draft.text.trim()) return "Write the passage first.";
  if (
    draft.timerMode === "ENTIRE_PASSAGE" &&
    toInt(draft.timeLimitSeconds) < MIN_TIMER_SECONDS
  ) {
    return `Give players at least ${MIN_TIMER_SECONDS} seconds.`;
  }
  return null;
}

/* ── Payloads ─────────────────────────────────────────────────────────────── */

export interface QuestionPayload {
  text: string;
  poll: boolean;
  orderIndex: number;
  timeLimitSeconds?: number;
  questionType: QuestionType;
  displayModeOverride: DisplayMode | null;
  options: Array<{ text: string; pointValue: number; orderIndex: number }>;
}

export function questionPayload(
  draft: QuestionDraft,
  orderIndex: number,
  { ownTimer }: { ownTimer: boolean },
): QuestionPayload {
  return {
    text: draft.text.trim(),
    poll: draft.poll,
    orderIndex,
    timeLimitSeconds: ownTimer ? toInt(draft.timeLimitSeconds) : undefined,
    questionType: draft.questionType,
    displayModeOverride: draft.displayModeOverride,
    options: draft.options.map((option, index) => ({
      text: option.text.trim(),
      pointValue: toInt(option.points),
      orderIndex: index,
    })),
  };
}

export function passagePayload(draft: PassageDraft, orderIndex: number) {
  return {
    text: draft.text.trim(),
    orderIndex,
    timerMode: draft.timerMode,
    timeLimitSeconds:
      draft.timerMode === "ENTIRE_PASSAGE"
        ? toInt(draft.timeLimitSeconds)
        : null,
  };
}

/* ── The cached quiz, updated in place after each save ───────────────────── */

const byOrder = <T extends { orderIndex: number }>(items: T[]) =>
  items.toSorted((a, b) => a.orderIndex - b.orderIndex);

export type QuizBlock =
  | { kind: "question"; question: Question }
  | { kind: "passage"; passage: Passage };

/** Standalone questions and passages, interleaved in running order. */
export function quizBlocks(quiz: Quiz): QuizBlock[] {
  const blocks: Array<QuizBlock & { orderIndex: number }> = [
    ...quiz.questions
      .filter((question) => question.passageId == null)
      .map((question) => ({
        kind: "question" as const,
        question,
        orderIndex: question.orderIndex,
      })),
    ...quiz.passages.map((passage) => ({
      kind: "passage" as const,
      passage,
      orderIndex: passage.orderIndex,
    })),
  ];
  return blocks.toSorted(
    (a, b) =>
      a.orderIndex - b.orderIndex ||
      (a.kind === b.kind ? 0 : a.kind === "question" ? -1 : 1),
  );
}

export function questionCount(quiz: Quiz): number {
  return (
    quiz.questions.filter((question) => question.passageId == null).length +
    quiz.passages.reduce((sum, passage) => sum + passage.subQuestions.length, 0)
  );
}

export function nextOrderIndex(quiz: Quiz): number {
  return (
    Math.max(
      0,
      ...quiz.questions.map((question) => question.orderIndex),
      ...quiz.passages.map((passage) => passage.orderIndex),
    ) + 1
  );
}

export function withQuestion(quiz: Quiz, question: Question): Quiz {
  if (question.passageId == null) {
    const others = quiz.questions.filter((q) => q.id !== question.id);
    return { ...quiz, questions: byOrder([...others, question]) };
  }
  return {
    ...quiz,
    passages: quiz.passages.map((passage) =>
      passage.id === question.passageId
        ? {
            ...passage,
            subQuestions: byOrder([
              ...passage.subQuestions.filter((q) => q.id !== question.id),
              question,
            ]),
          }
        : passage,
    ),
  };
}

export function withoutQuestion(quiz: Quiz, questionId: number): Quiz {
  return {
    ...quiz,
    questions: quiz.questions.filter((q) => q.id !== questionId),
    passages: quiz.passages.map((passage) => ({
      ...passage,
      subQuestions: passage.subQuestions.filter((q) => q.id !== questionId),
    })),
  };
}

export function withPassage(quiz: Quiz, passage: Passage): Quiz {
  const others = quiz.passages.filter((p) => p.id !== passage.id);
  return { ...quiz, passages: byOrder([...others, passage]) };
}

export function withoutPassage(quiz: Quiz, passageId: number): Quiz {
  return {
    ...quiz,
    passages: quiz.passages.filter((passage) => passage.id !== passageId),
  };
}
