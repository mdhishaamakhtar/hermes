# 08 — Display Mode Runtime Enforcement

## What This Is

Wires the display mode (LIVE, BLIND, CODE_DISPLAY) from the quiz snapshot into the WebSocket broadcast logic, controlling what the host sees during each question's lifecycle.

## Why It Is at Position 8

Depends on the display mode schema (item 02), the question lifecycle (item 06), and the grading engine (item 07). The runtime behavior controls which WebSocket messages the host receives and when.

## Prerequisites

- Items 01-07: All foundational features (schema, lifecycle, grading).

## Scope

### In Scope

- Suppress/allow `ANSWER_UPDATE` broadcasts based on effective display mode
- BLIND mode: host sees question + timer + participant count, but no answer distribution until the question is frozen and graded
- CODE_DISPLAY mode: host sees join code + question text only during TIMED state
- LIVE mode: current v1 behavior (answer distribution streams in real-time)
- Host-triggered reveal in BLIND mode (explicit "Show Results" action after freeze)
- Display mode included in `QUESTION_DISPLAYED` event so the host UI knows which mode to render

### Out of Scope

- Frontend rendering of display modes — item 10
- Quiz editor for setting display modes — already done in item 04

## Behavior by Mode

### LIVE Mode

No change from current behavior:

| Lifecycle State | Host Sees |
|-----------------|-----------|
| DISPLAYED | Question text, options, "Start Timer" button |
| TIMED | Question + live answer distribution (ANSWER_UPDATE streams) + timer |
| FROZEN | Grading results (QUESTION_REVIEWED) + final distribution |
| REVIEWING | Full results + leaderboard + "Next" button |

### BLIND Mode

| Lifecycle State | Host Sees |
|-----------------|-----------|
| DISPLAYED | Question text, options, "Start Timer" button |
| TIMED | Question + timer + total answered count (no per-option breakdown) |
| FROZEN | Grading results + full distribution revealed |
| REVIEWING | Full results + leaderboard + "Next" button |

In BLIND mode during TIMED state:
- `ANSWER_UPDATE` is still broadcast but with `counts` omitted (or set to empty). Only `totalAnswered` and `totalParticipants` are sent.
- After FROZEN + grading, the full `ANSWER_UPDATE` with counts is sent once as a reveal.

### CODE_DISPLAY Mode

| Lifecycle State | Host Sees |
|-----------------|-----------|
| DISPLAYED | Join code (large) + question text (smaller, for reference) |
| TIMED | Join code + question text + timer |
| FROZEN | Same as BLIND — grading results + full distribution |
| REVIEWING | Full results + leaderboard + "Next" button |

In CODE_DISPLAY mode during DISPLAYED and TIMED states:
- `ANSWER_UPDATE` suppressed entirely
- Host UI shows the join code prominently (for projection/screen sharing while explaining verbally)
- After FROZEN, same reveal behavior as BLIND

## WebSocket Changes

### Updated: `QUESTION_DISPLAYED`

Includes effective display mode:

```json
{
  "event": "QUESTION_DISPLAYED",
  "questionId": 42,
  "effectiveDisplayMode": "BLIND",
  "..."
}
```

### Updated: `ANSWER_UPDATE` (conditional)

In LIVE mode: full counts as today.

In BLIND mode:
```json
{
  "event": "ANSWER_UPDATE",
  "questionId": 42,
  "counts": {},
  "totalAnswered": 15,
  "totalParticipants": 30,
  "totalLockedIn": 10
}
```

In CODE_DISPLAY mode: not sent during TIMED state.

### New: `ANSWER_REVEAL` (BLIND/CODE_DISPLAY modes only)

Sent after grading, contains the full answer distribution:

```json
{
  "event": "ANSWER_REVEAL",
  "questionId": 42,
  "counts": { "10": 15, "11": 8, "12": 12 },
  "totalAnswered": 23,
  "totalParticipants": 30
}
```

## Service Changes

### Updated: `SessionEngine.broadcastAnswerUpdate()`

Before broadcasting, check the effective display mode for the current question (from snapshot):

```java
DisplayMode mode = snapshot.getEffectiveDisplayMode(questionId);
switch (mode) {
    case LIVE -> broadcastFullAnswerUpdate(...);
    case BLIND -> broadcastBlindAnswerUpdate(...);  // counts omitted
    case CODE_DISPLAY -> { /* no broadcast during TIMED */ }
}
```

### Updated: Grading flow

After grading completes, regardless of display mode, broadcast `ANSWER_REVEAL` with full counts. This ensures the host always sees the final distribution after the question is over.

## Local Testing

1. **Start services:** `docker-compose up`

2. **Create three quizzes with different display modes:**
   - Quiz 1: `displayMode: LIVE`
   - Quiz 2: `displayMode: BLIND`
   - Quiz 3: `displayMode: CODE_DISPLAY`

3. **Run Quiz 1 (LIVE):** Host should see live answer distribution during TIMED state.
   - Subscribe to `/topic/session.{sid}.analytics`
   - Verify `ANSWER_UPDATE` events include full `counts` during TIMED state

4. **Run Quiz 2 (BLIND):** Host should NOT see counts during TIMED state.
   - During TIMED: `ANSWER_UPDATE` should have empty `counts`, only `totalAnswered`/`totalParticipants`
   - After grading: `ANSWER_REVEAL` event sent with full counts

5. **Run Quiz 3 (CODE_DISPLAY):** Host should see only join code during TIMED state.
   - During TIMED: no `ANSWER_UPDATE` broadcast at all
   - After grading: `ANSWER_REVEAL` sent with full counts
   - Host UI should display large join code (tested in item 10)

6. **Test per-question override:** Set Quiz 1 (LIVE) with one question override to BLIND. Verify that question hides counts during timer, not others.

7. **Verify participant experience:** Regardless of host display mode, participants should not see others' answers. They see only their own selection and correct answers after grading.

## Acceptance Criteria

- [ ] LIVE mode: answer distribution streams to host in real-time (unchanged)
- [ ] BLIND mode: only totalAnswered/totalParticipants sent during timer; full counts revealed after grading
- [ ] CODE_DISPLAY mode: no answer data during timer; revealed after grading
- [ ] `QUESTION_DISPLAYED` includes `effectiveDisplayMode`
- [ ] `ANSWER_REVEAL` event sent after grading for BLIND and CODE_DISPLAY modes
- [ ] Display mode is read from the snapshot (per-question override resolved at snapshot time)
- [ ] Participant experience is identical regardless of display mode (they never see others' answers during timer anyway)
