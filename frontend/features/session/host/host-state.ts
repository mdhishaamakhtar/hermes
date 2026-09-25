/**
 * The organiser's view of a live session, as a reducer. Every REST snapshot
 * and STOMP message the host receives becomes an action here; the hook owns
 * the wiring, this file owns what the host is looking at.
 */
import type {
  DisplayMode,
  PassageTimerMode,
  QuestionType,
  SessionStatus,
} from "@/lib/types";
import { byOrderIndex } from "@/lib/options";
import {
  emptyStats,
  IDLE_COUNTDOWN,
  numberKeyed,
  patchStats,
  scoringOptionIds,
  startCountdown,
  statsFromSnapshot,
  tickCountdown,
  type Countdown,
} from "../session-state";
import type {
  AnswerRevealMsg,
  AnswerUpdateMsg,
  HostSessionSync,
  HostSyncQuestion,
  LeaderboardEntry,
  LobbySnapshot,
  OptionInfo,
  PassageDisplayedMsg,
  QuestionDisplayedMsg,
  QuestionLifecycle,
  QuestionStats,
  SessionResults,
} from "../session-types";

/** A question on stage, numbered by its position in the quiz. */
export interface StageQuestion {
  id: number;
  number: number;
  text: string;
  questionType: QuestionType;
  options: OptionInfo[];
}

export interface StagePassage {
  id: number;
  text: string;
  timerMode: PassageTimerMode;
}

export interface HostState {
  hydrated: boolean;
  status: SessionStatus;
  lifecycle: QuestionLifecycle;
  joinCode: string;
  participantCount: number;
  /** One question, or every question of an all-together passage. */
  questions: StageQuestion[];
  passage: StagePassage | null;
  totalQuestions: number;
  displayMode: DisplayMode;
  countdown: Countdown;
  stats: Record<number, QuestionStats>;
  leaderboard: LeaderboardEntry[];
  results: SessionResults | null;
}

export type HostAction =
  | { type: "SYNC"; sync: HostSessionSync }
  | { type: "LOBBY"; lobby: LobbySnapshot }
  | { type: "STATUS"; status: SessionStatus }
  | { type: "HYDRATED" }
  | { type: "RESULTS"; results: SessionResults }
  | { type: "QUESTION_DISPLAYED"; message: QuestionDisplayedMsg }
  | { type: "PASSAGE_DISPLAYED"; message: PassageDisplayedMsg }
  | { type: "TIMER_START"; seconds: number }
  | { type: "TIMER_TICK" }
  | { type: "FROZEN" }
  | {
      type: "REVIEWED";
      questionId: number;
      correctOptionIds: number[];
      optionPoints: Record<number, number>;
      /** A correction after grading: scores change, the phase does not. */
      correction: boolean;
    }
  | { type: "ANSWERS"; message: AnswerUpdateMsg | AnswerRevealMsg }
  | { type: "LEADERBOARD"; leaderboard: LeaderboardEntry[] }
  | { type: "PARTICIPANTS"; count: number }
  | { type: "STARTED" }
  | { type: "ENDED"; leaderboard?: LeaderboardEntry[] };

export function initialHostState(joinCode: string): HostState {
  return {
    hydrated: false,
    status: "LOBBY",
    lifecycle: "DISPLAYED",
    joinCode,
    participantCount: 0,
    questions: [],
    passage: null,
    totalQuestions: 0,
    displayMode: "LIVE",
    countdown: IDLE_COUNTDOWN,
    stats: {},
    leaderboard: [],
    results: null,
  };
}

function toStage(question: HostSyncQuestion): StageQuestion {
  return {
    id: question.id,
    number: question.orderIndex,
    text: question.text,
    questionType: question.questionType,
    options: byOrderIndex(question.options),
  };
}

/** Fresh stats for questions arriving on stage, keeping any already known. */
function withEmptyStats(
  stats: Record<number, QuestionStats>,
  questions: StageQuestion[],
  reset: boolean,
) {
  const next = { ...stats };
  for (const question of questions) {
    if (reset || !next[question.id]) next[question.id] = emptyStats();
  }
  return next;
}

export function hostReducer(state: HostState, action: HostAction): HostState {
  switch (action.type) {
    case "SYNC": {
      const { sync } = action;
      const block = sync.currentPassage;
      const single = sync.currentQuestion;
      const lifecycle = sync.questionLifecycle ?? state.lifecycle;
      const limit =
        (block ? block.timeLimitSeconds : single?.timeLimitSeconds) ?? 0;
      return {
        ...state,
        hydrated: true,
        status: sync.status,
        lifecycle,
        joinCode: sync.joinCode || state.joinCode,
        participantCount: sync.participantCount,
        questions: block
          ? block.subQuestions.map(toStage)
          : single
            ? [toStage(single)]
            : [],
        passage: block
          ? { id: block.id, text: block.text, timerMode: block.timerMode }
          : single?.passage
            ? { ...single.passage, timerMode: "PER_SUB_QUESTION" }
            : null,
        totalQuestions:
          block?.totalQuestions ??
          single?.totalQuestions ??
          state.totalQuestions,
        displayMode:
          block?.effectiveDisplayMode ??
          single?.effectiveDisplayMode ??
          state.displayMode,
        countdown:
          lifecycle === "TIMED"
            ? startCountdown(
                state.countdown,
                sync.timeLeftSeconds ?? 0,
                limit || (sync.timeLeftSeconds ?? 0),
              )
            : { ...IDLE_COUNTDOWN, run: state.countdown.run },
        stats: statsFromSnapshot(sync.questionStatsById),
        leaderboard: sync.leaderboard.length
          ? sync.leaderboard
          : state.leaderboard,
      };
    }

    case "LOBBY":
      return {
        ...state,
        hydrated: true,
        status: action.lobby.status,
        participantCount: action.lobby.participantCount,
        joinCode: action.lobby.joinCode || state.joinCode,
      };

    case "STATUS":
      return { ...state, hydrated: true, status: action.status };

    case "HYDRATED":
      return { ...state, hydrated: true };

    case "RESULTS":
      return {
        ...state,
        results: action.results,
        leaderboard: action.results.leaderboard,
      };

    case "QUESTION_DISPLAYED": {
      const message = action.message;
      const question: StageQuestion = {
        id: message.questionId,
        number: message.questionIndex,
        text: message.text,
        questionType: message.questionType,
        options: byOrderIndex(message.options),
      };
      return {
        ...state,
        status: "ACTIVE",
        lifecycle: "DISPLAYED",
        questions: [question],
        passage: message.passage
          ? { ...message.passage, timerMode: "PER_SUB_QUESTION" }
          : null,
        totalQuestions: message.totalQuestions,
        displayMode: message.effectiveDisplayMode,
        countdown: { ...IDLE_COUNTDOWN, run: state.countdown.run },
        stats: withEmptyStats(state.stats, [question], true),
      };
    }

    case "PASSAGE_DISPLAYED": {
      const message = action.message;
      const questions = message.subQuestions.map((question, index) => ({
        id: question.questionId,
        number: message.questionIndex + index,
        text: question.text,
        questionType: question.questionType,
        options: byOrderIndex(question.options),
      }));
      return {
        ...state,
        status: "ACTIVE",
        lifecycle: "DISPLAYED",
        questions,
        passage: {
          id: message.passageId,
          text: message.passageText,
          timerMode: "ENTIRE_PASSAGE",
        },
        totalQuestions: message.totalQuestions,
        displayMode: message.effectiveDisplayMode,
        countdown: { ...IDLE_COUNTDOWN, run: state.countdown.run },
        stats: withEmptyStats(state.stats, questions, false),
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
      };

    case "REVIEWED":
      return {
        ...state,
        lifecycle: action.correction ? state.lifecycle : "REVIEWING",
        stats: patchStats(state.stats, action.questionId, {
          correctOptionIds: scoringOptionIds(
            action.optionPoints,
            action.correctOptionIds,
          ),
          optionPoints: action.optionPoints,
          reviewed: true,
        }),
      };

    case "ANSWERS": {
      const message = action.message;
      return {
        ...state,
        stats: patchStats(state.stats, message.questionId, {
          counts: numberKeyed(message.counts),
          totalAnswered: message.totalAnswered,
          totalParticipants: message.totalParticipants,
          ...(message.event === "ANSWER_UPDATE"
            ? { totalLockedIn: message.totalLockedIn }
            : { revealed: true }),
        }),
      };
    }

    case "LEADERBOARD":
      return { ...state, leaderboard: action.leaderboard };

    case "PARTICIPANTS":
      return { ...state, participantCount: action.count };

    case "STARTED":
      return { ...state, status: "ACTIVE" };

    case "ENDED":
      return {
        ...state,
        status: "ENDED",
        leaderboard: action.leaderboard ?? state.leaderboard,
      };
  }
}
