/**
 * The organiser's content model, as the REST API returns it. Live-session
 * wire types live beside the code that consumes them, in
 * features/session/session-types.ts.
 */

export type QuestionType = "SINGLE_SELECT" | "MULTI_SELECT";
export type DisplayMode = "LIVE" | "BLIND" | "CODE_DISPLAY";
export type PassageTimerMode = "PER_SUB_QUESTION" | "ENTIRE_PASSAGE";
export type SessionStatus = "LOBBY" | "ACTIVE" | "ENDED";

export interface QuestionOption {
  id: number;
  text: string;
  orderIndex: number;
  pointValue: number;
}

export interface Question {
  id: number;
  passageId: number | null;
  text: string;
  questionType: QuestionType;
  orderIndex: number;
  timeLimitSeconds: number;
  displayModeOverride: DisplayMode | null;
  effectiveDisplayMode: DisplayMode;
  options: QuestionOption[];
}

export interface Passage {
  id: number;
  quizId: number;
  text: string;
  orderIndex: number;
  timerMode: PassageTimerMode;
  timeLimitSeconds: number | null;
  subQuestions: Question[];
}

export interface Quiz {
  id: number;
  title: string;
  orderIndex: number;
  displayMode: DisplayMode;
  questions: Question[];
  passages: Passage[];
}

export interface QuizSummary {
  id: number;
  title: string;
  orderIndex: number;
}

export interface EventSummary {
  id: number;
  title: string;
  description: string | null;
  createdAt: string;
  quizzes: QuizSummary[];
}

/** One run of a quiz, as the quiz editor lists them. */
export interface SessionSummary {
  id: number;
  status: SessionStatus;
  startedAt: string | null;
  endedAt: string | null;
  participantCount: number;
}
