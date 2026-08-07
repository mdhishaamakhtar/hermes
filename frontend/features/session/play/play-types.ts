/**
 * Wire and state types for the participant session.
 *
 * Split out of usePlaySession.ts unchanged. The message interfaces mirror what
 * the server publishes over STOMP, so they are edited in step with the backend
 * rather than to suit the UI.
 */
import type {
  DisplayMode,
  LeaderboardEntry,
  PassageTimerMode,
  QuestionType,
  ParticipantLeaderboardEntry,
  RejoinResponse,
} from "@/lib/types";
import type {
  QuestionLifecycle,
  TimerStartMsg,
  QuestionFrozenMsg,
  PassageFrozenMsg,
  QuestionReviewedMsg,
  ScoringCorrectedMsg,
} from "@/features/session/shared/session-types";

export type SessionState = "LOBBY" | "ACTIVE" | "ENDED";

// Local aliases kept for the QuestionEventMsg union below
type SessionTimerStartMsg = TimerStartMsg;
type SessionQuestionFrozenMsg = QuestionFrozenMsg;
type SessionPassageFrozenMsg = PassageFrozenMsg;
type SessionQuestionReviewedMsg = QuestionReviewedMsg;
type SessionScoringCorrectedMsg = ScoringCorrectedMsg;

export interface ParticipantOption {
  id: number;
  text: string;
  orderIndex: number;
}

export interface ParticipantQuestion {
  id: number;
  text: string;
  questionIndex: number;
  totalQuestions: number;
  timeLimitSeconds: number;
  questionType: QuestionType;
  effectiveDisplayMode: DisplayMode;
  options: ParticipantOption[];
  selectedOptionIds: number[];
  lockedIn: boolean;
  counts: Record<number, number>;
  totalAnswered: number;
  totalLockedIn: number;
  correctOptionIds: number[];
  passageId: number | null;
  optionPoints: Record<number, number>;
  reviewed: boolean;
  revealed: boolean;
  reviewedAt: string | null;
}

export interface SubQuestion {
  questionId: number;
  text: string;
  questionType: QuestionType;
  options: ParticipantOption[];
}

export interface ParticipantPassage {
  id: number;
  text: string;
  timerMode: PassageTimerMode;
  questionIndex: number;
  totalQuestions: number;
  timeLimitSeconds: number | null;
  effectiveDisplayMode: DisplayMode;
}

export interface SessionQuestionDisplayedMsg {
  event: "QUESTION_DISPLAYED";
  questionId: number;
  text: string;
  questionType: QuestionType;
  options: Array<{ id: number; text: string; orderIndex: number }>;
  timeLimitSeconds: number;
  questionIndex: number;
  totalQuestions: number;
  passage: { id: number; text: string } | null;
  effectiveDisplayMode: DisplayMode;
}

export interface SessionPassageDisplayedMsg {
  event: "PASSAGE_DISPLAYED";
  passageId: number;
  passageText: string;
  timeLimitSeconds: number | null;
  subQuestions: Array<{
    questionId: number;
    text: string;
    questionType: QuestionType;
    options: Array<{ id: number; text: string; orderIndex: number }>;
  }>;
  questionIndex: number;
  totalQuestions: number;
  effectiveDisplayMode: DisplayMode;
}

export interface SessionAnswerUpdateMsg {
  event: "ANSWER_UPDATE";
  questionId: number;
  counts: Record<string, number>;
  totalAnswered: number;
  totalParticipants: number;
  totalLockedIn: number;
}

export interface SessionAnswerRevealMsg {
  event: "ANSWER_REVEAL";
  questionId: number;
  counts: Record<string, number>;
  totalAnswered: number;
  totalParticipants: number;
}

export interface SessionParticipantLeaderboardMsg {
  event: "PARTICIPANT_LEADERBOARD";
  leaderboard: ParticipantLeaderboardEntry[];
  totalParticipants: number;
}

export interface ParticipantJoinedMsg {
  event: "PARTICIPANT_JOINED";
  count: number;
}

export interface SessionLeaderboardUpdateMsg {
  event: "LEADERBOARD_UPDATE";
  leaderboard: LeaderboardEntry[];
}

export interface SessionAnswerAcceptedMsg {
  event: "ANSWER_ACCEPTED";
  clientRequestId: string;
  questionId: number;
  lockedIn: boolean;
}

export interface SessionAnswerRejectedMsg {
  event: "ANSWER_REJECTED";
  clientRequestId: string;
  questionId: number;
  code: string;
  message: string;
  lockedIn: boolean;
}

export interface SessionEndMsg {
  event: "SESSION_END";
  leaderboard?: LeaderboardEntry[];
  totalParticipants?: number;
}

export type QuestionEventMsg =
  | SessionQuestionDisplayedMsg
  | SessionPassageDisplayedMsg
  | SessionTimerStartMsg
  | SessionQuestionFrozenMsg
  | SessionPassageFrozenMsg
  | SessionQuestionReviewedMsg
  | SessionScoringCorrectedMsg
  | SessionParticipantLeaderboardMsg
  | SessionEndMsg
  | ParticipantJoinedMsg;

export type AnalyticsEventMsg =
  | SessionAnswerUpdateMsg
  | SessionAnswerRevealMsg
  | SessionLeaderboardUpdateMsg
  | SessionEndMsg;

export type AnswerAckMsg = SessionAnswerAcceptedMsg | SessionAnswerRejectedMsg;

export interface PlaySessionState {
  sessionState: SessionState;
  questionLifecycle: QuestionLifecycle;
  sessionTitle: string;
  participantCount: number;
  participantId: number | null;
  questions: ParticipantQuestion[];
  passage: ParticipantPassage | null;
  timeLeft: number | null;
  /** Set from TIMER_START; used for the progress bar when passage/questions still have 0/null limits. */
  liveTimerLimitSeconds: number | null;
  leaderboard: LeaderboardEntry[];
  participantLeaderboard: ParticipantLeaderboardEntry[];
  finalLeaderboard: LeaderboardEntry[];
  hydrated: boolean;
  syncStatus: "idle" | "saving" | "retrying" | "error";
  syncMessage: string;
}

export type PlaySessionAction =
  | { type: "REJOIN_LOADED"; response: RejoinResponse }
  | { type: "HYDRATED" }
  | { type: "QUESTION_DISPLAYED"; message: SessionQuestionDisplayedMsg }
  | { type: "PASSAGE_DISPLAYED"; message: SessionPassageDisplayedMsg }
  | { type: "SESSION_END"; leaderboard?: LeaderboardEntry[] }
  | { type: "TIMER_START"; timeLimitSeconds: number }
  | {
      type: "QUESTION_FROZEN";
      message: SessionQuestionFrozenMsg | SessionPassageFrozenMsg;
    }
  | {
      type: "QUESTION_REVIEWED";
      questionId: number;
      correctOptionIds: number[];
      optionPoints: Record<number, number>;
    }
  | {
      type: "PARTICIPANT_LEADERBOARD";
      leaderboard: ParticipantLeaderboardEntry[];
      totalParticipants: number;
    }
  | { type: "PARTICIPANT_JOINED"; count: number }
  | { type: "ANSWER_UPDATE"; message: SessionAnswerUpdateMsg }
  | { type: "ANSWER_REVEAL"; message: SessionAnswerRevealMsg }
  | { type: "TIMER_TICK" }
  | {
      type: "SYNC_STATUS";
      status: PlaySessionState["syncStatus"];
      message: string;
    }
  | { type: "SET_SELECTION"; questionId: number; selectedOptionIds: number[] }
  | { type: "LOCKED_IN"; questionId: number }
  | { type: "LOCK_IN_ROLLBACK"; questionId: number };
export type { QuestionLifecycle };
