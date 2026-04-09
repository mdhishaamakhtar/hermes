# 06 — Manual Timer Start + Post-Question Review Flow

## What This Is

Changes the question lifecycle from "launch question → timer starts immediately → auto-advance" to a host-controlled flow:

1. **Display:** Host advances to a question. It's shown to participants but the timer hasn't started. Host explains verbally.
2. **Timer start:** Host presses "Start timer." Countdown begins for participants. Answers are accepted.
3. **Timer expires:** Answers freeze. Server-side grading runs (item 07). Results broadcast.
4. **Review:** Host sees results and has an "explain the answer" window. Participants see their score for this question.
5. **Advance:** Host presses "Next" to move to the next question. Cycle repeats.

## Why It Is at Position 6

Depends on answer mutability (item 05) — the mutable answer window is bounded by timer start and timer expiry. Must precede grading (item 07) because the grading trigger is defined here (timer expiry or host manual advance during timer).

## Prerequisites

- Items 01-05: Schema, CRUD, and answer mutability complete.
- WebSocket infrastructure working (participants can join and see messages).

## Scope

### In Scope

- New question lifecycle states and WebSocket events
- Manual timer start API endpoint
- Updated Quartz timer scheduling (timer starts on host command, not on question display)
- Post-question review state (between timer expiry and next question)
- Passage lifecycle: both PER_SUB_QUESTION and ENTIRE_PASSAGE modes

### Out of Scope

- Grading logic (score computation) — item 07
- Display mode enforcement — item 08
- Frontend UI — items 10, 11
- Answer correction — item 09

## Question Lifecycle States

```
DISPLAYED → TIMED → FROZEN → REVIEWING
    │          │        │         │
    │          │        │         └─ Host presses "Next" → next question DISPLAYED
    │          │        └─ Grading runs, results broadcast
    │          └─ Timer expires OR host ends timer early
    └─ Host presses "Start Timer"
```

For passages in `ENTIRE_PASSAGE` mode, all sub-questions enter each state simultaneously.
For passages in `PER_SUB_QUESTION` mode, each sub-question follows the lifecycle independently.

## WebSocket Protocol Changes

### New Events (Server → All Clients)

**`QUESTION_DISPLAYED`** — replaces current `QUESTION_START`

Sent when host advances to a question. Timer has NOT started. Participants see the question but cannot answer yet.

```json
{
  "event": "QUESTION_DISPLAYED",
  "questionId": 42,
  "text": "What is the capital of France?",
  "questionType": "SINGLE_SELECT",
  "options": [
    { "id": 10, "text": "Paris", "orderIndex": 0 },
    { "id": 11, "text": "London", "orderIndex": 1 }
  ],
  "questionIndex": 3,
  "totalQuestions": 10,
  "passage": null
}
```

For a passage sub-question in `PER_SUB_QUESTION` mode, includes passage context:

```json
{
  "event": "QUESTION_DISPLAYED",
  "questionId": 43,
  "text": "What is the primary input?",
  "questionType": "SINGLE_SELECT",
  "options": [...],
  "questionIndex": 4,
  "totalQuestions": 10,
  "passage": {
    "id": 1,
    "text": "Read the following paragraph about photosynthesis..."
  }
}
```

**`PASSAGE_DISPLAYED`** — sent for `ENTIRE_PASSAGE` mode only

All sub-questions are sent at once:

```json
{
  "event": "PASSAGE_DISPLAYED",
  "passageId": 1,
  "passageText": "Read the following paragraph...",
  "subQuestions": [
    {
      "questionId": 43,
      "text": "What is the primary input?",
      "questionType": "SINGLE_SELECT",
      "options": [...]
    },
    {
      "questionId": 44,
      "text": "Select all outputs",
      "questionType": "MULTI_SELECT",
      "options": [...]
    }
  ],
  "questionIndex": 4,
  "totalQuestions": 10
}
```

**`TIMER_START`** — host started the timer

```json
{
  "event": "TIMER_START",
  "questionId": 42,
  "timeLimitSeconds": 30
}
```

For `ENTIRE_PASSAGE` mode:

```json
{
  "event": "TIMER_START",
  "passageId": 1,
  "timeLimitSeconds": 120
}
```

**`QUESTION_FROZEN`** — replaces current `QUESTION_END`

Timer expired (or host ended timer early). Answers are now frozen. Grading will follow.

```json
{
  "event": "QUESTION_FROZEN",
  "questionId": 42
}
```

For `ENTIRE_PASSAGE` mode:

```json
{
  "event": "PASSAGE_FROZEN",
  "passageId": 1,
  "subQuestionIds": [43, 44]
}
```

**`QUESTION_REVIEWED`** — grading results broadcast (detailed in item 07)

Sent after grading completes. Contains correct answers and per-participant scores. The host is now in the "explain the answer" window.

**`SESSION_END`** — unchanged.

### Retired Events

- `QUESTION_START` → replaced by `QUESTION_DISPLAYED` + `TIMER_START`
- `QUESTION_END` → replaced by `QUESTION_FROZEN` + `QUESTION_REVIEWED`

### New API Endpoints

**POST** `/api/sessions/{id}/start-timer`

Host triggers timer start for the current question (or passage). Only valid when the current question is in DISPLAYED state.

**POST** `/api/sessions/{id}/next` — existing endpoint, updated behavior

Now only valid when the current question is in REVIEWING state (after grading). Advances to the next question in DISPLAYED state.

**POST** `/api/sessions/{id}/start` — existing endpoint, updated behavior

Transitions session from LOBBY to ACTIVE and displays the first question (DISPLAYED state). Timer does NOT start.

## Redis State Changes

### New Key: Question Lifecycle State

`session:{sid}:question_state` — string, one of: `DISPLAYED`, `TIMED`, `FROZEN`, `REVIEWING`

Updated at each lifecycle transition. Used to validate incoming answer submissions (only accepted during `TIMED` state).

### Timer Scheduling

Timer is now scheduled when the host calls `/start-timer`, not when the question is displayed. The Quartz job fires on expiry and transitions the state to `FROZEN`.

## Passage Progression Logic

### PER_SUB_QUESTION Mode

Sub-questions are treated as individual questions in the quiz progression. The passage text persists as context. The lifecycle is:

```
Display sub-question 1 (with passage) → Timer → Freeze → Review → 
Display sub-question 2 (with passage) → Timer → Freeze → Review → ...
```

The host advances through sub-questions just like standalone questions.

### ENTIRE_PASSAGE Mode

All sub-questions are displayed and timed together:

```
Display passage + all sub-questions → Timer (single countdown) → Freeze all → Review all → Advance
```

Participants see all sub-questions simultaneously and can answer/change any of them during the timer. On freeze, all sub-questions are graded together. The review screen shows results for all sub-questions at once.

## Local Testing

1. **Start services:** `docker-compose up`

2. **Create and start a session:** Use Swagger UI or frontend to create a quiz and start a session.

3. **Watch participant experience:** Join as participant. Subscribe to `/topic/session.{sid}.question`.

4. **Host displays question:** Host advances to first question (or calls `POST /api/sessions/{id}/next`). Verify participant receives `QUESTION_DISPLAYED` event (question visible, no timer).

5. **Host starts timer:** Host calls `POST /api/sessions/{id}/start-timer`. Verify participant receives `TIMER_START` event and countdown begins. Answers should be accepted now.

6. **Test answer acceptance:** Participant submits answer during TIMED state — should succeed (200). Verify via `ANSWER_UPDATE` event.

7. **Wait for timeout:** Let the timer expire. Verify participant receives `QUESTION_FROZEN` event.

8. **Test answer rejection:** Participant tries to submit after freeze — should receive 409 (Conflict).

9. **Test passage modes:** Repeat with a SINGLE_PASSAGE mode quiz (all sub-questions at once) and a PER_SUB_QUESTION passage (one at a time). Verify proper nesting in events.

10. **Host advances:** Host calls `POST /api/sessions/{id}/next` (only valid during REVIEWING state). Verify next question goes to DISPLAYED state.

## Acceptance Criteria

- [ ] Questions enter DISPLAYED state when advanced to — timer does not start
- [ ] Host can start timer via `/start-timer` endpoint — transitions to TIMED
- [ ] Answers are only accepted during TIMED state
- [ ] Timer expiry transitions to FROZEN state and triggers grading
- [ ] Host can advance to next question only from REVIEWING state
- [ ] `QUESTION_DISPLAYED`, `TIMER_START`, `QUESTION_FROZEN` events are broadcast correctly
- [ ] `PASSAGE_DISPLAYED` sent for ENTIRE_PASSAGE mode with all sub-questions
- [ ] PER_SUB_QUESTION passages advance through sub-questions individually
- [ ] ENTIRE_PASSAGE passages display/time/freeze all sub-questions together
- [ ] Session start displays first question without starting timer
- [ ] Existing `QUESTION_START` and `QUESTION_END` events are fully replaced
