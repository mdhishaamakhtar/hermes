"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  passagesApi,
  questionsApi,
  quizzesApi,
} from "@/features/quizzes/quiz-api";
import { sessionsApi } from "@/features/session/session-api";
import { apiErrorMessage } from "@/lib/api";
import { storeSessionJoinCode } from "@/lib/session-storage";
import type {
  DisplayMode,
  Passage,
  Question,
  Quiz,
  SessionItem,
} from "@/lib/types";

type ComposerMode = "question" | "passage" | null;

function sortQuestions(questions: Question[]): Question[] {
  return questions.toSorted((a, b) => a.orderIndex - b.orderIndex);
}

function sortPassages(passages: Passage[]): Passage[] {
  return passages.toSorted((a, b) => a.orderIndex - b.orderIndex);
}

function withQuestionUpdated(quiz: Quiz, updated: Question): Quiz {
  if (updated.passageId == null) {
    return {
      ...quiz,
      questions: sortQuestions(
        quiz.questions.map((question) =>
          question.id === updated.id ? updated : question,
        ),
      ),
    };
  }

  return {
    ...quiz,
    passages: sortPassages(
      quiz.passages.map((passage) =>
        passage.id === updated.passageId
          ? {
              ...passage,
              subQuestions: sortQuestions(
                passage.subQuestions.map((question) =>
                  question.id === updated.id ? updated : question,
                ),
              ),
            }
          : passage,
      ),
    ),
  };
}

function withQuestionRemoved(quiz: Quiz, questionId: number): Quiz {
  return {
    ...quiz,
    questions: quiz.questions.filter((question) => question.id !== questionId),
    passages: quiz.passages.map((passage) => ({
      ...passage,
      subQuestions: passage.subQuestions.filter(
        (question) => question.id !== questionId,
      ),
    })),
  };
}

function nextOrderIndexForQuiz(quiz: Quiz): number {
  const highestStandalone = quiz.questions.reduce(
    (max, question) => Math.max(max, question.orderIndex),
    0,
  );
  const highestPassage = quiz.passages.reduce(
    (max, passage) => Math.max(max, passage.orderIndex),
    0,
  );

  return Math.max(highestStandalone, highestPassage) + 1;
}

export function useQuizEditor({
  eventId,
  quizId,
}: {
  eventId: string;
  quizId: string;
}) {
  const router = useRouter();
  const {
    data: quiz,
    mutate: mutateQuiz,
    isLoading: quizLoading,
    error: quizError,
  } = useSWR<Quiz>(`/api/quizzes/${quizId}`);
  const { data: sessions = [], mutate: mutateSessions } = useSWR<SessionItem[]>(
    `/api/quizzes/${quizId}/sessions`,
  );

  const [composerMode, setComposerMode] = useState<ComposerMode>(null);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [abandoning, setAbandoning] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [confirmLabel, setConfirmLabel] = useState("Confirm");
  const [confirmVariant, setConfirmVariant] = useState<"warning" | "danger">(
    "warning",
  );
  const [confirmAction, setConfirmAction] = useState<
    (() => Promise<void>) | null
  >(null);
  const [quizDisplayModeDraft, setQuizDisplayModeDraft] =
    useState<DisplayMode | null>(null);
  const [savingQuizSettings, setSavingQuizSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    if (quizError) {
      router.push(`/events/${eventId}`);
    }
  }, [quizError, eventId, router]);

  const closeComposer = () => setComposerMode(null);
  const clearConfirm = () => setConfirmMessage(null);

  const handleQuestionAdded = (question: Question) => {
    if (!quiz) return;
    mutateQuiz(
      {
        ...quiz,
        questions: sortQuestions([...quiz.questions, question]),
      },
      { revalidate: false },
    );
    closeComposer();
  };

  const handlePassageAdded = (passage: Passage) => {
    if (!quiz) return;
    mutateQuiz(
      {
        ...quiz,
        passages: sortPassages([...quiz.passages, passage]),
      },
      { revalidate: false },
    );
    closeComposer();
  };

  const handleQuestionSaved = (updated: Question) => {
    if (!quiz) return;
    mutateQuiz(withQuestionUpdated(quiz, updated), { revalidate: false });
  };

  const handlePassageSaved = (updated: Passage) => {
    if (!quiz) return;
    mutateQuiz(
      {
        ...quiz,
        passages: sortPassages(
          quiz.passages.map((passage) =>
            passage.id === updated.id ? updated : passage,
          ),
        ),
      },
      { revalidate: false },
    );
  };

  const handleSubQuestionAdded = (passageId: number, question: Question) => {
    if (!quiz) return;
    mutateQuiz(
      {
        ...quiz,
        passages: sortPassages(
          quiz.passages.map((passage) =>
            passage.id === passageId
              ? {
                  ...passage,
                  subQuestions: sortQuestions([
                    ...passage.subQuestions,
                    question,
                  ]),
                }
              : passage,
          ),
        ),
      },
      { revalidate: false },
    );
  };

  const requestDeleteQuestion = (questionId: number) => {
    setConfirmMessage("Delete this question? This cannot be undone.");
    setConfirmLabel("Delete");
    setConfirmVariant("danger");
    setConfirmAction(() => async () => {
      if (!quiz) return;
      setConfirmMessage(null);
      try {
        await questionsApi.delete(questionId);
        mutateQuiz(withQuestionRemoved(quiz, questionId), {
          revalidate: false,
        });
      } catch {
        // The question stays; the editor still reflects the server.
      }
    });
  };

  const requestDeletePassage = (passageId: number) => {
    setConfirmMessage(
      "Delete this passage and every nested sub-question? This cannot be undone.",
    );
    setConfirmLabel("Delete");
    setConfirmVariant("danger");
    setConfirmAction(() => async () => {
      if (!quiz) return;
      setConfirmMessage(null);
      try {
        await passagesApi.delete(passageId);
        mutateQuiz(
          {
            ...quiz,
            passages: quiz.passages.filter(
              (passage) => passage.id !== passageId,
            ),
          },
          { revalidate: false },
        );
      } catch {
        // The passage stays; the editor still reflects the server.
      }
    });
  };

  const handleSaveQuizSettings = async () => {
    if (!quiz) return;
    const nextDisplayMode = quizDisplayModeDraft ?? quiz.displayMode;
    setSavingQuizSettings(true);
    setSettingsError(null);

    try {
      await quizzesApi.update(quizId, {
        title: quiz.title,
        orderIndex: quiz.orderIndex,
        displayMode: nextDisplayMode,
      });
      mutateQuiz(
        {
          ...quiz,
          displayMode: nextDisplayMode,
        },
        { revalidate: false },
      );
    } catch (err) {
      setSettingsError(
        apiErrorMessage(err, "Failed to save quiz display settings."),
      );
    }

    setSavingQuizSettings(false);
  };

  const handleLaunch = async () => {
    setLaunching(true);
    setLaunchError(null);
    try {
      const session = await sessionsApi.create(Number(quizId));
      storeSessionJoinCode(session.id, session.joinCode);
      router.refresh();
      router.push(`/session/${session.id}/host`);
    } catch (err) {
      setLaunchError(apiErrorMessage(err, "Failed to create session"));
      setLaunching(false);
    }
  };

  const handleAbandon = (sessionId: number) => {
    setConfirmMessage(
      "Abandon this session? The quiz will become editable again.",
    );
    setConfirmLabel("Abandon");
    setConfirmVariant("warning");
    setConfirmAction(() => async () => {
      setConfirmMessage(null);
      setAbandoning(true);
      try {
        await sessionsApi.abandon(sessionId);
        mutateSessions(
          sessions.map((session) =>
            session.id === sessionId
              ? { ...session, status: "ENDED" }
              : session,
          ),
          { revalidate: false },
        );
      } catch {
        // The session stays active; the list still reflects the server.
      }
      setAbandoning(false);
    });
  };

  const handleAbandonAll = () => {
    const nonEndedIds = sessions
      .filter((session) => session.status !== "ENDED")
      .map((session) => session.id);
    if (!nonEndedIds.length) return;

    setConfirmMessage(
      `Abandon all ${nonEndedIds.length} active session(s)? The quiz will become editable again.`,
    );
    setConfirmLabel("Abandon");
    setConfirmVariant("warning");
    setConfirmAction(() => async () => {
      setConfirmMessage(null);
      setAbandoning(true);
      // allSettled, not all: one failed abandon must not skip the state
      // reset below and strand the UI in its "abandoning" state.
      await Promise.allSettled(
        nonEndedIds.map((id) => sessionsApi.abandon(id)),
      );
      mutateSessions(
        sessions.map((session) =>
          nonEndedIds.includes(session.id)
            ? { ...session, status: "ENDED" }
            : session,
        ),
        { revalidate: false },
      );
      setAbandoning(false);
    });
  };

  return {
    quiz,
    quizLoading,
    sessions,
    composerMode,
    setComposerMode,
    launching,
    launchError,
    abandoning,
    confirmMessage,
    confirmLabel,
    confirmVariant,
    confirmAction,
    clearConfirm,
    quizDisplayModeDraft,
    setQuizDisplayModeDraft,
    savingQuizSettings,
    settingsError,
    closeComposer,
    handleQuestionAdded,
    handlePassageAdded,
    handleQuestionSaved,
    handlePassageSaved,
    handleSubQuestionAdded,
    requestDeleteQuestion,
    requestDeletePassage,
    handleSaveQuizSettings,
    handleLaunch,
    handleAbandon,
    handleAbandonAll,
    nextOrderIndexForQuiz,
    sortPassages,
    sortQuestions,
  };
}
