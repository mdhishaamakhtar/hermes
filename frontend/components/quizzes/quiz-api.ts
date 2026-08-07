import { api } from "@/lib/api";
import type {
  DisplayMode,
  Passage,
  PassageTimerMode,
  QuestionType,
  Question,
  QuestionOptionInput,
} from "@/lib/types";

/** Shared shape of a question create/update payload. */
interface QuestionPayload {
  text: string;
  orderIndex: number;
  timeLimitSeconds: number;
  questionType: QuestionType;
  displayModeOverride: DisplayMode | null;
  options: QuestionOptionInput[];
}

export const quizzesApi = {
  update: (
    id: string,
    data: { title: string; orderIndex: number; displayMode: DisplayMode },
  ) => api.put<void>(`/api/quizzes/${id}`, data),
  createQuestion: (id: string, data: QuestionPayload) =>
    api.post<Question>(`/api/quizzes/${id}/questions`, data),
};

export const questionsApi = {
  update: (id: number, data: QuestionPayload) =>
    api.put<Question>(`/api/questions/${id}`, data),
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
      subQuestions: Array<
        Omit<QuestionPayload, "timeLimitSeconds"> & {
          timeLimitSeconds?: number;
          displayModeOverride?: DisplayMode | null;
        }
      >;
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
    data: Omit<QuestionPayload, "timeLimitSeconds"> & {
      timeLimitSeconds?: number;
    },
  ) => api.post<Question>(`/api/passages/${passageId}/questions`, data),
};
