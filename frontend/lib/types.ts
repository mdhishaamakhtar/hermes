export interface QuizSummary {
  id: number;
  title: string;
  orderIndex: number;
}

export interface OptionReq {
  text: string;
  isCorrect: boolean;
}

export interface Option {
  id: number;
  text: string;
  orderIndex: number;
  isCorrect: boolean;
}

export interface Question {
  id: number;
  text: string;
  orderIndex: number;
  timeLimitSeconds: number;
  displayModeOverride: string | null;
  effectiveDisplayMode: string;
  options: Option[];
}

export interface Quiz {
  id: number;
  title: string;
  orderIndex: number;
  displayMode: string;
  questions: Question[];
}

export interface EventSummary {
  id: number;
  title: string;
  description: string;
  createdAt: string;
  quizzes: QuizSummary[];
}

export interface SessionItem {
  id: number;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  participantCount: number;
}

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  score: number;
}

export interface OptionResult extends Option {
  count: number;
}

export interface QuestionResult {
  id: number;
  text: string;
  orderIndex: number;
  timeLimitSeconds: number;
  options: OptionResult[];
  totalAnswers: number;
}

export interface SessionResults {
  sessionId: number;
  quizId: number;
  eventId: number;
  quizTitle: string;
  startedAt: string;
  endedAt: string;
  participantCount: number;
  leaderboard: LeaderboardEntry[];
  questions: QuestionResult[];
}
