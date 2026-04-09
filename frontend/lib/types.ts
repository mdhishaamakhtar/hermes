export interface QuizSummary {
  id: number;
  title: string;
  orderIndex: number;
}

export type QuestionType = "SINGLE_SELECT" | "MULTI_SELECT";
export type DisplayMode = "LIVE" | "BLIND" | "CODE_DISPLAY";
export type PassageTimerMode = "PER_SUB_QUESTION" | "ENTIRE_PASSAGE";

export interface QuestionOptionInput {
  text: string;
  orderIndex?: number;
  pointValue: number;
}

export interface QuestionOption {
  id: number;
  text: string;
  orderIndex: number;
  pointValue: number;
}

export interface Question {
  id: number;
  passageId: number | null;
  text: string;
  questionType: QuestionType;
  orderIndex: number;
  timeLimitSeconds: number;
  displayModeOverride: DisplayMode | null;
  effectiveDisplayMode: DisplayMode;
  options: QuestionOption[];
}

export interface Passage {
  id: number;
  quizId: number;
  text: string;
  orderIndex: number;
  timerMode: PassageTimerMode;
  timeLimitSeconds: number | null;
  subQuestions: Question[];
}

export interface Quiz {
  id: number;
  title: string;
  orderIndex: number;
  displayMode: DisplayMode;
  questions: Question[];
  passages: Passage[];
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

export interface ResultOption {
  id: number;
  text: string;
  orderIndex: number;
  isCorrect: boolean;
  count: number;
}

export interface QuestionResult {
  id: number;
  text: string;
  orderIndex: number;
  timeLimitSeconds: number;
  options: ResultOption[];
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
