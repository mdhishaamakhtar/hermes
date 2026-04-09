# 02 — Display Mode Schema

## What This Is

Adds a `displayMode` field at the quiz level (default) and an optional per-question override, controlling what the host sees during an active session.

## Why It Is at Position 2

Display mode is a data-model concern that the quiz editor (item 04) needs to expose and the runtime (item 08) needs to enforce. The schema must exist before either.

## Prerequisites

- Item 01 (schema redesign): `Question` and `Quiz` entities must exist with their base fields.

## Scope

### In Scope

- New `DisplayMode` enum: `LIVE`, `BLIND`, `CODE_DISPLAY`
- `Quiz` gains `displayMode: DisplayMode` (non-null, default `BLIND`)
- `Question` gains `displayModeOverride: DisplayMode` (nullable — null means inherit from quiz)
- `QuizSnapshot` includes the effective display mode per question
- API responses include display mode fields

### Out of Scope

- Runtime enforcement (suppressing/allowing analytics broadcasts) — item 08
- Frontend display mode UI in the host session — item 10
- Frontend display mode UI in the quiz editor — item 04

## Schema Changes

### New Enum: `DisplayMode`

```java
public enum DisplayMode {
    LIVE,           // Show answer distribution as participants respond (current v1 behavior)
    BLIND,          // Show only question + countdown; no answer data until host reveals
    CODE_DISPLAY    // Show join code + question text only; for verbal explanation
}
```

### Modified Entity: `Quiz`

```
quizzes (modified)
├── ... existing fields ...
└── display_mode: DisplayMode (non-null, default BLIND)
```

Default is `BLIND` — the safest default for competitive quizzes. Hosts running opinion polls switch to `LIVE` explicitly.

### Modified Entity: `Question`

```
questions (modified)
├── ... existing fields ...
└── display_mode_override: DisplayMode (nullable)
```

When null, the question inherits the quiz's `displayMode`. When set, it overrides for that specific question.

### Modified: `QuizSnapshot`

Each question in the snapshot gains an `effectiveDisplayMode` field, resolved at snapshot creation time:

```json
{
  "questions": [
    {
      "id": 1,
      "effectiveDisplayMode": "BLIND",
      "..."
    },
    {
      "id": 2,
      "effectiveDisplayMode": "LIVE",
      "..."
    }
  ]
}
```

This is computed as: `question.displayModeOverride ?? quiz.displayMode`.

## Local Testing

1. **Start services:** `docker-compose up` (assumes item 01 is complete)

2. **Create a quiz via Swagger UI** (`http://localhost:8080/swagger-ui.html`):
   ```
   POST /api/events/{eventId}/quizzes
   Body: { "title": "Test", "orderIndex": 0, "displayMode": "BLIND" }
   ```
   Verify the response includes `displayMode: BLIND`.

3. **Create questions with display mode override:**
   ```
   POST /api/quizzes/{quizId}/questions
   Body: {
     "text": "Q1",
     "questionType": "SINGLE_SELECT",
     "orderIndex": 0,
     "timeLimitSeconds": 30,
     "displayModeOverride": "LIVE",
     "options": [...]
   }
   ```
   Verify the response includes `displayModeOverride: LIVE`.

4. **Verify snapshot:** Fetch the quiz via `GET /api/quizzes/{id}` and check that each question in the snapshot includes `effectiveDisplayMode` (should be "LIVE" for the override, "BLIND" for the default).

5. **Test defaults:** Create a question without specifying `displayModeOverride`. Verify it defaults to `null` and the effective mode is inherited from the quiz.

## Acceptance Criteria

- [ ] `DisplayMode` enum exists with three values
- [ ] `Quiz.displayMode` defaults to `BLIND` and persists correctly
- [ ] `Question.displayModeOverride` is nullable and persists correctly
- [ ] `QuizSnapshot` includes `effectiveDisplayMode` per question, correctly resolved
- [ ] Existing quiz/question CRUD endpoints accept and return the new fields
- [ ] Omitting display mode in create/update requests uses defaults (quiz: BLIND, question: null/inherit)
