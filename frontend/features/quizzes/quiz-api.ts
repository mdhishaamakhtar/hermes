import { api } from "@/lib/api";
import type {
  DisplayMode,
  Passage,
  PassageTimerMode,
  Question,
} from "@/lib/types";
import type { QuestionPayload } from "./editor-model";

interface PassagePayload {
  text: string;
  orderIndex: number;
  timerMode: PassageTimerMode;
  timeLimitSeconds: number | null;
}

export const quizApi = {
  update: (
    quizId: string,
    data: { title: string; orderIndex: number; displayMode: DisplayMode },
  ) => api.put<void>(`/api/quizzes/${quizId}`, data),

  createQuestion: (quizId: string, data: QuestionPayload) =>
    api.post<Question>(`/api/quizzes/${quizId}/questions`, data),
  updateQuestion: (id: number, data: QuestionPayload) =>
    api.put<Question>(`/api/questions/${id}`, data),
  deleteQuestion: (id: number) => api.delete(`/api/questions/${id}`),

  createPassage: (
    quizId: string,
    data: PassagePayload & { subQuestions: QuestionPayload[] },
  ) => api.post<Passage>(`/api/quizzes/${quizId}/passages`, data),
  updatePassage: (id: number, data: PassagePayload) =>
    api.put<Passage>(`/api/passages/${id}`, data),
  deletePassage: (id: number) => api.delete(`/api/passages/${id}`),
  addSubQuestion: (passageId: number, data: QuestionPayload) =>
    api.post<Question>(`/api/passages/${passageId}/questions`, data),
};
