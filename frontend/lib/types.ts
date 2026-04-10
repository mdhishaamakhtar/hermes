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
  participantId: number;
  displayName: string;
  score: number;
}

export type ParticipantLeaderboardEntry = LeaderboardEntry;

export interface RejoinOptionInfo {
  id: number;
  text: string;
  orderIndex: number;
}

export interface RejoinCurrentQuestion {
  id: number;
  text: string;
  orderIndex: number;
  totalQuestions: number;
  timeLimitSeconds: number;
  questionType: QuestionType;
  effectiveDisplayMode: DisplayMode;
  passage: {
    id: number;
    text: string;
    timerMode: PassageTimerMode;
  } | null;
  options: RejoinOptionInfo[];
  selectedOptionIds: number[];
  lockedIn: boolean;
}

export interface RejoinCurrentPassageQuestion {
  id: number;
  text: string;
  orderIndex: number;
  timeLimitSeconds: number;
  questionType: QuestionType;
  options: RejoinOptionInfo[];
  selectedOptionIds: number[];
  lockedIn: boolean;
}

export interface RejoinCurrentPassage {
  id: number;
  text: string;
  timerMode: PassageTimerMode;
  questionIndex: number;
  totalQuestions: number;
  timeLimitSeconds: number | null;
  effectiveDisplayMode: DisplayMode;
  subQuestions: RejoinCurrentPassageQuestion[];
}

export interface RejoinResponse {
  participantId: number;
  sessionId: number;
  status: string;
  questionLifecycle: string | null;
  sessionTitle: string;
  participantCount: number;
  currentQuestionId: number | null;
  currentPassageId: number | null;
  alreadyAnswered: number[];
  currentQuestion: RejoinCurrentQuestion | null;
  currentPassage: RejoinCurrentPassage | null;
  timeLeftSeconds: number | null;
}

export interface HostSyncOptionInfo {
  id: number;
  text: string;
  orderIndex: number;
}

export interface HostSyncPassageInfo {
  id: number;
  text: string;
}

export interface HostSyncCurrentQuestion {
  id: number;
  text: string;
  questionType: QuestionType;
  orderIndex: number;
  totalQuestions: number;
  timeLimitSeconds: number;
  effectiveDisplayMode: DisplayMode;
  passage: HostSyncPassageInfo | null;
  options: HostSyncOptionInfo[];
}

export interface HostSyncPassageQuestion {
  id: number;
  text: string;
  questionType: QuestionType;
  orderIndex: number;
  totalQuestions: number;
  timeLimitSeconds: number;
  effectiveDisplayMode: DisplayMode;
  passage: HostSyncPassageInfo | null;
  options: HostSyncOptionInfo[];
}

export interface HostSyncCurrentPassage {
  id: number;
  text: string;
  timerMode: PassageTimerMode;
  questionIndex: number;
  totalQuestions: number;
  timeLimitSeconds: number | null;
  effectiveDisplayMode: DisplayMode;
  subQuestions: HostSyncPassageQuestion[];
}

export interface HostSyncQuestionStats {
  counts: Record<number, number>;
  totalAnswered: number;
  totalLockedIn: number;
  totalParticipants: number;
  correctOptionIds: number[];
  optionPoints: Record<number, number>;
  revealed: boolean;
  reviewed: boolean;
}

export interface HostSessionSync {
  sessionId: number;
  status: string;
  questionLifecycle: string | null;
  joinCode: string;
  participantCount: number;
  currentQuestion: HostSyncCurrentQuestion | null;
  currentPassage: HostSyncCurrentPassage | null;
  questionStatsById: Record<number, HostSyncQuestionStats>;
  leaderboard: LeaderboardEntry[];
  timeLeftSeconds: number | null;
}

export interface ResultOption {
  id: number;
  text: string;
  orderIndex: number;
  isCorrect: boolean;
  count: number;
  pointValue: number;
}

export interface QuestionResult {
  id: number;
  text: string;
  orderIndex: number;
  timeLimitSeconds: number;
  passageId: number | null;
  passageText: string | null;
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

export interface MyResultsOptionInfo {
  id: number;
  text: string;
  orderIndex: number;
  isCorrect: boolean;
  pointValue: number;
}

export interface MyResultsQuestionResult {
  questionId: number;
  questionText: string;
  orderIndex: number;
  questionType: QuestionType;
  passageId: number | null;
  passageText: string | null;
  selectedOptionIds: number[];
  correctOptionIds: number[];
  options: MyResultsOptionInfo[];
  isCorrect: boolean;
  pointsEarned: number;
}

export interface MyResults {
  participantId: number;
  displayName: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  rank: number;
  totalParticipants: number;
  questions: MyResultsQuestionResult[];
}
