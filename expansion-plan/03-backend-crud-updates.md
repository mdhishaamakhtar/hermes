# 03 — Backend CRUD Updates for New Question Types

## What This Is

Updates the REST API layer (controllers, services, DTOs) to support creating and managing multi-select questions, per-option scoring, passages with sub-questions, and display mode settings.

## Why It Is at Position 3

The schema (items 01-02) must exist first. The frontend quiz editor (item 04) depends on these APIs. No runtime behavior changes yet — this is purely management CRUD.

## Prerequisites

- Item 01: Schema redesign (entities exist)
- Item 02: Display mode schema (displayMode fields exist)

## Scope

### In Scope

- Updated `CreateQuestionRequest` / `UpdateQuestionRequest` DTOs with `questionType`, `options[].pointValue`
- New `PassageController` or expanded `QuestionController` for passage CRUD
- `CreatePassageRequest`: text, orderIndex, timerMode, timeLimitSeconds (for ENTIRE_PASSAGE mode), sub-questions (inline or separate)
- `UpdatePassageRequest`: same fields, plus ability to add/remove/reorder sub-questions
- Updated `QuizResponse` to include display mode and passages
- Updated `QuestionResponse` to include questionType, displayModeOverride, passageId, and options with pointValue
- Validation rules (see below)
- Ownership checks on all new endpoints

### Out of Scope

- Frontend UI — item 04
- Session/runtime behavior — items 05+
- Answer storage changes — item 05

## API Changes

### Questions

**POST** `/api/quizzes/{quizId}/questions` (updated)

```json
{
  "text": "Select all prime numbers",
  "questionType": "MULTI_SELECT",
  "orderIndex": 2,
  "timeLimitSeconds": 30,
  "displayModeOverride": null,
  "options": [
    { "text": "2", "orderIndex": 0, "pointValue": 10 },
    { "text": "4", "orderIndex": 1, "pointValue": -5 },
    { "text": "7", "orderIndex": 2, "pointValue": 10 },
    { "text": "9", "orderIndex": 3, "pointValue": 0 }
  ]
}
```

- `questionType` defaults to `SINGLE_SELECT` if omitted
- `pointValue` defaults to `0` if omitted
- `displayModeOverride` defaults to `null` if omitted

**PUT** `/api/questions/{id}` (updated) — same body shape.

### Passages

**POST** `/api/quizzes/{quizId}/passages`

```json
{
  "text": "Read the following paragraph about photosynthesis...",
  "orderIndex": 3,
  "timerMode": "ENTIRE_PASSAGE",
  "timeLimitSeconds": 120,
  "subQuestions": [
    {
      "text": "What is the primary input?",
      "questionType": "SINGLE_SELECT",
      "orderIndex": 0,
      "timeLimitSeconds": 30,
      "options": [
        { "text": "Sunlight", "orderIndex": 0, "pointValue": 10 },
        { "text": "Water", "orderIndex": 1, "pointValue": 0 }
      ]
    },
    {
      "text": "Select all outputs",
      "questionType": "MULTI_SELECT",
      "orderIndex": 1,
      "timeLimitSeconds": 30,
      "options": [
        { "text": "Oxygen", "orderIndex": 0, "pointValue": 10 },
        { "text": "Glucose", "orderIndex": 1, "pointValue": 10 },
        { "text": "Carbon dioxide", "orderIndex": 2, "pointValue": -5 }
      ]
    }
  ]
}
```

- Creates the passage and all sub-questions in a single transaction
- `timeLimitSeconds` on the passage is required when `timerMode` is `ENTIRE_PASSAGE`, ignored when `PER_SUB_QUESTION`
- Sub-question `timeLimitSeconds` is required when `timerMode` is `PER_SUB_QUESTION`, ignored when `ENTIRE_PASSAGE`

**PUT** `/api/passages/{id}`

Updates passage text, timer mode, time limit. Sub-questions are managed individually via the existing question endpoints (they have a `passageId` FK).

**DELETE** `/api/passages/{id}`

Cascades to all sub-questions.

**POST** `/api/passages/{passageId}/questions`

Adds a new sub-question to an existing passage. Same body as a normal question create, but the question is linked to the passage.

### Quiz Response (updated)

**GET** `/api/quizzes/{id}` now returns:

```json
{
  "id": 1,
  "title": "Biology Quiz",
  "orderIndex": 0,
  "displayMode": "BLIND",
  "questions": [ ... ],
  "passages": [
    {
      "id": 1,
      "text": "Read the following...",
      "orderIndex": 3,
      "timerMode": "ENTIRE_PASSAGE",
      "timeLimitSeconds": 120,
      "subQuestions": [ ... ]
    }
  ]
}
```

The response includes both standalone questions and passages (with their sub-questions nested). The consumer merges them by `orderIndex` to get the full quiz order.

## Validation Rules

- `SINGLE_SELECT` questions must have exactly one option with `pointValue > 0`
- `MULTI_SELECT` questions must have at least one option with `pointValue > 0`
- All questions must have at least 2 options
- `ENTIRE_PASSAGE` passages must have `timeLimitSeconds > 0`
- `PER_SUB_QUESTION` passages must have each sub-question's `timeLimitSeconds > 0`
- Passage must have at least 1 sub-question on creation
- `orderIndex` values must be unique within their scope (quiz-level for standalone questions and passages, passage-level for sub-questions)

## Local Testing

1. **Start services:** `docker-compose up` (assumes items 01-02 complete)

2. **Test multi-select question creation:**
   ```
   POST /api/quizzes/{quizId}/questions
   Body: {
     "text": "Select all prime numbers",
     "questionType": "MULTI_SELECT",
     "orderIndex": 0,
     "timeLimitSeconds": 30,
     "options": [
       { "text": "2", "pointValue": 10 },
       { "text": "4", "pointValue": -5 },
       { "text": "7", "pointValue": 10 }
     ]
   }
   ```
   Verify response includes `questionType: "MULTI_SELECT"` and options with pointValue.

3. **Test passage creation:**
   ```
   POST /api/quizzes/{quizId}/passages
   Body: {
     "text": "Read the following...",
     "orderIndex": 1,
     "timerMode": "ENTIRE_PASSAGE",
     "timeLimitSeconds": 120,
     "subQuestions": [
       {
         "text": "Q1",
         "questionType": "SINGLE_SELECT",
         "options": [{ "text": "A", "pointValue": 10 }, ...]
       }
     ]
   }
   ```
   Verify response includes passage with nested sub-questions.

4. **Test validation:** Try creating a SINGLE_SELECT question with two correct options (pointValue > 0). Should fail with validation error.

5. **Test GET quiz:** `GET /api/quizzes/{id}` should return both `questions` and `passages` arrays with proper nesting.

## Acceptance Criteria

- [ ] Questions can be created with `questionType` and `options[].pointValue`
- [ ] Passages can be created with inline sub-questions in a single request
- [ ] Sub-questions can be added to / removed from existing passages
- [ ] Passages can be deleted (cascading to sub-questions)
- [ ] Quiz response includes passages with nested sub-questions
- [ ] Validation rules are enforced with clear error messages
- [ ] All new endpoints require authentication and pass ownership checks
- [ ] Existing question create/update still works when `questionType` and `pointValue` are omitted (defaults apply)
