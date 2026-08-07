/**
 * The participant session reducer.
 *
 * Split out of usePlaySession.ts unchanged — same branches, same order, same
 * merge rules. This is the authority on what a participant currently sees, and
 * every STOMP message ends up here as an action.
 */
import {
  normalizeCounts,
  normalizeIdList,
  normalizePoints,
} from "@/lib/session-utils";
import type {
  ParticipantPassage,
  PlaySessionAction,
  PlaySessionState,
  QuestionLifecycle,
  SessionState,
} from "./play-types";
import {
  applyRejoinStats,
  buildQuestionFromDisplayed,
  buildQuestionFromPassageSubQuestion,
  buildQuestionFromRejoin,
  setQuestionSelection,
  updateQuestion,
} from "./play-questions";

export function initPlaySessionState(
  rejoinToken: string | null,
): PlaySessionState {
  return {
    sessionState: "LOBBY",
    questionLifecycle: "DISPLAYED",
    sessionTitle: "Live Session",
    participantCount: 0,
    participantId: null,
    questions: [],
    passage: null,
    timeLeft: null,
    liveTimerLimitSeconds: null,
    leaderboard: [],
    participantLeaderboard: [],
    finalLeaderboard: [],
    hydrated: rejoinToken === null,
    syncStatus: "idle",
    syncMessage: "",
  };
}

export function playSessionReducer(
  state: PlaySessionState,
  action: PlaySessionAction,
): PlaySessionState {
  switch (action.type) {
    case "REJOIN_LOADED": {
      const data = action.response;
      let passage: ParticipantPassage | null = null;
      let questions = state.questions;
      const questionStatsById = data.questionStatsById ?? {};

      if (data.currentPassage) {
        const currentPassage = data.currentPassage;
        passage = {
          id: currentPassage.id,
          text: currentPassage.text,
          timerMode: currentPassage.timerMode,
          questionIndex: currentPassage.questionIndex,
          totalQuestions: currentPassage.totalQuestions,
          timeLimitSeconds: currentPassage.timeLimitSeconds,
          effectiveDisplayMode: currentPassage.effectiveDisplayMode,
        };
        questions = currentPassage.subQuestions.map((subQuestion) =>
          buildQuestionFromRejoin(
            subQuestion,
            currentPassage.totalQuestions,
            currentPassage.effectiveDisplayMode,
            currentPassage.id,
            currentPassage.timeLimitSeconds ?? subQuestion.timeLimitSeconds,
          ),
        );
      } else if (data.currentQuestion) {
        passage = data.currentQuestion.passage
          ? {
              id: data.currentQuestion.passage.id,
              text: data.currentQuestion.passage.text,
              timerMode: data.currentQuestion.passage.timerMode,
              questionIndex: data.currentQuestion.orderIndex,
              totalQuestions: data.currentQuestion.totalQuestions,
              timeLimitSeconds: data.currentQuestion.timeLimitSeconds,
              effectiveDisplayMode: data.currentQuestion.effectiveDisplayMode,
            }
          : null;
        questions = [
          buildQuestionFromRejoin(
            data.currentQuestion,
            data.currentQuestion.totalQuestions,
            data.currentQuestion.effectiveDisplayMode,
            data.currentQuestion.passage?.id ?? null,
          ),
        ];
      }

      questions = questions.map((question) =>
        applyRejoinStats(question, questionStatsById),
      );

      const questionLifecycle =
        (data.questionLifecycle as QuestionLifecycle) || "DISPLAYED";
      return {
        ...state,
        participantId: data.participantId,
        sessionTitle: data.sessionTitle || "Live Session",
        participantCount: data.participantCount || 0,
        sessionState: (data.status as SessionState) || "LOBBY",
        questionLifecycle,
        timeLeft:
          questionLifecycle === "DISPLAYED"
            ? null
            : (data.timeLeftSeconds ?? null),
        leaderboard: data.leaderboard ?? [],
        participantLeaderboard: data.leaderboard ?? [],
        finalLeaderboard: [],
        passage,
        questions,
        hydrated: true,
        liveTimerLimitSeconds: null,
      };
    }
    case "HYDRATED":
      return { ...state, hydrated: true };
    case "QUESTION_DISPLAYED": {
      const data = action.message;
      return {
        ...state,
        sessionState: "ACTIVE",
        questionLifecycle: "DISPLAYED",
        leaderboard: [],
        participantLeaderboard: [],
        finalLeaderboard: [],
        syncStatus: "idle",
        syncMessage: "",
        passage: data.passage
          ? {
              id: data.passage.id,
              text: data.passage.text,
              timerMode: "PER_SUB_QUESTION",
              questionIndex: data.questionIndex,
              totalQuestions: data.totalQuestions,
              timeLimitSeconds: data.timeLimitSeconds,
              effectiveDisplayMode: data.effectiveDisplayMode,
            }
          : null,
        questions: [buildQuestionFromDisplayed(data)],
        timeLeft: null,
        liveTimerLimitSeconds: null,
      };
    }
    case "PASSAGE_DISPLAYED": {
      const data = action.message;
      return {
        ...state,
        sessionState: "ACTIVE",
        questionLifecycle: "DISPLAYED",
        leaderboard: [],
        participantLeaderboard: [],
        finalLeaderboard: [],
        syncStatus: "idle",
        syncMessage: "",
        passage: {
          id: data.passageId,
          text: data.passageText,
          timerMode: "ENTIRE_PASSAGE",
          questionIndex: data.questionIndex,
          totalQuestions: data.totalQuestions,
          timeLimitSeconds: null,
          effectiveDisplayMode: data.effectiveDisplayMode,
        },
        questions: data.subQuestions.map((question, index) =>
          buildQuestionFromPassageSubQuestion(
            question,
            data.questionIndex + index,
            data.totalQuestions,
            data.timeLimitSeconds ?? 0,
            data.effectiveDisplayMode,
            data.passageId,
          ),
        ),
        timeLeft: null,
        liveTimerLimitSeconds: null,
      };
    }
    case "SESSION_END":
      return {
        ...state,
        sessionState: "ENDED",
        finalLeaderboard: action.leaderboard ?? state.finalLeaderboard,
        liveTimerLimitSeconds: null,
      };
    case "TIMER_START":
      return {
        ...state,
        sessionState: "ACTIVE",
        questionLifecycle: "TIMED",
        timeLeft: action.timeLimitSeconds,
        liveTimerLimitSeconds: action.timeLimitSeconds,
      };
    case "QUESTION_FROZEN":
      return {
        ...state,
        questionLifecycle: "FROZEN",
        timeLeft: 0,
        liveTimerLimitSeconds: null,
        questions: state.questions.map((question) => {
          const shouldFreeze =
            action.message.event === "PASSAGE_FROZEN" ||
            question.id === action.message.questionId;
          return shouldFreeze ? { ...question, lockedIn: true } : question;
        }),
      };
    case "QUESTION_REVIEWED": {
      const optionPoints = normalizePoints(action.optionPoints);
      const fromPoints = Object.entries(optionPoints)
        .filter(([, pts]) => pts > 0)
        .map(([id]) => Number(id));
      const mergedCorrect =
        fromPoints.length > 0
          ? fromPoints
          : normalizeIdList(action.correctOptionIds);
      return {
        ...state,
        questionLifecycle: "REVIEWING",
        questions: updateQuestion(state.questions, action.questionId, {
          correctOptionIds: mergedCorrect,
          optionPoints,
          reviewed: true,
          lockedIn: true,
        }),
      };
    }
    case "PARTICIPANT_LEADERBOARD":
      return {
        ...state,
        participantLeaderboard: action.leaderboard,
        leaderboard: action.leaderboard,
        participantCount: action.totalParticipants,
      };
    case "PARTICIPANT_JOINED":
      return { ...state, participantCount: action.count };
    case "ANSWER_UPDATE":
      return {
        ...state,
        questions: updateQuestion(state.questions, action.message.questionId, {
          counts: normalizeCounts(action.message.counts),
          totalAnswered: action.message.totalAnswered,
          totalLockedIn: action.message.totalLockedIn,
        }),
      };
    case "ANSWER_REVEAL":
      return {
        ...state,
        questions: updateQuestion(state.questions, action.message.questionId, {
          counts: normalizeCounts(action.message.counts),
          totalAnswered: action.message.totalAnswered,
          revealed: true,
        }),
      };
    case "TIMER_TICK":
      if (state.timeLeft === null || state.timeLeft <= 0) return state;
      return { ...state, timeLeft: state.timeLeft - 1 };
    case "SYNC_STATUS":
      return {
        ...state,
        syncStatus: action.status,
        syncMessage: action.message,
      };
    case "SET_SELECTION":
      return {
        ...state,
        questions: setQuestionSelection(
          state.questions,
          action.questionId,
          action.selectedOptionIds,
        ),
      };
    case "LOCKED_IN":
      return {
        ...state,
        questions: state.questions.map((question) =>
          question.id === action.questionId
            ? { ...question, lockedIn: true }
            : question,
        ),
      };
    case "LOCK_IN_ROLLBACK":
      return {
        ...state,
        questions: state.questions.map((question) =>
          question.id === action.questionId
            ? { ...question, lockedIn: false }
            : question,
        ),
      };
  }
}
