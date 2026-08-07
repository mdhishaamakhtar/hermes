import { api } from "@/lib/api";
import type { HostSessionSync, MyResults, SessionResults } from "@/lib/types";

/** Matches GET `/api/sessions/{id}/status` and `SessionLobbySnapshot.status`. */
export type SessionLifecycleStatus = "LOBBY" | "ACTIVE" | "ENDED";

export interface SessionLobbySnapshot {
  status: SessionLifecycleStatus;
  participantCount: number;
  joinCode: string;
}

export const sessionsApi = {
  create: (quizId: number) =>
    api.post<{ id: number; joinCode: string }>("/api/sessions", { quizId }),
  start: (id: number | string) => api.post<void>(`/api/sessions/${id}/start`),
  startTimer: (id: number | string) =>
    api.post<void>(`/api/sessions/${id}/start-timer`),
  endTimer: (id: number | string) =>
    api.post<void>(`/api/sessions/${id}/end-timer`),
  next: (id: number | string) => api.post<void>(`/api/sessions/${id}/next`),
  end: (id: number | string) => api.post<void>(`/api/sessions/${id}/end`),
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
    api.patch<void>(`/api/sessions/${id}/questions/${questionId}/scoring`, {
      options,
    }),
  /**
   * Participant-facing results. Authenticated by rejoin token rather than JWT,
   * so it takes a header the shared SWR fetcher cannot supply.
   */
  myResults: (sessionId: string, rejoinToken: string) =>
    api.get<MyResults>(`/api/sessions/${sessionId}/my-results`, {
      "X-Rejoin-Token": rejoinToken,
    }),
};
