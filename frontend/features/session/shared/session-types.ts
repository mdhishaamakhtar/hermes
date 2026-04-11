/**
 * Types shared between host and participant session contexts.
 */

/** The in-question lifecycle state broadcast to both host and participants. */
export type QuestionLifecycle = "DISPLAYED" | "TIMED" | "FROZEN" | "REVIEWING";

/** The top-level session phase shared by host and participant views. */
export type SessionPhase = "LOBBY" | "ACTIVE" | "ENDED";

/** WebSocket message types that are structurally identical for host and participant. */

export interface TimerStartMsg {
  event: "TIMER_START";
  questionId: number | null;
  passageId: number | null;
  timeLimitSeconds: number;
}

export interface QuestionFrozenMsg {
  event: "QUESTION_FROZEN";
  questionId: number;
}

export interface PassageFrozenMsg {
  event: "PASSAGE_FROZEN";
  passageId: number;
  subQuestionIds: number[];
}

export interface QuestionReviewedMsg {
  event: "QUESTION_REVIEWED";
  questionId: number;
  correctOptionIds: number[];
  optionPoints: Record<number, number>;
}

export interface ScoringCorrectedMsg {
  event: "SCORING_CORRECTED";
  questionId: number;
  correctOptionIds: number[];
  optionPoints: Record<number, number>;
}
