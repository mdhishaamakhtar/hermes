import { api } from "@/lib/api";
import type { SessionStatus } from "@/lib/types";
import type {
  HostSessionSync,
  JoinResponse,
  LobbySnapshot,
  MyResults,
  RejoinResponse,
  SessionResults,
} from "./session-types";

type Id = number | string;

/*
 * Results are refused with 409 until the session's ENDED status is committed.
 * The server sends SESSION_END only after that commit, so the reads clients
 * make the instant it lands should succeed; retrying a 409 is a safety net.
 */
const NOT_ENDED_YET = [409];

/** Organiser calls authenticate with the JWT; player calls with a rejoin token. */
export const sessionsApi = {
  create: (quizId: number) =>
    api.post<{ id: number; joinCode: string }>("/api/sessions", { quizId }),
  start: (id: Id) => api.post<void>(`/api/sessions/${id}/start`),
  startTimer: (id: Id) => api.post<void>(`/api/sessions/${id}/start-timer`),
  endTimer: (id: Id) => api.post<void>(`/api/sessions/${id}/end-timer`),
  next: (id: Id) => api.post<void>(`/api/sessions/${id}/next`),
  end: (id: Id) => api.post<void>(`/api/sessions/${id}/end`),
  abandon: (id: Id) => api.delete(`/api/sessions/${id}`),
  hostSync: (id: Id) =>
    api.get<HostSessionSync>(`/api/sessions/${id}/host-sync`),
  lobby: (id: Id) => api.get<LobbySnapshot>(`/api/sessions/${id}/lobby`),
  status: (id: Id) => api.get<SessionStatus>(`/api/sessions/${id}/status`),
  results: (id: Id) =>
    api.get<SessionResults>(`/api/sessions/${id}/results`, {
      retryOn: NOT_ENDED_YET,
    }),
  correctScoring: (
    id: Id,
    questionId: number,
    options: Array<{ optionId: number; pointValue: number }>,
  ) =>
    api.patch<void>(`/api/sessions/${id}/questions/${questionId}/scoring`, {
      options,
    }),

  join: (joinCode: string, displayName: string) =>
    api.post<JoinResponse>(
      "/api/sessions/join",
      { joinCode, displayName },
      { skipAuth: true },
    ),
  rejoin: (sessionId: Id, rejoinToken: string) =>
    api.post<RejoinResponse>(
      "/api/sessions/rejoin",
      { sessionId: Number(sessionId), rejoinToken },
      { skipAuth: true },
    ),
  /** HTTP fallback for when the realtime answer path does not confirm. */
  submitAnswer: (
    sessionId: Id,
    body: {
      rejoinToken: string;
      questionId: number;
      selectedOptionIds: number[];
    },
  ) =>
    api.post<void>(`/api/sessions/${sessionId}/answers`, body, {
      skipAuth: true,
    }),
  /** HTTP fallback for a lock-in the realtime path did not confirm. */
  lockIn: (sessionId: Id, body: { rejoinToken: string; questionId: number }) =>
    api.post<void>(`/api/sessions/${sessionId}/lock-in`, body, {
      skipAuth: true,
    }),
  myResults: (sessionId: Id, rejoinToken: string) =>
    api.get<MyResults>(`/api/sessions/${sessionId}/my-results`, {
      skipAuth: true,
      headers: { "X-Rejoin-Token": rejoinToken },
      retryOn: NOT_ENDED_YET,
    }),
};
