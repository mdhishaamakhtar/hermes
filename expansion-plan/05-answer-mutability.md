# 05 — Answer Mutability: Replace-on-Submit Model

## What This Is

Replaces the current "first answer wins" model with a "last answer before freeze wins" model. Participants can change their answer freely until the timer expires or they explicitly lock in. Also changes answer storage from a single `optionId` to a set of `selectedOptionIds` to support multi-select.

## Why It Is at Position 5

Depends on the schema (item 01) for question types. Must precede runtime features (items 06-09) because the new answer lifecycle (mutable until frozen) is foundational to manual timer start, grading, and display modes.

## Prerequisites

- Items 01-04: Schema, display modes, and CRUD endpoints in place.
- Quizzes must be creatable and sessions must be launchable from the frontend or Swagger UI.

## Scope

### In Scope

- Replace `ParticipantAnswer` schema: single `optionId` → join table of selected option IDs
- Change unique constraint from `(participant_id, question_id)` to allow updates
- Add `lockedIn: boolean` flag per participant per question
- Add `frozenAt: OffsetDateTime` — set when timer expires or participant locks in
- Change `ON CONFLICT DO NOTHING` to `ON CONFLICT DO UPDATE` (upsert)
- Update WebSocket answer handler to accept a list of option IDs
- Update Redis answer count tracking: decrement old selections, increment new ones on re-submit
- Add lock-in endpoint/message
- Add freeze logic: reject answers after timer expiry or lock-in

### Out of Scope

- Frontend UI for answer changing / lock-in — item 11
- Grading logic — item 07
- Timer lifecycle changes — item 06

## Schema Changes

### Redesigned: `ParticipantAnswer`

The current single-row-per-answer model is replaced:

```
participant_answers (redesigned)
├── id: Long (PK, auto)
├── session_id: Long (non-null)
├── participant_id: Long (non-null)
├── question_id: Long (non-null)
├── locked_in: boolean (non-null, default false)
├── frozen_at: OffsetDateTime (nullable) — set on lock-in or timer expiry
├── answered_at: OffsetDateTime (non-null) — last submission time
└── UNIQUE(participant_id, question_id)
```

### New Join Table: `participant_answer_selections`

```
participant_answer_selections
├── participant_answer_id: Long (FK → participant_answers)
├── option_id: Long (FK → answer_options)
└── PK(participant_answer_id, option_id)
```

This stores the set of selected options for each answer. For single-select, it's always one row. For multi-select, it's multiple rows. On re-submission, the entire set is replaced.

## WebSocket Protocol Changes

### Updated: Answer Submission

**Client → Server:** `/app/session/{sessionId}/answer`

```json
{
  "rejoinToken": "abc123",
  "questionId": 42,
  "selectedOptionIds": [10, 12]
}
```

Changed from `optionId: Long` to `selectedOptionIds: List<Long>`.

### New: Lock-In

**Client → Server:** `/app/session/{sessionId}/lock-in`

```json
{
  "rejoinToken": "abc123",
  "questionId": 42
}
```

Sets `lockedIn = true` and `frozenAt = now()`. Subsequent answer submissions for this question are rejected.

### Updated: Answer Update Broadcast

**Server → Host:** `/topic/session.{sessionId}.analytics` — `ANSWER_UPDATE`

```json
{
  "event": "ANSWER_UPDATE",
  "questionId": 42,
  "counts": { "10": 15, "11": 8, "12": 12 },
  "totalAnswered": 23,
  "totalParticipants": 30,
  "totalLockedIn": 18
}
```

Added `totalLockedIn` so the host knows how many participants have committed.

## Redis Changes

### Answer Count Updates on Re-Submit

When a participant re-submits:

1. Load their previous selection set from Redis: `session:{sid}:question:{qid}:participant:{pid}` (a Redis SET)
2. Decrement counts for previously selected options
3. Increment counts for newly selected options
4. Store the new selection set

New Redis key: `session:{sid}:question:{qid}:participant:{pid}` — SET of option IDs (current selection for this participant). TTL matches session TTL.

### Leaderboard on Re-Submit

Leaderboard is NOT updated on re-submit during the mutable window. Leaderboard scoring happens only at freeze time (item 07). During the mutable window, the leaderboard reflects scores from previous (already frozen) questions only.

## Server-Side Answer Flow

```
1. Receive answer submission (selectedOptionIds)
2. Validate: session is ACTIVE, question is current question
3. Check freeze: if participant is locked in OR timer has expired → reject (409)
4. Upsert ParticipantAnswer:
   - INSERT ... ON CONFLICT(participant_id, question_id) DO UPDATE SET answered_at = now()
   - DELETE FROM participant_answer_selections WHERE participant_answer_id = ?
   - INSERT INTO participant_answer_selections (answer_id, option_id) VALUES ...
5. Update Redis counts (decrement old, increment new)
6. Broadcast ANSWER_UPDATE to host analytics topic
```

## Local Testing

1. **Start services:** `docker-compose up`

2. **Create and start a session:** Via Swagger UI or the frontend, create a quiz and start a session.

3. **Join as participant:** Use the join code to join from a separate browser/window.

4. **Submit and re-submit an answer:** During TIMED state, submit an answer (single-select). Immediately submit a different answer. Verify both submissions go through (both POST requests return 200).

5. **Check counts:** Subscribe to `/topic/session.{sid}.analytics` and verify that `ANSWER_UPDATE` events show the correct counts. After re-submit, counts should reflect the new answer (old option count decreases, new option count increases).

6. **Test lock-in:** Submit an answer, then POST `/api/sessions/{id}/lock-in`. Try submitting another answer — should receive 409 (Conflict).

7. **Test multi-select:** Create a MULTI_SELECT question, submit `selectedOptionIds: [1, 2]`, then resubmit `selectedOptionIds: [2, 3]`. Verify counts update correctly.

8. **Verify database:** Check `participant_answer_selections` table — should have one row per selected option per participant. Old selections should be deleted on re-submit.

## Acceptance Criteria

- [ ] Participants can submit an answer and then change it before freeze
- [ ] Re-submission correctly updates both PostgreSQL and Redis counts (no double-counting)
- [ ] Lock-in sets `lockedIn = true` and `frozenAt`, subsequent submissions are rejected with 409
- [ ] Timer expiry freezes all answers for that question (no submissions accepted after)
- [ ] Multi-select: participants can select multiple option IDs in a single submission
- [ ] Single-select: server validates that exactly one option ID is submitted for SINGLE_SELECT questions
- [ ] `ANSWER_UPDATE` broadcast includes `totalLockedIn`
- [ ] Redis stores per-participant selection sets for correct count tracking on re-submit
- [ ] Leaderboard is NOT updated during the mutable window (deferred to grading in item 07)
