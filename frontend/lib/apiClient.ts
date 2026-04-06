import { api } from "@/lib/api";
import type {
  EventSummary,
  QuizSummary,
  Question,
  OptionReq,
} from "@/lib/types";

export const eventsApi = {
  create: (data: { title: string; description: string }) =>
    api.post<EventSummary>("/api/events", data),
  delete: (id: number) => api.delete(`/api/events/${id}`),
  createQuiz: (eventId: string, data: { title: string; orderIndex: number }) =>
    api.post<QuizSummary>(`/api/events/${eventId}/quizzes`, data),
  deleteQuiz: (quizId: number) => api.delete(`/api/quizzes/${quizId}`),
};

export const quizzesApi = {
  createQuestion: (
    id: string,
    data: {
      text: string;
      orderIndex: number;
      timeLimitSeconds: number;
      options: OptionReq[];
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
      options: OptionReq[];
    },
  ) => api.put<Question>(`/api/questions/${id}`, data),
  delete: (id: number) => api.delete(`/api/questions/${id}`),
};

export const sessionsApi = {
  create: (quizId: number) =>
    api.post<{ id: number; joinCode: string }>("/api/sessions", { quizId }),
  start: (id: number | string) => api.post(`/api/sessions/${id}/start`),
  next: (id: number | string) => api.post(`/api/sessions/${id}/next`),
  end: (id: number | string) => api.post(`/api/sessions/${id}/end`),
};
