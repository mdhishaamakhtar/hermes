import { api } from "@/lib/api";
import type {
  DisplayMode,
  Passage,
  PassageTimerMode,
  Question,
  Quiz,
} from "@/lib/types";
import type { QuestionPayload } from "./editor-model";

interface PassagePayload {
  text: string;
  orderIndex: number;
  timerMode: PassageTimerMode;
  timeLimitSeconds: number | null;
}

/** One entry of a quiz's running order, top to bottom. */
export interface OrderBlock {
  kind: "QUESTION" | "PASSAGE";
  id: number;
}

export const quizApi = {
  /** A new quiz, in the event given or the organiser's own quizzes. */
  create: (title: string, eventId?: number) =>
    api.post<Quiz>("/api/quizzes", { title, eventId }),
  // These send an empty body so the client reads the quiz they return.
  createSample: () => api.post<Quiz>("/api/quizzes/sample", {}),
  duplicate: (quizId: number) =>
    api.post<Quiz>(`/api/quizzes/${quizId}/duplicate`, {}),
  delete: (quizId: number) => api.delete(`/api/quizzes/${quizId}`),
  reorder: (quizId: string, blocks: OrderBlock[]) =>
    api.put<Quiz>(`/api/quizzes/${quizId}/order`, { blocks }),
  duplicateQuestion: (id: number) =>
    api.post<Quiz>(`/api/questions/${id}/duplicate`, {}),

  update: (
    quizId: string,
    data: {
      title: string;
      orderIndex: number;
      displayMode: DisplayMode;
      speedScoring: boolean;
    },
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
