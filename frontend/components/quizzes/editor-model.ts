import type {
  DisplayMode,
  PassageTimerMode,
  Question,
  QuestionOptionInput,
  QuestionType,
} from "@/lib/types";

export interface QuestionDraft {
  text: string;
  orderIndex: number;
  timeLimitSeconds: number;
  questionType: QuestionType;
  displayModeOverride: DisplayMode | null;
  options: QuestionOptionInput[];
}

export const DISPLAY_MODE_OPTIONS: Array<{
  value: DisplayMode;
  label: string;
  description: string;
}> = [
  {
    value: "BLIND",
    label: "Blind",
    description: "Hide answer analytics until the host reveals them.",
  },
  {
    value: "LIVE",
    label: "Live",
    description: "Show live answer distribution while the audience responds.",
  },
  {
    value: "CODE_DISPLAY",
    label: "Code",
    description: "Keep the join code on stage with the question prompt only.",
  },
];

export const QUESTION_TYPE_OPTIONS: Array<{
  value: QuestionType;
  label: string;
  description: string;
}> = [
  {
    value: "SINGLE_SELECT",
    label: "Single-select",
    description: "Exactly one positive-scoring option.",
  },
  {
    value: "MULTI_SELECT",
    label: "Multi-select",
    description: "Multiple positive options allowed.",
  },
];

export const PASSAGE_TIMER_MODE_OPTIONS: Array<{
  value: PassageTimerMode;
  label: string;
  description: string;
}> = [
  {
    value: "PER_SUB_QUESTION",
    label: "Timer per question",
    description: "Each sub-question gets its own countdown.",
  },
  {
    value: "ENTIRE_PASSAGE",
    label: "One timer for all",
    description: "The full passage block runs under one shared timer.",
  },
];

export function createOptionInput(
  text = "",
  pointValue = 0,
  orderIndex?: number,
): QuestionOptionInput {
  return { text, pointValue, orderIndex };
}

export function createDefaultOptions(
  questionType: QuestionType,
): QuestionOptionInput[] {
  if (questionType === "MULTI_SELECT") {
    return [
      createOptionInput("", 10, 0),
      createOptionInput("", 0, 1),
      createOptionInput("", 10, 2),
      createOptionInput("", -5, 3),
    ];
  }

  return [
    createOptionInput("", 10, 0),
    createOptionInput("", 0, 1),
    createOptionInput("", 0, 2),
    createOptionInput("", 0, 3),
  ];
}

export function isPositiveOption(pointValue: number): boolean {
  return pointValue > 0;
}

export function normalizeOptionsForQuestionType(
  questionType: QuestionType,
  options: QuestionOptionInput[],
): QuestionOptionInput[] {
  if (!options.length) {
    return createDefaultOptions(questionType);
  }

  if (questionType === "MULTI_SELECT") {
    return options.map((option, index) => ({ ...option, orderIndex: index }));
  }

  let positiveAssigned = false;

  return options.map((option, index) => {
    if (option.pointValue > 0 && !positiveAssigned) {
      positiveAssigned = true;
      return { ...option, pointValue: 10, orderIndex: index };
    }

    if (!positiveAssigned && index === 0) {
      positiveAssigned = true;
      return { ...option, pointValue: 10, orderIndex: index };
    }

    return {
      ...option,
      pointValue: Math.min(option.pointValue, 0),
      orderIndex: index,
    };
  });
}

export function validateQuestionDraft(
  draft: Pick<
    QuestionDraft,
    "text" | "timeLimitSeconds" | "questionType" | "options"
  >,
  {
    requirePositiveTimer = true,
    minimumOptionCount = 2,
  }: {
    requirePositiveTimer?: boolean;
    minimumOptionCount?: number;
  } = {},
): string | null {
  if (!draft.text.trim()) return "Question text is required.";
  if (requirePositiveTimer && draft.timeLimitSeconds < 5) {
    return "Question time must be at least 5 seconds.";
  }
  if (draft.options.length < minimumOptionCount) {
    return `Questions need at least ${minimumOptionCount} options.`;
  }
  if (draft.options.some((option) => !option.text.trim())) {
    return "Fill in every option label.";
  }

  const positiveCount = draft.options.filter((option) =>
    isPositiveOption(option.pointValue),
  ).length;

  if (draft.questionType === "SINGLE_SELECT" && positiveCount !== 1) {
    return "Single-select questions need exactly one positive-scoring option.";
  }
  if (draft.questionType === "MULTI_SELECT" && positiveCount < 1) {
    return "Multi-select questions need at least one positive-scoring option.";
  }

  return null;
}

export function questionTypeLabel(questionType: QuestionType): string {
  return (
    QUESTION_TYPE_OPTIONS.find((option) => option.value === questionType)
      ?.label ?? questionType
  );
}

export function displayModeLabel(mode: DisplayMode): string {
  return (
    DISPLAY_MODE_OPTIONS.find((option) => option.value === mode)?.label ?? mode
  );
}

export function passageTimerModeLabel(mode: PassageTimerMode): string {
  return (
    PASSAGE_TIMER_MODE_OPTIONS.find((option) => option.value === mode)?.label ??
    mode
  );
}

export function effectiveQuestionTimer(question: Question): string {
  return question.timeLimitSeconds > 0
    ? `${question.timeLimitSeconds}s`
    : "Shared timer";
}

export function createQuestionDraft(
  orderIndex: number,
  questionType: QuestionType = "SINGLE_SELECT",
): QuestionDraft {
  return {
    text: "",
    orderIndex,
    timeLimitSeconds: 30,
    questionType,
    displayModeOverride: null,
    options: createDefaultOptions(questionType),
  };
}
