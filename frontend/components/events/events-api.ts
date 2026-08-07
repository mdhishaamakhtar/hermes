import { api } from "@/lib/api";
import type { DisplayMode, EventSummary, QuizSummary } from "@/lib/types";

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
