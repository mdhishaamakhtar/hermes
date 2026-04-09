# 04 — Frontend Quiz Editor: Multi-Select, Scoring, Passages

## What This Is

Updates the quiz editor UI (`QuizEditorClient`) to support creating and editing all new question types, per-option scoring, passages with sub-questions, passage timer modes, and quiz/question display modes.

## Why It Is at Position 4

Depends on the backend CRUD APIs (items 01-03). The editor must be usable before runtime features are built — the host needs to create the new question types to test them.

## Scope

### In Scope

- Question type selector (single-select / multi-select) when creating/editing a question
- Per-option point value input (integer field next to each option)
- Quiz-level display mode selector (LIVE / BLIND / CODE_DISPLAY) with tooltip explanations
- Per-question display mode override (optional dropdown, "Inherit from quiz" as default)
- Passage creation: a "Add passage" button that opens a form for passage text, timer mode, and inline sub-question creation
- Passage editing: edit passage text, timer mode, add/remove/reorder sub-questions
- Passage timer mode toggle with clear labels ("Timer per question" vs "One timer for all")
- Visual distinction between standalone questions and passages in the quiz item list
- Sensible defaults throughout: SINGLE_SELECT, pointValue 10 for correct / 0 for incorrect, BLIND display mode, PER_SUB_QUESTION timer mode

### Out of Scope

- Session runtime UI — items 10, 11
- Answer mutability UI — item 11
- Any changes to the host session or participant play pages

## UI Design

### Quiz Settings Bar

Above the question list, a settings row:

```
Display Mode: [LIVE ▾]  ← dropdown, default BLIND
```

Brief tooltip on hover: "LIVE: participants see live results. BLIND: results hidden until reveal. CODE: shows join code only."

### Question List

The quiz item list shows standalone questions and passages interleaved by `orderIndex`. Visual treatment:

- **Standalone question:** Current card design, plus a small type badge ("Single" / "Multi")
- **Passage:** A distinct card with the passage text preview, timer mode badge, and nested sub-question cards indented beneath it

### Question Editor (expanded/modal)

When editing a question:

```
Question Type: [Single-select ▾] [Multi-select ▾]

Display Mode: [Inherit from quiz ▾]  ← only shown when expanded, optional override

Question text: [____________________]

Options:
  [A] [Option text___] Points: [10]  ← green highlight if > 0
  [B] [Option text___] Points: [0]
  [C] [Option text___] Points: [-5]  ← red highlight if < 0
  [+ Add option]
```

- For SINGLE_SELECT: enforce exactly one option with pointValue > 0 (client-side validation, backed by server)
- For MULTI_SELECT: at least one option with pointValue > 0
- Default point values when creating: first option gets 10, rest get 0. Host adjusts as needed.

### Passage Editor

```
Passage Text:
[_________________________________]
[_________________________________]

Timer Mode: (•) Timer per sub-question  ( ) One timer for all
Time Limit (all): [120] seconds  ← only shown when "One timer for all" selected

Sub-questions:
  1. [Question editor card — same as above]
  2. [Question editor card]
  [+ Add sub-question]
```

### Type Definitions

Update `lib/types.ts`:

```typescript
type QuestionType = "SINGLE_SELECT" | "MULTI_SELECT";
type DisplayMode = "LIVE" | "BLIND" | "CODE_DISPLAY";
type PassageTimerMode = "PER_SUB_QUESTION" | "ENTIRE_PASSAGE";

interface Option {
  id: number;
  text: string;
  orderIndex: number;
  pointValue: number;  // replaces isCorrect
}

interface Question {
  id: number;
  text: string;
  questionType: QuestionType;
  orderIndex: number;
  timeLimitSeconds: number;
  displayModeOverride: DisplayMode | null;
  passageId: number | null;
  options: Option[];
}

interface Passage {
  id: number;
  text: string;
  orderIndex: number;
  timerMode: PassageTimerMode;
  timeLimitSeconds: number | null;
  subQuestions: Question[];
}

interface Quiz {
  id: number;
  title: string;
  orderIndex: number;
  displayMode: DisplayMode;
  questions: Question[];  // standalone questions only
  passages: Passage[];
}
```

### API Client Updates

Update `lib/apiClient.ts` with:

- `passagesApi.create(quizId, data)` — POST `/api/quizzes/{quizId}/passages`
- `passagesApi.update(id, data)` — PUT `/api/passages/{id}`
- `passagesApi.delete(id)` — DELETE `/api/passages/{id}`
- `passagesApi.addSubQuestion(passageId, data)` — POST `/api/passages/{passageId}/questions`
- Updated `quizzesApi.createQuestion` and `questionsApi.update` with new fields

## Acceptance Criteria

- [ ] Host can create single-select and multi-select questions with a type selector
- [ ] Host can set per-option point values (positive, zero, or negative)
- [ ] Host can set quiz-level display mode (default: BLIND)
- [ ] Host can override display mode per question (default: inherit)
- [ ] Host can create a passage with text, timer mode, and at least one sub-question
- [ ] Host can add/remove/reorder sub-questions within a passage
- [ ] Host can switch passage timer mode between PER_SUB_QUESTION and ENTIRE_PASSAGE
- [ ] Passages and standalone questions are visually distinct in the quiz item list
- [ ] Client-side validation matches server validation rules
- [ ] All defaults are sensible — a host who never touches scoring or display mode gets a working quiz
- [ ] TypeScript types are updated in `lib/types.ts`
