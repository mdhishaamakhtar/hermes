/**
 * A player's view of a live session, as a reducer: the authority on what a
 * player currently sees. REST rejoin snapshots and STOMP messages arrive as
 * actions; answer syncing lives in the hook.
 */
import type { DisplayMode, QuestionType, SessionStatus } from "@/lib/types";
import { byOrderIndex } from "@/lib/options";
import {
  emptyStats,
  IDLE_COUNTDOWN,
  numberKeyed,
  scoringOptionIds,
  startCountdown,
  statsFromSnapshot,
  tickCountdown,
  type Countdown,
} from "../session-state";
import type {
  AnswerRevealMsg,
  AnswerUpdateMsg,
  LeaderboardEntry,
  OptionInfo,
  PassageDisplayedMsg,
  QuestionDisplayedMsg,
  QuestionLifecycle,
  QuestionStats,
  RejoinQuestion,
  RejoinResponse,
} from "../session-types";
import type { StagePassage } from "../host/host-state";

export interface PlayQuestion {
  id: number;
  /** Position in the quiz, as the host's screen shows it. */
  number: number;
  text: string;
  questionType: QuestionType;
  options: OptionInfo[];
  selected: number[];
  lockedIn: boolean;
  stats: QuestionStats;
}

export type SyncStatus = "idle" | "saving" | "retrying" | "error";

export interface PlayState {
  hydrated: boolean;
  /** The server does not know this player in this session any more. */
  missing: boolean;
  status: SessionStatus;
  lifecycle: QuestionLifecycle;
  title: string;
  participantId: number | null;
  participantCount: number;
  questions: PlayQuestion[];
  passage: StagePassage | null;
  totalQuestions: number;
  displayMode: DisplayMode;
  countdown: Countdown;
  leaderboard: LeaderboardEntry[];
  sync: { status: SyncStatus; message: string };
}

export type PlayAction =
  | {
      type: "REJOINED";
      response: RejoinResponse;
      /**
       * Questions whose pick or lock the server may not have yet; they keep
       * what the player has on screen.
       */
      keep?: number[];
    }
  | { type: "MISSING" }
  | { type: "QUESTION_DISPLAYED"; message: QuestionDisplayedMsg }
  | { type: "PASSAGE_DISPLAYED"; message: PassageDisplayedMsg }
  | { type: "TIMER_START"; seconds: number }
  | { type: "TIMER_TICK" }
  | { type: "FROZEN"; questionId: number | null }
  | {
      type: "REVIEWED";
      questionId: number;
      correctOptionIds: number[];
      optionPoints: Record<number, number>;
      correction: boolean;
    }
  | { type: "ANSWERS"; message: AnswerUpdateMsg | AnswerRevealMsg }
  | {
      type: "LEADERBOARD";
      leaderboard: LeaderboardEntry[];
      totalParticipants: number;
    }
  | { type: "PARTICIPANTS"; count: number }
  | { type: "ENDED" }
  | { type: "SYNC"; status: SyncStatus; message?: string }
  | { type: "SELECT"; questionId: number; selected: number[] }
  | { type: "LOCKED"; questionId: number; lockedIn: boolean };

export const initialPlayState: PlayState = {
  hydrated: false,
  missing: false,
  status: "LOBBY",
  lifecycle: "DISPLAYED",
  title: "",
  participantId: null,
  participantCount: 0,
  questions: [],
  passage: null,
  totalQuestions: 0,
  displayMode: "LIVE",
  countdown: IDLE_COUNTDOWN,
  leaderboard: [],
  sync: { status: "idle", message: "" },
};

function fresh(
  id: number,
  number: number,
  text: string,
  questionType: QuestionType,
  options: OptionInfo[],
): PlayQuestion {
  return {
    id,
    number,
    text,
    questionType,
    options: byOrderIndex(options),
    selected: [],
    lockedIn: false,
    stats: emptyStats(),
  };
}

function fromRejoin(
  question: RejoinQuestion,
  number: number,
  stats: Record<number, QuestionStats>,
): PlayQuestion {
  return {
    ...fresh(
      question.id,
      number,
      question.text,
      question.questionType,
      question.options,
    ),
    selected: question.selectedOptionIds.map(Number),
    lockedIn: question.lockedIn,
    stats: stats[question.id] ?? emptyStats(),
  };
}

/** The snapshot's questions, with the player's unconfirmed picks kept. */
function withKept(
  snapshot: PlayQuestion[],
  current: PlayQuestion[],
  keep: number[] = [],
): PlayQuestion[] {
  if (keep.length === 0) return snapshot;
  const mine = new Map(
    current
      .filter((question) => keep.includes(question.id))
      .map((question) => [question.id, question]),
  );
  return snapshot.map((question) => {
    const local = mine.get(question.id);
    return local
      ? {
          ...question,
          selected: local.selected,
          lockedIn: question.lockedIn || local.lockedIn,
        }
      : question;
  });
}

function updateQuestion(
  questions: PlayQuestion[],
  questionId: number,
  change: (question: PlayQuestion) => PlayQuestion,
) {
  return questions.map((question) =>
    question.id === questionId ? change(question) : question,
  );
}

export function playReducer(state: PlayState, action: PlayAction): PlayState {
  switch (action.type) {
    case "REJOINED": {
      const { response } = action;
      const block = response.currentPassage;
      const single = response.currentQuestion;
      const stats = statsFromSnapshot(response.questionStatsById);
      const lifecycle = response.questionLifecycle ?? "DISPLAYED";
      const left = response.timeLeftSeconds;
      const limit =
        (block ? block.timeLimitSeconds : single?.timeLimitSeconds) ?? 0;
      return {
        ...state,
        hydrated: true,
        missing: false,
        status: response.status,
        lifecycle,
        title: response.sessionTitle,
        participantId: response.participantId,
        participantCount: response.participantCount,
        questions: withKept(
          block
            ? block.subQuestions.map((question, index) =>
                fromRejoin(question, block.questionIndex + index, stats),
              )
            : single
              ? [fromRejoin(single, single.orderIndex, stats)]
              : [],
          state.questions,
          action.keep,
        ),
        passage: block
          ? { id: block.id, text: block.text, timerMode: block.timerMode }
          : (single?.passage ?? null),
        totalQuestions:
          block?.totalQuestions ??
          single?.totalQuestions ??
          state.totalQuestions,
        displayMode:
          block?.effectiveDisplayMode ??
          single?.effectiveDisplayMode ??
          state.displayMode,
        countdown:
          lifecycle === "TIMED" && left != null
            ? startCountdown(state.countdown, left, limit || left)
            : { ...IDLE_COUNTDOWN, run: state.countdown.run },
        leaderboard: response.leaderboard,
      };
    }

    case "MISSING":
      return { ...state, hydrated: true, missing: true };

    case "QUESTION_DISPLAYED": {
      const message = action.message;
      return {
        ...state,
        status: "ACTIVE",
        lifecycle: "DISPLAYED",
        questions: [
          fresh(
            message.questionId,
            message.questionIndex,
            message.text,
            message.questionType,
            message.options,
          ),
        ],
        passage: message.passage
          ? { ...message.passage, timerMode: "PER_SUB_QUESTION" }
          : null,
        totalQuestions: message.totalQuestions,
        displayMode: message.effectiveDisplayMode,
        countdown: { ...IDLE_COUNTDOWN, run: state.countdown.run },
        sync: { status: "idle", message: "" },
      };
    }

    case "PASSAGE_DISPLAYED": {
      const message = action.message;
      return {
        ...state,
        status: "ACTIVE",
        lifecycle: "DISPLAYED",
        questions: message.subQuestions.map((question, index) =>
          fresh(
            question.questionId,
            message.questionIndex + index,
            question.text,
            question.questionType,
            question.options,
          ),
        ),
        passage: {
          id: message.passageId,
          text: message.passageText,
          timerMode: "ENTIRE_PASSAGE",
        },
        totalQuestions: message.totalQuestions,
        displayMode: message.effectiveDisplayMode,
        countdown: { ...IDLE_COUNTDOWN, run: state.countdown.run },
        sync: { status: "idle", message: "" },
      };
    }

    case "TIMER_START":
      return {
        ...state,
        status: "ACTIVE",
        lifecycle: "TIMED",
        countdown: startCountdown(
          state.countdown,
          action.seconds,
          action.seconds,
        ),
      };

    case "TIMER_TICK":
      return state.countdown.left > 0
        ? { ...state, countdown: tickCountdown(state.countdown) }
        : state;

    case "FROZEN":
      return {
        ...state,
        lifecycle: "FROZEN",
        countdown: { ...state.countdown, left: 0 },
        // A frozen question takes no more answers: lock it in as it stands.
        questions: state.questions.map((question) =>
          action.questionId === null || question.id === action.questionId
            ? { ...question, lockedIn: true }
            : question,
        ),
      };

    case "REVIEWED":
      return {
        ...state,
        lifecycle: action.correction ? state.lifecycle : "REVIEWING",
        questions: updateQuestion(state.questions, action.questionId, (q) => ({
          ...q,
          lockedIn: true,
          stats: {
            ...q.stats,
            correctOptionIds: scoringOptionIds(
              action.optionPoints,
              action.correctOptionIds,
            ),
            optionPoints: action.optionPoints,
            reviewed: true,
          },
        })),
      };

    case "ANSWERS": {
      const message = action.message;
      return {
        ...state,
        questions: updateQuestion(state.questions, message.questionId, (q) => ({
          ...q,
          stats: {
            ...q.stats,
            counts: numberKeyed(message.counts),
            totalAnswered: message.totalAnswered,
            totalParticipants: message.totalParticipants,
            ...(message.event === "ANSWER_UPDATE"
              ? { totalLockedIn: message.totalLockedIn }
              : { revealed: true }),
          },
        })),
      };
    }

    case "LEADERBOARD":
      return {
        ...state,
        leaderboard: action.leaderboard,
        participantCount: action.totalParticipants,
      };

    case "PARTICIPANTS":
      return { ...state, participantCount: action.count };

    case "ENDED":
      return { ...state, status: "ENDED" };

    case "SYNC":
      return {
        ...state,
        sync: { status: action.status, message: action.message ?? "" },
      };

    case "SELECT":
      return {
        ...state,
        questions: updateQuestion(state.questions, action.questionId, (q) => ({
          ...q,
          selected: action.selected,
        })),
      };

    case "LOCKED":
      return {
        ...state,
        questions: updateQuestion(state.questions, action.questionId, (q) => ({
          ...q,
          lockedIn: action.lockedIn,
        })),
      };
  }
}
