# 01 — Schema Redesign: Question Types, Option Scoring, Passages

## What This Is

A foundational redesign of the Question, AnswerOption, and related entities to support:

- **Question types:** single-select (existing), multi-select (new)
- **Per-option scoring:** each option carries a `pointValue` (integer, positive or negative) instead of a boolean `isCorrect`
- **Passages:** a container entity holding a block of text and an ordered list of sub-questions, with a configurable timer mode

## Why It Is First

Every runtime feature (answer mutability, grading, display modes, event sessions) depends on this data model. Nothing else can be built until the schema is in place.

## Prerequisites

None. This is the foundational item.

## Database Migration

The initial schema redesign was applied by setting `spring.jpa.hibernate.ddl-auto` to `create-drop` once to rebuild the schema. It has since been switched back to `update` to preserve test data during development.

## Scope

### In Scope

- New `QuestionType` enum: `SINGLE_SELECT`, `MULTI_SELECT`
- New `pointValue: int` field on `AnswerOption` (default: 0). Replaces the boolean `isCorrect` field. An option is "correct" if `pointValue > 0`.
- New `Passage` entity with `text`, `orderIndex`, `timerMode`, and a parent reference to `Quiz`
- New `PassageTimerMode` enum: `PER_SUB_QUESTION`, `ENTIRE_PASSAGE`
- `Question` gains a nullable `passage` reference (ManyToOne). Questions without a passage are standalone. Questions with a passage are sub-questions.
- `Question` gains a `questionType` field (default: `SINGLE_SELECT`)
- `Passage` has its own `timeLimitSeconds` field (used only in `ENTIRE_PASSAGE` mode; in `PER_SUB_QUESTION` mode, each sub-question's own `timeLimitSeconds` is used)
- Update `QuizSnapshot` to include question types, point values, passage structure, and timer modes

### Out of Scope

- Runtime behavior changes (grading, answer handling) — those come in later items
- Frontend changes — item 04
- Display modes — item 02
- Answer storage changes — item 05

## Schema Changes

### New Enum: `QuestionType`

```java
public enum QuestionType {
    SINGLE_SELECT,
    MULTI_SELECT
}
```

### New Enum: `PassageTimerMode`

```java
public enum PassageTimerMode {
    PER_SUB_QUESTION,   // Each sub-question has its own timer, advanced one at a time
    ENTIRE_PASSAGE      // All sub-questions presented at once under a single timer
}
```

### New Entity: `Passage`

```
passages
├── id: Long (PK, auto)
├── quiz_id: Long (FK → quizzes, non-null)
├── text: String (TEXT, non-null) — the reading passage
├── order_index: int (non-null) — position in quiz alongside standalone questions
├── timer_mode: PassageTimerMode (non-null, default PER_SUB_QUESTION)
├── time_limit_seconds: int (nullable) — used only when timer_mode = ENTIRE_PASSAGE
└── created_at: OffsetDateTime
```

Relationship: `Quiz` has `OneToMany` to `Passage`, ordered by `orderIndex`.

### Modified Entity: `Question`

```
questions (modified)
├── ... existing fields ...
├── question_type: QuestionType (non-null, default SINGLE_SELECT)
├── passage_id: Long (FK → passages, nullable) — null for standalone questions
└── order_index: int — within the quiz (standalone) or within the passage (sub-question)
```

When `passage_id` is non-null, the question is a sub-question of that passage. Its `order_index` is relative to the passage, not the quiz. The `quiz_id` FK remains for query convenience.

### Modified Entity: `AnswerOption`

```
answer_options (modified)
├── ... existing fields ...
├── point_value: int (non-null, default 0) — replaces is_correct
└── (is_correct: removed)
```

Convention: `pointValue > 0` means the option is "correct" (for display purposes like revealing the answer). `pointValue` can be negative (trap options in multi-select). Default is 0 for incorrect options; quiz creators set positive values for correct options.

### Modified: `QuizSnapshot`

The snapshot JSON structure expands to include:

```json
{
  "questions": [
    {
      "id": 1,
      "text": "What is X?",
      "questionType": "SINGLE_SELECT",
      "orderIndex": 0,
      "timeLimitSeconds": 30,
      "passageId": null,
      "options": [
        { "id": 10, "text": "Option A", "orderIndex": 0, "pointValue": 10 },
        { "id": 11, "text": "Option B", "orderIndex": 1, "pointValue": 0 }
      ]
    }
  ],
  "passages": [
    {
      "id": 1,
      "text": "Read the following paragraph...",
      "orderIndex": 1,
      "timerMode": "ENTIRE_PASSAGE",
      "timeLimitSeconds": 120,
      "subQuestionIds": [2, 3, 4]
    }
  ]
}
```

### Indexes

- `idx_passages_quiz_id` on `passages(quiz_id)`
- `idx_questions_passage_id` on `questions(passage_id)`

## Local Testing

1. **Verify schema mode:** Ensure `spring.jpa.hibernate.ddl-auto=update` in `backend/src/main/resources/application.yaml`

2. **Start services:** From project root, run:
   ```bash
   docker-compose up
   ```
   Wait for backend to be healthy (`Spring Boot app started` in logs).

3. **Verify schema:** The new tables should exist in PostgreSQL. You can check via:
   ```bash
   docker-compose exec postgres psql -U hermes_user -d hermes -c "\dt"
   ```
   Look for: `passages`, `answer_options` (with `point_value`), `questions` (with `question_type`, `passage_id`).

4. **Test entity creation:** Start the backend and visit Swagger UI at `http://localhost:8080/swagger-ui.html`. Create a quiz with:
   - One SINGLE_SELECT question (one option with pointValue 10, one with pointValue 0)
   - One MULTI_SELECT question (two options with pointValue 10 each, one with pointValue -5)
   - One passage with two sub-questions

   All should persist without errors.

5. **Schema stability:** The current mode `update` will preserve any data created during testing.

## Acceptance Criteria

- [ ] `QuestionType` and `PassageTimerMode` enums exist and are persisted correctly
- [ ] `Passage` entity can be created, read, updated, deleted via JPA
- [ ] `Question` can reference a `Passage` (nullable FK)
- [ ] `AnswerOption.pointValue` replaces `isCorrect` — no boolean correctness field remains
- [ ] `QuizSnapshot` serialization includes question types, point values, passages, and timer modes
- [ ] Existing services that reference `isCorrect` are updated to use `pointValue > 0` (compile-clean)
- [ ] App starts cleanly with `create-drop`, schema is generated correctly, switch back to `update`
