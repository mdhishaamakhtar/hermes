/**
 * The organiser session reducer.
 *
 * Split out of useHostSession.ts unchanged — same branches, same order, same
 * merge rules. Every STOMP message the host receives becomes an action here.
 */
import {
  normalizeCounts,
  normalizeIdList,
  normalizePoints,
} from "@/lib/session-utils";
import { getStoredSessionJoinCode } from "@/lib/session-storage";
import type {
  ActivePassage,
  ActiveQuestion,
  HostSessionAction,
  HostSessionState,
  QuestionLifecycle,
  SessionStatus,
} from "./host-types";
import {
  DEFAULT_STATS,
  normalizeHostQuestionStats,
  updateStats,
} from "./host-stats";

export function initHostSessionState(id: string): HostSessionState {
  return {
    sessionStatus: "LOBBY",
    questionLifecycle: "DISPLAYED",
    joinCode: getStoredSessionJoinCode(id),
    participantCount: 0,
    activeQuestion: null,
    activePassage: null,
    questionIndex: 0,
    totalQuestions: 0,
    effectiveDisplayMode: "LIVE",
    timerLimitSeconds: 0,
    timeLeft: 0,
    questionStatsById: {},
    leaderboard: [],
    finalLeaderboard: null,
    sessionResults: null,
    hydrated: false,
  };
}

export function hostSessionReducer(
  state: HostSessionState,
  action: HostSessionAction,
): HostSessionState {
  switch (action.type) {
    case "CONTEXT_LOADED": {
      const nextStatus =
        action.status ?? action.lobby?.status ?? state.sessionStatus;
      return {
        ...state,
        participantCount:
          action.lobby?.participantCount ?? state.participantCount,
        joinCode: action.lobby?.joinCode || state.joinCode,
        sessionStatus: nextStatus,
        hydrated: true,
      };
    }
    case "RESULTS_LOADED":
      return {
        ...state,
        sessionResults: action.results,
        finalLeaderboard: action.results.leaderboard,
      };
    case "SYNC_LOADED": {
      const {
        status,
        questionLifecycle,
        joinCode,
        participantCount,
        currentQuestion,
        currentPassage,
        questionStatsById,
        leaderboard,
        timeLeftSeconds,
      } = action.sync;

      const activeQuestion: ActiveQuestion | null = currentQuestion
        ? {
            id: currentQuestion.id,
            text: currentQuestion.text,
            questionType: currentQuestion.questionType,
            orderIndex: currentQuestion.orderIndex,
            totalQuestions: currentQuestion.totalQuestions,
            timeLimitSeconds: currentQuestion.timeLimitSeconds,
            effectiveDisplayMode: currentQuestion.effectiveDisplayMode,
            passage: currentQuestion.passage,
            options: currentQuestion.options,
          }
        : null;

      const activePassage: ActivePassage | null = currentPassage
        ? {
            id: currentPassage.id,
            text: currentPassage.text,
            timerMode: currentPassage.timerMode,
            questionIndex: currentPassage.questionIndex,
            totalQuestions: currentPassage.totalQuestions,
            effectiveDisplayMode: currentPassage.effectiveDisplayMode,
            subQuestions: currentPassage.subQuestions.map((question) => ({
              id: question.id,
              text: question.text,
              questionType: question.questionType,
              orderIndex: question.orderIndex,
              totalQuestions: question.totalQuestions,
              timeLimitSeconds: question.timeLimitSeconds,
              effectiveDisplayMode: question.effectiveDisplayMode,
              passage: question.passage,
              options: question.options,
            })),
          }
        : null;

      return {
        ...state,
        sessionStatus: (status as SessionStatus) ?? state.sessionStatus,
        questionLifecycle:
          (questionLifecycle as QuestionLifecycle) ?? state.questionLifecycle,
        joinCode: joinCode || state.joinCode,
        participantCount,
        activeQuestion,
        activePassage,
        questionIndex:
          currentPassage?.questionIndex ??
          currentQuestion?.orderIndex ??
          state.questionIndex,
        totalQuestions:
          currentPassage?.totalQuestions ??
          currentQuestion?.totalQuestions ??
          state.totalQuestions,
        effectiveDisplayMode:
          currentPassage?.effectiveDisplayMode ??
          currentQuestion?.effectiveDisplayMode ??
          state.effectiveDisplayMode,
        timerLimitSeconds:
          timeLeftSeconds ??
          currentPassage?.timeLimitSeconds ??
          currentQuestion?.timeLimitSeconds ??
          0,
        timeLeft: timeLeftSeconds ?? 0,
        questionStatsById: normalizeHostQuestionStats(questionStatsById),
        leaderboard,
        hydrated: true,
      };
    }
    case "QUESTION_DISPLAYED": {
      const data = action.message;
      const question: ActiveQuestion = {
        id: data.questionId,
        text: data.text,
        questionType: data.questionType,
        orderIndex: data.questionIndex,
        totalQuestions: data.totalQuestions,
        timeLimitSeconds: data.timeLimitSeconds,
        effectiveDisplayMode: data.effectiveDisplayMode,
        passage: data.passage,
        options: data.options,
      };
      return {
        ...state,
        sessionStatus: "ACTIVE",
        questionLifecycle: "DISPLAYED",
        activeQuestion: question,
        activePassage: data.passage
          ? {
              id: data.passage.id,
              text: data.passage.text,
              timerMode: "PER_SUB_QUESTION",
              questionIndex: data.questionIndex,
              totalQuestions: data.totalQuestions,
              effectiveDisplayMode: data.effectiveDisplayMode,
              subQuestions: [question],
            }
          : null,
        questionIndex: data.questionIndex,
        totalQuestions: data.totalQuestions,
        effectiveDisplayMode: data.effectiveDisplayMode,
        timeLeft: 0,
        timerLimitSeconds: 0,
        questionStatsById: updateStats(
          state.questionStatsById,
          data.questionId,
          DEFAULT_STATS(),
        ),
      };
    }
    case "PASSAGE_DISPLAYED": {
      const data = action.message;
      const subQuestions: ActiveQuestion[] = data.subQuestions.map(
        (question, index) => ({
          id: question.questionId,
          text: question.text,
          questionType: question.questionType,
          orderIndex: data.questionIndex + index,
          totalQuestions: data.totalQuestions,
          timeLimitSeconds: 0,
          effectiveDisplayMode: data.effectiveDisplayMode,
          passage: { id: data.passageId, text: data.passageText },
          options: question.options,
        }),
      );
      const nextStats = { ...state.questionStatsById };
      subQuestions.forEach((question) => {
        nextStats[question.id] = nextStats[question.id] ?? DEFAULT_STATS();
      });
      return {
        ...state,
        sessionStatus: "ACTIVE",
        questionLifecycle: "DISPLAYED",
        activeQuestion: null,
        activePassage: {
          id: data.passageId,
          text: data.passageText,
          timerMode: "ENTIRE_PASSAGE",
          questionIndex: data.questionIndex,
          totalQuestions: data.totalQuestions,
          effectiveDisplayMode: data.effectiveDisplayMode,
          subQuestions,
        },
        questionIndex: data.questionIndex,
        totalQuestions: data.totalQuestions,
        effectiveDisplayMode: data.effectiveDisplayMode,
        timeLeft: 0,
        timerLimitSeconds: 0,
        questionStatsById: nextStats,
      };
    }
    case "TIMER_START":
      return {
        ...state,
        sessionStatus: "ACTIVE",
        questionLifecycle: "TIMED",
        timerLimitSeconds: action.timeLimitSeconds,
        timeLeft: action.timeLimitSeconds,
      };
    case "QUESTION_FROZEN":
      return { ...state, questionLifecycle: "FROZEN", timeLeft: 0 };
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
        questionStatsById: updateStats(
          state.questionStatsById,
          action.questionId,
          {
            correctOptionIds: mergedCorrect,
            optionPoints,
            reviewed: true,
          },
        ),
      };
    }
    case "ANSWER_UPDATE":
      return {
        ...state,
        questionStatsById: updateStats(
          state.questionStatsById,
          action.message.questionId,
          {
            counts: normalizeCounts(action.message.counts),
            totalAnswered: action.message.totalAnswered,
            totalLockedIn: action.message.totalLockedIn,
            totalParticipants: action.message.totalParticipants,
          },
        ),
      };
    case "ANSWER_REVEAL":
      return {
        ...state,
        questionStatsById: updateStats(
          state.questionStatsById,
          action.message.questionId,
          {
            counts: normalizeCounts(action.message.counts),
            totalAnswered: action.message.totalAnswered,
            totalParticipants: action.message.totalParticipants,
            revealed: true,
          },
        ),
      };
    case "LEADERBOARD_UPDATE":
      return { ...state, leaderboard: action.leaderboard };
    case "SESSION_END":
      return {
        ...state,
        sessionStatus: "ENDED",
        finalLeaderboard: action.leaderboard ?? state.finalLeaderboard,
      };
    case "PARTICIPANT_JOINED":
      return { ...state, participantCount: action.count };
    case "SESSION_STARTED":
      return { ...state, sessionStatus: "ACTIVE" };
    case "TIMER_TICK":
      if (state.timeLeft <= 0) return state;
      return { ...state, timeLeft: Math.max(0, state.timeLeft - 1) };
    case "SCORING_CORRECTED_LOCAL":
      return {
        ...state,
        questionStatsById: updateStats(
          state.questionStatsById,
          action.questionId,
          {
            optionPoints: action.optionPoints,
            correctOptionIds: action.correctOptionIds,
            reviewed: true,
          },
        ),
      };
  }
}
