/**
 * Wire and state types for the organiser session.
 *
 * Split out of useHostSession.ts unchanged. The message interfaces mirror what
 * the server publishes over STOMP, so they track the backend rather than the UI.
 */
import type {
  DisplayMode,
  HostSessionSync,
  PassageTimerMode,
  SessionResults,
} from "@/lib/types";
import type { SessionLifecycleStatus } from "@/features/session/session-api";
import type { QuestionLifecycle } from "@/features/session/shared/session-types";

export type SessionStatus = SessionLifecycleStatus;
export type { QuestionLifecycle };

export interface ActiveOption {
  id: number;
  text: string;
  orderIndex: number;
}

export interface ActiveQuestion {
  id: number;
  text: string;
  questionType: string;
  orderIndex: number;
  totalQuestions: number;
  timeLimitSeconds: number;
  effectiveDisplayMode: DisplayMode;
  passage: { id: number; text: string } | null;
  options: ActiveOption[];
}

export interface ActivePassage {
  id: number;
  text: string;
  timerMode: PassageTimerMode;
  questionIndex: number;
  totalQuestions: number;
  effectiveDisplayMode: DisplayMode;
  subQuestions: ActiveQuestion[];
}

export interface QuestionStats {
  counts: Record<number, number>;
  totalAnswered: number;
  totalLockedIn: number;
  totalParticipants: number;
  correctOptionIds: number[];
  optionPoints: Record<number, number>;
  revealed: boolean;
  reviewed: boolean;
}

export interface LiveLeaderboardEntry {
  rank: number;
  participantId: number;
  displayName: string;
  score: number;
}

export interface QuestionDisplayedMsg {
  event: "QUESTION_DISPLAYED";
  questionId: number;
  text: string;
  questionType: string;
  options: ActiveOption[];
  timeLimitSeconds: number;
  questionIndex: number;
  totalQuestions: number;
  passage: { id: number; text: string } | null;
  effectiveDisplayMode: DisplayMode;
}

export interface PassageDisplayedMsg {
  event: "PASSAGE_DISPLAYED";
  passageId: number;
  passageText: string;
  subQuestions: Array<{
    questionId: number;
    text: string;
    questionType: string;
    options: ActiveOption[];
  }>;
  questionIndex: number;
  totalQuestions: number;
  effectiveDisplayMode: DisplayMode;
}

export type {
  TimerStartMsg,
  QuestionFrozenMsg,
  PassageFrozenMsg,
  QuestionReviewedMsg,
  ScoringCorrectedMsg,
} from "@/features/session/shared/session-types";

export interface AnswerUpdateMsg {
  event: "ANSWER_UPDATE";
  questionId: number;
  counts: Record<string, number>;
  totalAnswered: number;
  totalParticipants: number;
  totalLockedIn: number;
}

export interface AnswerRevealMsg {
  event: "ANSWER_REVEAL";
  questionId: number;
  counts: Record<string, number>;
  totalAnswered: number;
  totalParticipants: number;
}

export interface LeaderboardUpdateMsg {
  event: "LEADERBOARD_UPDATE";
  leaderboard: LiveLeaderboardEntry[];
}

export interface ParticipantLeaderboardMsg {
  event: "PARTICIPANT_LEADERBOARD";
  top: Array<{ rank: number; displayName: string; score: number }>;
  totalParticipants: number;
}

export interface SessionEndMsg {
  event: "SESSION_END";
  leaderboard?: LiveLeaderboardEntry[];
  totalParticipants?: number;
}

export interface HostSessionState {
  sessionStatus: SessionStatus;
  questionLifecycle: QuestionLifecycle;
  joinCode: string;
  participantCount: number;
  activeQuestion: ActiveQuestion | null;
  activePassage: ActivePassage | null;
  questionIndex: number;
  totalQuestions: number;
  effectiveDisplayMode: DisplayMode;
  timerLimitSeconds: number;
  timeLeft: number;
  questionStatsById: Record<number, QuestionStats>;
  leaderboard: LiveLeaderboardEntry[];
  finalLeaderboard:
    | { rank: number; displayName: string; score: number }[]
    | null;
  sessionResults: SessionResults | null;
  hydrated: boolean;
}

export type HostSessionAction =
  | {
      type: "CONTEXT_LOADED";
      lobby?: {
        status: SessionStatus;
        participantCount: number;
        joinCode: string;
      };
      status?: SessionStatus;
    }
  | { type: "RESULTS_LOADED"; results: SessionResults }
  | { type: "SYNC_LOADED"; sync: HostSessionSync }
  | { type: "QUESTION_DISPLAYED"; message: QuestionDisplayedMsg }
  | { type: "PASSAGE_DISPLAYED"; message: PassageDisplayedMsg }
  | { type: "TIMER_START"; timeLimitSeconds: number }
  | { type: "QUESTION_FROZEN" }
  | {
      type: "QUESTION_REVIEWED";
      questionId: number;
      correctOptionIds: number[];
      optionPoints: Record<number, number>;
    }
  | { type: "ANSWER_UPDATE"; message: AnswerUpdateMsg }
  | { type: "ANSWER_REVEAL"; message: AnswerRevealMsg }
  | { type: "LEADERBOARD_UPDATE"; leaderboard: LiveLeaderboardEntry[] }
  | { type: "SESSION_END"; leaderboard?: LiveLeaderboardEntry[] }
  | { type: "PARTICIPANT_JOINED"; count: number }
  | { type: "SESSION_STARTED" }
  | { type: "TIMER_TICK" }
  | {
      type: "SCORING_CORRECTED_LOCAL";
      questionId: number;
      optionPoints: Record<number, number>;
      correctOptionIds: number[];
    };
