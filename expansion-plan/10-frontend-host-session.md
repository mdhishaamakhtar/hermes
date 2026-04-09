# 10 — Frontend Host Session: New Question Lifecycle + Display Modes

## What This Is

Updates the host session page (`/app/session/[id]/host/page.tsx`) to support the new question lifecycle (manual timer start, review window), display mode rendering, answer correction UI, and passage display.

## Why It Is at Position 10

Depends on all backend runtime features (items 05-09). This is the first frontend runtime item — the host needs controls before participants need UI.

## Prerequisites

- Items 01-09: All backend features complete and tested.

## Scope

### In Scope

- New question lifecycle UI: DISPLAYED → TIMED → FROZEN → REVIEWING states
- "Start Timer" button (only shown in DISPLAYED state)
- "End Timer Early" button (optional, during TIMED state)
- Review window: correct answers revealed, score breakdown, "explain the answer" pause
- "Next Question" button (only in REVIEWING state)
- Display mode rendering:
  - LIVE: real-time answer distribution bars (current behavior)
  - BLIND: total answered count only during timer; full distribution after freeze
  - CODE_DISPLAY: large join code + question text during timer; full distribution after freeze
- Answer correction UI: edit option point values during REVIEWING or ENDED state
- Passage display: passage text shown persistently, sub-question progression
- ENTIRE_PASSAGE mode: all sub-questions visible with combined results
- Updated leaderboard with tiebreaker-aware ranking
- Multi-select answer distribution display

### Out of Scope

- Participant UI — item 11
- Event session flow — item 14
- Quiz editor — already done in item 04

## UI States

### DISPLAYED State

```
┌─────────────────────────────────────┐
│  Q3 / 10          Display: BLIND    │
│                                     │
│  What is the capital of France?     │
│                                     │
│  A. Paris     B. London             │
│  C. Berlin    D. Madrid             │
│                                     │
│  [ START TIMER (30s) ]              │
│                                     │
│  Participants: 28                   │
└─────────────────────────────────────┘
```

Host sees the question and options. Timer not started. Participants see the question but can't answer yet. Host explains verbally, then presses "Start Timer."

### TIMED State — LIVE Mode

```
┌─────────────────────────────────────┐
│  Q3 / 10    ⏱ 0:18     LIVE        │
│                                     │
│  What is the capital of France?     │
│                                     │
│  A. Paris    ████████████ 15        │
│  B. London   ████ 4                │
│  C. Berlin   ██ 2                  │
│  D. Madrid   █ 1                   │
│                                     │
│  22/28 answered · 18 locked in      │
│                                     │
│  [ END TIMER EARLY ]                │
└─────────────────────────────────────┘
```

### TIMED State — BLIND Mode

```
┌─────────────────────────────────────┐
│  Q3 / 10    ⏱ 0:18     BLIND       │
│                                     │
│  What is the capital of France?     │
│                                     │
│  A. Paris     B. London             │
│  C. Berlin    D. Madrid             │
│                                     │
│  22/28 answered · 18 locked in      │
│                                     │
│  [ END TIMER EARLY ]                │
└─────────────────────────────────────┘
```

No answer distribution. Just total counts.

### TIMED State — CODE_DISPLAY Mode

```
┌─────────────────────────────────────┐
│                                     │
│          JOIN CODE                  │
│          X7K29M                     │
│                                     │
│  Q3: What is the capital of France? │
│                                     │
│  ⏱ 0:18                            │
└─────────────────────────────────────┘
```

Large join code for projection. Question text for reference.

### REVIEWING State

```
┌─────────────────────────────────────┐
│  Q3 / 10         RESULTS           │
│                                     │
│  What is the capital of France?     │
│                                     │
│  A. Paris ✓  ████████████ 15 (+10)  │
│  B. London   ████ 4         (0)    │
│  C. Berlin   ██ 2           (0)    │
│  D. Madrid   █ 1            (0)    │
│                                     │
│  [ ✏ Edit Scoring ]                │
│                                     │
│  LEADERBOARD                        │
│  1. Alice  30pts                    │
│  2. Bob    25pts                    │
│  3. Carol  20pts                    │
│                                     │
│  [ NEXT QUESTION → ]               │
└─────────────────────────────────────┘
```

### Correction Modal

When host clicks "Edit Scoring":

```
┌─────────────────────────────────────┐
│  Edit Scoring — Q3                  │
│                                     │
│  A. Paris      Points: [ 10 ]       │
│  B. London     Points: [  0 ]       │
│  C. Berlin     Points: [  0 ]       │
│  D. Madrid     Points: [  0 ]       │
│                                     │
│  [ Cancel ]  [ Save & Recalculate ] │
└─────────────────────────────────────┘
```

On save: PATCH `/api/sessions/{id}/questions/{qid}/scoring`. Leaderboard updates live.

### Passage Display (PER_SUB_QUESTION)

Passage text shown above the current sub-question in a persistent panel. Sub-questions advance one at a time with the same lifecycle.

### Passage Display (ENTIRE_PASSAGE)

Passage text shown at top. All sub-questions listed below with their individual answer distributions. Single timer for all. Review shows all sub-question results at once.

## WebSocket Subscriptions (Updated)

```
/topic/session.{id}.question    → QUESTION_DISPLAYED, TIMER_START, QUESTION_FROZEN, 
                                   QUESTION_REVIEWED, PASSAGE_DISPLAYED, PASSAGE_FROZEN,
                                   SCORING_CORRECTED, PARTICIPANT_LEADERBOARD, SESSION_END
/topic/session.{id}.analytics   → ANSWER_UPDATE, ANSWER_REVEAL, LEADERBOARD_UPDATE, SESSION_END
/topic/session.{id}.control     → PARTICIPANT_JOINED
```

## State Model

```typescript
type QuestionLifecycle = "DISPLAYED" | "TIMED" | "FROZEN" | "REVIEWING";

interface HostSessionState {
  sessionStatus: "LOBBY" | "ACTIVE" | "ENDED";
  joinCode: string;
  participantCount: number;
  questionLifecycle: QuestionLifecycle;
  effectiveDisplayMode: DisplayMode;
  
  // Current question (or passage)
  currentQuestion: QuestionMsg | null;
  currentPassage: PassageMsg | null;  // non-null for passages
  
  // Answer tracking
  counts: Record<string, number>;
  totalAnswered: number;
  totalLockedIn: number;
  
  // Timer
  timeLeft: number;
  
  // Results (REVIEWING state)
  correctOptionIds: number[];
  optionPoints: Record<string, number>;
  leaderboard: LeaderboardEntry[];
  
  // Final
  finalLeaderboard: LeaderboardEntry[] | null;
}
```

## Local Testing

1. **Start services:** `docker-compose up`

2. **Host login and create session:** Navigate to `/dashboard`, create a quiz with mixed question types (single, multi, passage), create a session.

3. **Test DISPLAYED state:** Host sees "Start Timer" button, question text, options. Participant joins but cannot select options.

4. **Test TIMED state:** Host clicks "Start Timer". Verify countdown appears. Timer starts for participants (if they haven't already clicked options pre-timer, they can now).

5. **Test LIVE mode:** Create LIVE mode quiz. Host should see live answer bars updating in real-time.

6. **Test BLIND mode:** Create BLIND mode quiz. During timer, host should see "22/28 answered · 18 locked in" but NO answer distribution. After timer, full counts should appear.

7. **Test CODE_DISPLAY mode:** During timer, host should see large join code (X7K29M) + question text, no answer data.

8. **Test REVIEWING state:** After timer expires, host sees correct answers (checkmarks), point values per option, answer distribution, and leaderboard. "Next Question" button appears.

9. **Test edit scoring:** Host clicks "✏ Edit Scoring", modal opens. Change point values, save. Leaderboard should update live.

10. **Test passage:** Create passage with 3 sub-questions. In PER_SUB_QUESTION mode, host sees one sub-question at a time with passage text above. In ENTIRE_PASSAGE mode, all 3 are visible with single timer.

## Acceptance Criteria

- [ ] Host sees "Start Timer" button in DISPLAYED state — question visible, no timer running
- [ ] Timer starts only when host clicks "Start Timer"
- [ ] Host can end timer early during TIMED state
- [ ] LIVE mode shows real-time answer distribution during timer
- [ ] BLIND mode shows only answered/locked-in counts during timer, reveals after freeze
- [ ] CODE_DISPLAY mode shows large join code during timer, reveals after freeze
- [ ] REVIEWING state shows correct answers, point values, distribution, and leaderboard
- [ ] "Edit Scoring" opens correction modal, saves via PATCH, leaderboard updates live
- [ ] "Next Question" only available in REVIEWING state
- [ ] Passage text persists across sub-questions (PER_SUB_QUESTION mode)
- [ ] All sub-questions shown simultaneously (ENTIRE_PASSAGE mode)
- [ ] Multi-select distributions display correctly (multiple options can be "correct")
