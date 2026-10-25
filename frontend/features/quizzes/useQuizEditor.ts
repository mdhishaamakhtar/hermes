"use client";

import useSWR, { useSWRConfig } from "swr";
import { sessionsApi } from "@/features/session/session-api";
import { storeJoinCode } from "@/lib/session-storage";
import type { Passage, Question, Quiz, SessionSummary } from "@/lib/types";
import {
  nextOrderIndex,
  passagePayload,
  questionPayload,
  withoutPassage,
  withoutQuestion,
  withPassage,
  withQuestion,
  type PassageDraft,
  type QuestionDraft,
  type QuizBlock,
} from "./editor-model";
import { quizApi } from "./quiz-api";

/**
 * The quiz editor's data: the quiz, its sessions, and every save. Each save
 * waits for the server, then patches the cached quiz with what it returned,
 * so the screen always shows what the server holds. A failed save throws for
 * the form that asked, which keeps the draft and says why.
 */
export function useQuizEditor(quizId: string) {
  const quizQuery = useSWR<Quiz>(`/api/quizzes/${quizId}`);
  const sessionsQuery = useSWR<SessionSummary[]>(
    `/api/quizzes/${quizId}/sessions`,
  );

  const { mutate: mutateKey } = useSWRConfig();

  const quiz = quizQuery.data;
  const sessions = sessionsQuery.data ?? [];

  // The quiz list shows question counts, so it is refreshed behind every
  // save and is current when the organiser goes back to it.
  const refreshList = () => void mutateKey("/api/quizzes");

  const patch = async (change: (quiz: Quiz) => Quiz) => {
    await quizQuery.mutate((current) => current && change(current), {
      revalidate: false,
    });
    refreshList();
  };

  const requireQuiz = () => {
    if (!quiz) throw new Error("The quiz has not loaded yet.");
    return quiz;
  };

  // A whole-quiz answer from the server, which renumbers positions.
  const replace = async (next: Quiz) => {
    await quizQuery.mutate(next, { revalidate: false });
    refreshList();
  };

  return {
    quiz,
    error: quizQuery.error,
    retry: () => void quizQuery.mutate(),
    sessions,
    /** A session still in the lobby or live. The quiz is read-only meanwhile. */
    runningSession: sessions.find((session) => session.status !== "ENDED"),

    /** Saves a quiz-wide setting, showing it at once and undoing it if refused. */
    async setSettings(
      change: Partial<Pick<Quiz, "displayMode" | "speedScoring">>,
    ) {
      const current = requireQuiz();
      await patch((q) => ({ ...q, ...change }));
      try {
        await quizApi.update(quizId, {
          title: current.title,
          orderIndex: current.orderIndex,
          displayMode: change.displayMode ?? current.displayMode,
          speedScoring: change.speedScoring ?? current.speedScoring,
        });
      } catch (error) {
        await patch((q) => ({
          ...q,
          displayMode: current.displayMode,
          speedScoring: current.speedScoring,
        }));
        throw error;
      }
    },

    async addQuestion(draft: QuestionDraft) {
      const created = await quizApi.createQuestion(
        quizId,
        questionPayload(draft, nextOrderIndex(requireQuiz()), {
          ownTimer: true,
        }),
      );
      await patch((q) => withQuestion(q, created));
    },

    async saveQuestion(
      question: Question,
      draft: QuestionDraft,
      ownTimer: boolean,
    ) {
      const saved = await quizApi.updateQuestion(
        question.id,
        questionPayload(draft, question.orderIndex, { ownTimer }),
      );
      await patch((q) => withQuestion(q, saved));
    },

    async deleteQuestion(questionId: number) {
      await quizApi.deleteQuestion(questionId);
      await patch((q) => withoutQuestion(q, questionId));
    },

    async addPassage(draft: PassageDraft, questions: QuestionDraft[]) {
      const ownTimer = draft.timerMode === "PER_SUB_QUESTION";
      const created = await quizApi.createPassage(quizId, {
        ...passagePayload(draft, nextOrderIndex(requireQuiz())),
        subQuestions: questions.map((question, index) =>
          questionPayload(question, index, { ownTimer }),
        ),
      });
      await patch((q) => withPassage(q, created));
    },

    async savePassage(passage: Passage, draft: PassageDraft) {
      const saved = await quizApi.updatePassage(
        passage.id,
        passagePayload(draft, passage.orderIndex),
      );
      await patch((q) => withPassage(q, saved));
    },

    async deletePassage(passageId: number) {
      await quizApi.deletePassage(passageId);
      await patch((q) => withoutPassage(q, passageId));
    },

    async addSubQuestion(passage: Passage, draft: QuestionDraft) {
      // Max + 1, not length: after a deletion, length can collide with an
      // index still in use.
      const orderIndex =
        Math.max(-1, ...passage.subQuestions.map((q) => q.orderIndex)) + 1;
      const created = await quizApi.addSubQuestion(
        passage.id,
        questionPayload(draft, orderIndex, {
          ownTimer: passage.timerMode === "PER_SUB_QUESTION",
        }),
      );
      await patch((q) => withQuestion(q, created));
    },

    /** Copies a question into the slot right after it. */
    async duplicateQuestion(questionId: number) {
      await replace(await quizApi.duplicateQuestion(questionId));
    },

    /** Saves a new running order, top to bottom. */
    async reorder(blocks: QuizBlock[]) {
      await replace(
        await quizApi.reorder(
          quizId,
          blocks.map((block) =>
            block.kind === "question"
              ? { kind: "QUESTION", id: block.question.id }
              : { kind: "PASSAGE", id: block.passage.id },
          ),
        ),
      );
    },

    /**
     * Opens a lobby and returns its session id. A rehearsal is the host's
     * own run-through, kept out of the quiz's past sessions.
     */
    async launch({ rehearsal = false } = {}) {
      const session = await sessionsApi.create(Number(quizId), { rehearsal });
      storeJoinCode(session.id, session.joinCode);
      return session.id;
    },

    /** Deletes the session outright: its players and answers go with it. */
    async discardSession(sessionId: number) {
      await sessionsApi.abandon(sessionId);
      await sessionsQuery.mutate(
        (list) => list?.filter((session) => session.id !== sessionId),
        { revalidate: false },
      );
    },
  };
}
