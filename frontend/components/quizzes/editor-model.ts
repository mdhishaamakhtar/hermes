import type {
  DisplayMode,
  PassageTimerMode,
  Question,
  QuestionOptionInput,
  QuestionType,
} from "@/lib/types";

export interface QuestionDraftOption extends Omit<
  QuestionOptionInput,
  "pointValue"
> {
  pointValue: number | string;
}

export interface QuestionDraft {
  text: string;
  orderIndex: number | string;
  timeLimitSeconds: number | string;
  questionType: QuestionType;
  displayModeOverride: DisplayMode | null;
  options: QuestionDraftOption[];
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
  pointValue: number | string = 0,
  orderIndex?: number,
): QuestionDraftOption {
  return { text, pointValue, orderIndex };
}

export function createDefaultOptions(
  questionType: QuestionType,
): QuestionDraftOption[] {
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

export function isPositiveOption(pointValue: number | string): boolean {
  const parsed =
    typeof pointValue === "string" ? parseInt(pointValue, 10) : pointValue;
  return !isNaN(parsed) && parsed > 0;
}

export function isNegativeOption(pointValue: number | string): boolean {
  const parsed =
    typeof pointValue === "string" ? parseInt(pointValue, 10) : pointValue;
  return !isNaN(parsed) && parsed < 0;
}

export function normalizeOptionsForQuestionType(
  questionType: QuestionType,
  options: QuestionDraftOption[],
): QuestionDraftOption[] {
  if (!options.length) {
    return createDefaultOptions(questionType);
  }

  if (questionType === "MULTI_SELECT") {
    return options.map((option, index) => ({ ...option, orderIndex: index }));
  }

  // For SINGLE_SELECT, identify which option should be the lone positive one
  const firstPositiveIndex = options.findIndex((opt) =>
    isPositiveOption(opt.pointValue),
  );
  const targetIndex = firstPositiveIndex === -1 ? 0 : firstPositiveIndex;

  return options.map((option, index) => {
    const rawVal =
      typeof option.pointValue === "string"
        ? parseInt(option.pointValue, 10)
        : option.pointValue;
    const pVal = isNaN(rawVal) ? 0 : rawVal;

    if (index === targetIndex) {
      return {
        ...option,
        pointValue: pVal > 0 ? option.pointValue : 10,
        orderIndex: index,
      };
    }

    return {
      ...option,
      pointValue: Math.min(pVal, 0),
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

  const timeVal =
    typeof draft.timeLimitSeconds === "string"
      ? parseInt(draft.timeLimitSeconds, 10)
      : draft.timeLimitSeconds;

  if (requirePositiveTimer && (isNaN(timeVal) || timeVal < 5)) {
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
