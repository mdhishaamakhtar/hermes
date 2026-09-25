/**
 * The live-session contract: REST snapshots and STOMP messages exactly as the
 * backend sends them (dto/session/*, dto/ws/WsPayloads.java). Edit these in
 * step with the server, never to suit a view.
 *
 * Topics:
 *   session.{id}.question   lifecycle events; also PARTICIPANT_JOINED,
 *                           ANSWER_UPDATE and ANSWER_REVEAL fanned out for
 *                           players, who cannot subscribe to analytics
 *   session.{id}.analytics  organiser only: counts, leaderboard, final board
 *   /user/queue/answers     a player's own answer acknowledgements
 *
 * JSON object keys always arrive as strings; session-state.ts converts the
 * id-keyed maps to numbers on the way in.
 */
import type {
  DisplayMode,
  PassageTimerMode,
  QuestionType,
  SessionStatus,
} from "@/lib/types";

export type QuestionLifecycle = "DISPLAYED" | "TIMED" | "FROZEN" | "REVIEWING";

export interface OptionInfo {
  id: number;
  text: string;
  orderIndex: number;
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

export interface LeaderboardEntry {
  rank: number;
  participantId: number;
  displayName: string;
  score: number;
}

/* ── REST: organiser ──────────────────────────────────────────────────────── */

export interface HostSyncQuestion {
  id: number;
  text: string;
  questionType: QuestionType;
  orderIndex: number;
  totalQuestions: number;
  timeLimitSeconds: number;
  effectiveDisplayMode: DisplayMode;
  passage: { id: number; text: string } | null;
  options: OptionInfo[];
}

export interface HostSessionSync {
  sessionId: number;
  status: SessionStatus;
  questionLifecycle: QuestionLifecycle | null;
  joinCode: string;
  participantCount: number;
  currentQuestion: HostSyncQuestion | null;
  currentPassage: {
    id: number;
    text: string;
    timerMode: PassageTimerMode;
    questionIndex: number;
    totalQuestions: number;
    timeLimitSeconds: number | null;
    effectiveDisplayMode: DisplayMode;
    subQuestions: HostSyncQuestion[];
  } | null;
  questionStatsById: Record<string, QuestionStats>;
  leaderboard: LeaderboardEntry[];
  timeLeftSeconds: number | null;
}

export interface LobbySnapshot {
  status: SessionStatus;
  participantCount: number;
  joinCode: string;
}

/* ── REST: player ─────────────────────────────────────────────────────────── */

export interface RejoinQuestion {
  id: number;
  text: string;
  orderIndex: number;
  timeLimitSeconds: number;
  questionType: QuestionType;
  options: OptionInfo[];
  selectedOptionIds: number[];
  lockedIn: boolean;
}

export interface RejoinResponse {
  participantId: number;
  sessionId: number;
  status: SessionStatus;
  questionLifecycle: QuestionLifecycle | null;
  sessionTitle: string;
  participantCount: number;
  currentQuestion:
    | (RejoinQuestion & {
        totalQuestions: number;
        effectiveDisplayMode: DisplayMode;
        passage: {
          id: number;
          text: string;
          timerMode: PassageTimerMode;
        } | null;
      })
    | null;
  currentPassage: {
    id: number;
    text: string;
    timerMode: PassageTimerMode;
    questionIndex: number;
    totalQuestions: number;
    timeLimitSeconds: number | null;
    effectiveDisplayMode: DisplayMode;
    subQuestions: RejoinQuestion[];
  } | null;
  questionStatsById: Record<string, QuestionStats>;
  leaderboard: LeaderboardEntry[];
  timeLeftSeconds: number | null;
}

export interface JoinResponse {
  participantId: number;
  rejoinToken: string;
  sessionId: number;
}

/* ── REST: results ────────────────────────────────────────────────────────── */

export interface ResultOption extends OptionInfo {
  isCorrect: boolean;
  count: number;
  pointValue: number;
}

export interface QuestionResult {
  id: number;
  text: string;
  orderIndex: number;
  timeLimitSeconds: number;
  passageId: number | null;
  passageText: string | null;
  options: ResultOption[];
  totalAnswers: number;
}

export interface SessionResults {
  sessionId: number;
  quizId: number;
  eventId: number;
  quizTitle: string;
  startedAt: string | null;
  endedAt: string | null;
  participantCount: number;
  leaderboard: LeaderboardEntry[];
  questions: QuestionResult[];
}

export interface MyQuestionResult {
  questionId: number;
  questionText: string;
  orderIndex: number;
  questionType: QuestionType;
  passageId: number | null;
  passageText: string | null;
  selectedOptionIds: number[];
  correctOptionIds: number[];
  options: Array<OptionInfo & { isCorrect: boolean; pointValue: number }>;
  isCorrect: boolean;
  pointsEarned: number;
}

export interface MyResults {
  participantId: number;
  displayName: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  rank: number;
  totalParticipants: number;
  questions: MyQuestionResult[];
}

/* ── STOMP ────────────────────────────────────────────────────────────────── */

/** Carries no time limit: that arrives with TIMER_START. */
export interface QuestionDisplayedMsg {
  event: "QUESTION_DISPLAYED";
  questionId: number;
  text: string;
  questionType: QuestionType;
  options: OptionInfo[];
  questionIndex: number;
  totalQuestions: number;
  passage: { id: number; text: string } | null;
  effectiveDisplayMode: DisplayMode;
}

/** An ENTIRE_PASSAGE block: every sub-question shown and timed together. */
export interface PassageDisplayedMsg {
  event: "PASSAGE_DISPLAYED";
  passageId: number;
  passageText: string;
  timeLimitSeconds: number | null;
  subQuestions: Array<{
    questionId: number;
    text: string;
    questionType: QuestionType;
    options: OptionInfo[];
  }>;
  questionIndex: number;
  totalQuestions: number;
  effectiveDisplayMode: DisplayMode;
}

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

/** Grading landed, or the organiser corrected it afterwards. */
export interface QuestionReviewedMsg {
  event: "QUESTION_REVIEWED" | "SCORING_CORRECTED";
  questionId: number;
  correctOptionIds: number[];
  optionPoints: Record<string, number>;
}

/** The full standings, ranked, sent to players after each review. */
export interface ParticipantLeaderboardMsg {
  event: "PARTICIPANT_LEADERBOARD";
  leaderboard: LeaderboardEntry[];
  totalParticipants: number;
}

export interface ParticipantJoinedMsg {
  event: "PARTICIPANT_JOINED";
  count: number;
}

/** In BLIND mode `counts` arrives empty; CODE_DISPLAY sends no updates. */
export interface AnswerUpdateMsg {
  event: "ANSWER_UPDATE";
  questionId: number;
  counts: Record<string, number>;
  totalAnswered: number;
  totalParticipants: number;
  totalLockedIn: number;
}

/** The distribution a BLIND or CODE_DISPLAY question withheld, after grading. */
export interface AnswerRevealMsg {
  event: "ANSWER_REVEAL";
  questionId: number;
  counts: Record<string, number>;
  totalAnswered: number;
  totalParticipants: number;
}

export interface LeaderboardUpdateMsg {
  event: "LEADERBOARD_UPDATE";
  leaderboard: LeaderboardEntry[];
}

/** Bare on the question topic; with the final board on analytics. */
export interface SessionEndMsg {
  event: "SESSION_END";
  leaderboard?: LeaderboardEntry[];
  totalParticipants?: number;
}

export type SessionMessage =
  | QuestionDisplayedMsg
  | PassageDisplayedMsg
  | TimerStartMsg
  | QuestionFrozenMsg
  | PassageFrozenMsg
  | QuestionReviewedMsg
  | ParticipantLeaderboardMsg
  | ParticipantJoinedMsg
  | AnswerUpdateMsg
  | AnswerRevealMsg
  | LeaderboardUpdateMsg
  | SessionEndMsg;

export type AnswerAckMsg =
  | {
      event: "ANSWER_ACCEPTED";
      clientRequestId: string;
      questionId: number;
      lockedIn: boolean;
    }
  | {
      event: "ANSWER_REJECTED";
      clientRequestId: string;
      questionId: number;
      code: string;
      message: string;
      lockedIn: boolean;
    };
