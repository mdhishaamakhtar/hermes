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
  /** No right answer: players vote and nobody scores. */
  poll: boolean;
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
  eventId: number;
  eventTitle: string;
  /** The quiz sits in no event the organiser chose. */
  defaultEvent: boolean;
  title: string;
  orderIndex: number;
  displayMode: DisplayMode;
  /** Faster right answers score more. */
  speedScoring: boolean;
  questions: Question[];
  passages: Passage[];
}

export interface QuizSummary {
  id: number;
  title: string;
  orderIndex: number;
}

/** A quiz as the quiz list shows it, whichever event it sits in. */
export interface QuizListItem {
  id: number;
  title: string;
  eventId: number;
  eventTitle: string;
  /** The quiz sits in no event the organiser chose, so none is named. */
  defaultEvent: boolean;
  questionCount: number;
  createdAt: string;
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
  /** The host's own run-through; listed only while it runs. */
  rehearsal: boolean;
}
