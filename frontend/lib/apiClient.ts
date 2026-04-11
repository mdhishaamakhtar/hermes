import { api } from "@/lib/api";
import type {
  DisplayMode,
  EventSummary,
  Passage,
  PassageTimerMode,
  QuestionType,
  QuizSummary,
  Question,
  QuestionOptionInput,
  HostSessionSync,
  SessionResults,
} from "@/lib/types";

/** Matches GET `/api/sessions/{id}/status` and `SessionLobbySnapshot.status`. */
export type SessionLifecycleStatus = "LOBBY" | "ACTIVE" | "ENDED";

export interface SessionLobbySnapshot {
  status: SessionLifecycleStatus;
  participantCount: number;
  joinCode: string;
}

export const eventsApi = {
  create: (data: { title: string; description: string }) =>
    api.post<EventSummary>("/api/events", data),
  delete: (id: number) => api.delete(`/api/events/${id}`),
  createQuiz: (
    eventId: string,
    data: { title: string; orderIndex: number; displayMode?: DisplayMode },
  ) => api.post<QuizSummary>(`/api/events/${eventId}/quizzes`, data),
  deleteQuiz: (quizId: number) => api.delete(`/api/quizzes/${quizId}`),
};

export const quizzesApi = {
  update: (
    id: string,
    data: { title: string; orderIndex: number; displayMode: DisplayMode },
  ) => api.put(`/api/quizzes/${id}`, data),
  createQuestion: (
    id: string,
    data: {
      text: string;
      orderIndex: number;
      timeLimitSeconds: number;
      questionType: QuestionType;
      displayModeOverride: DisplayMode | null;
      options: QuestionOptionInput[];
    },
  ) => api.post<Question>(`/api/quizzes/${id}/questions`, data),
};

export const questionsApi = {
  update: (
    id: number,
    data: {
      text: string;
      orderIndex: number;
      timeLimitSeconds: number;
      questionType: QuestionType;
      displayModeOverride: DisplayMode | null;
      options: QuestionOptionInput[];
    },
  ) => api.put<Question>(`/api/questions/${id}`, data),
  delete: (id: number) => api.delete(`/api/questions/${id}`),
};

export const passagesApi = {
  create: (
    quizId: string,
    data: {
      text: string;
      orderIndex: number;
      timerMode: PassageTimerMode;
      timeLimitSeconds: number | null;
      subQuestions: Array<{
        text: string;
        orderIndex: number;
        timeLimitSeconds?: number;
        questionType: QuestionType;
        displayModeOverride?: DisplayMode | null;
        options: QuestionOptionInput[];
      }>;
    },
  ) => api.post<Passage>(`/api/quizzes/${quizId}/passages`, data),
  update: (
    id: number,
    data: {
      text: string;
      orderIndex: number;
      timerMode: PassageTimerMode;
      timeLimitSeconds: number | null;
    },
  ) => api.put<Passage>(`/api/passages/${id}`, data),
  delete: (id: number) => api.delete(`/api/passages/${id}`),
  addSubQuestion: (
    passageId: number,
    data: {
      text: string;
      orderIndex: number;
      timeLimitSeconds?: number;
      questionType: QuestionType;
      displayModeOverride: DisplayMode | null;
      options: QuestionOptionInput[];
    },
  ) => api.post<Question>(`/api/passages/${passageId}/questions`, data),
};

export const sessionsApi = {
  create: (quizId: number) =>
    api.post<{ id: number; joinCode: string }>("/api/sessions", { quizId }),
  start: (id: number | string) => api.post(`/api/sessions/${id}/start`),
  startTimer: (id: number | string) =>
    api.post(`/api/sessions/${id}/start-timer`),
  endTimer: (id: number | string) => api.post(`/api/sessions/${id}/end-timer`),
  next: (id: number | string) => api.post(`/api/sessions/${id}/next`),
  end: (id: number | string) => api.post(`/api/sessions/${id}/end`),
  abandon: (id: number | string) => api.delete(`/api/sessions/${id}`),
  hostSync: (id: number | string) =>
    api.get<HostSessionSync>(`/api/sessions/${id}/host-sync`),
  /** Organizer-facing results snapshot (JWT). Same resource as review / SWR `/api/sessions/{id}/results`. */
  results: (id: number | string) =>
    api.get<SessionResults>(`/api/sessions/${id}/results`),
  lobby: (id: number | string) =>
    api.get<SessionLobbySnapshot>(`/api/sessions/${id}/lobby`),
  sessionStatus: (id: number | string) =>
    api.get<SessionLifecycleStatus>(`/api/sessions/${id}/status`),
  correctScoring: (
    id: number | string,
    questionId: number,
    options: Array<{ optionId: number; pointValue: number }>,
  ) =>
    api.patch(`/api/sessions/${id}/questions/${questionId}/scoring`, {
      options,
    }),
};
