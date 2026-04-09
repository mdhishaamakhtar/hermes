# 11 — Frontend Participant Session: Answer Mutability, Multi-Select, Passages

## What This Is

Updates the participant play page (`/app/session/[id]/play/page.tsx`) and results page to support the new question lifecycle, answer mutability, multi-select UI, passage display, and enhanced results.

## Why It Is at Position 11

Depends on all backend runtime features (items 05-09) and is paired with the host session update (item 10). The host controls must work before participant UI is updated, since the host drives the session.

## Prerequisites

- Items 01-10: All backend and host frontend complete.

## Scope

### In Scope

- New question lifecycle: DISPLAYED (read-only) → TIMED (answerable) → FROZEN → REVIEWED
- Answer mutability: participant can change selection during TIMED state
- Explicit lock-in button (optional, freezes answer early)
- Multi-select UI: multiple options selectable, visual indicators for selected state
- Single-select UI: radio-style selection (tap to select, tap another to change)
- Passage display: passage text panel + sub-questions
- ENTIRE_PASSAGE mode: all sub-questions visible, freely navigable during single timer
- PER_SUB_QUESTION mode: one sub-question at a time, passage text persists
- Score reveal after QUESTION_REVIEWED: "You scored X points"
- Leaderboard flash after each question (top 5 + your rank)
- Updated results page with point values and multi-select display

### Out of Scope

- Host UI — item 10
- Event session flow — item 14

## UI States

### DISPLAYED State (Question Shown, No Timer)

```
┌─────────────────────────────────────┐
│  Q3 / 10                           │
│                                     │
│  What is the capital of France?     │
│                                     │
│  ┌─────────┐  ┌─────────┐          │
│  │    A     │  │    B    │          │
│  │  Paris   │  │ London  │          │
│  └─────────┘  └─────────┘          │
│  ┌─────────┐  ┌─────────┐          │
│  │    C     │  │    D    │          │
│  │  Berlin  │  │ Madrid  │          │
│  └─────────┘  └─────────┘          │
│                                     │
│  Waiting for host to start timer... │
└─────────────────────────────────────┘
```

Options are visible but disabled (greyed out, not tappable). Participant can read the question while the host explains.

### TIMED State — Single-Select

```
┌─────────────────────────────────────┐
│  Q3 / 10              ⏱ 0:22       │
│                                     │
│  What is the capital of France?     │
│                                     │
│  ┌─────────┐  ┌═════════┐          │
│  │    A     │  ║    B    ║ ← selected
│  │  Paris   │  ║ London  ║          │
│  └─────────┘  └═════════┘          │
│  ┌─────────┐  ┌─────────┐          │
│  │    C     │  │    D    │          │
│  │  Berlin  │  │ Madrid  │          │
│  └─────────┘  └─────────┘          │
│                                     │
│  Tap another option to change       │
│  [ 🔒 LOCK IN ]                    │
└─────────────────────────────────────┘
```

- Tapping an option selects it (highlighted border/fill with the option's color)
- Tapping a different option deselects the current one and selects the new one
- Each selection change sends a WebSocket message with the new `selectedOptionIds`
- "Lock In" button is optional — participant can just wait for timer

### TIMED State — Multi-Select

```
┌─────────────────────────────────────┐
│  Q3 / 10              ⏱ 0:18       │
│  SELECT ALL THAT APPLY              │
│                                     │
│  Which are prime numbers?           │
│                                     │
│  ┌═════════┐  ┌─────────┐          │
│  ║ ☑  A    ║  │ ☐  B    │          │
│  ║   2     ║  │   4     │          │
│  └═════════┘  └─────────┘          │
│  ┌═════════┐  ┌─────────┐          │
│  ║ ☑  C    ║  │ ☐  D    │          │
│  ║   7     ║  │   9     │          │
│  └═════════┘  └─────────┘          │
│                                     │
│  2 selected · Tap to toggle         │
│  [ 🔒 LOCK IN ]                    │
└─────────────────────────────────────┘
```

- Tapping toggles selection on/off for each option
- Visual: checkbox-style indicators + highlighted border for selected options
- "SELECT ALL THAT APPLY" label for multi-select questions
- Selection count shown ("2 selected")
- Each toggle sends updated `selectedOptionIds` to server

### FROZEN State (Brief)

```
┌─────────────────────────────────────┐
│  Q3 / 10           TIME'S UP       │
│                                     │
│  What is the capital of France?     │
│                                     │
│  Your answer: B. London             │
│                                     │
│  Grading...                         │
└─────────────────────────────────────┘
```

Brief transitional state. Options disabled. Shows what they submitted.

### REVIEWED State

```
┌─────────────────────────────────────┐
│  Q3 / 10           RESULTS         │
│                                     │
│  What is the capital of France?     │
│                                     │
│  ✓ A. Paris        (+10 pts)        │
│  ✗ B. London  ← you  (0 pts)       │
│    C. Berlin         (0 pts)        │
│    D. Madrid         (0 pts)        │
│                                     │
│  You scored: 0 pts                  │
│                                     │
│  ── LEADERBOARD ──                  │
│  1. Alice    30 pts                 │
│  2. Bob      25 pts                 │
│  3. Carol    20 pts                 │
│  ...                                │
│  17. You     12 pts                 │
│                                     │
│  Waiting for next question...       │
└─────────────────────────────────────┘
```

- Correct options highlighted (green check)
- Participant's selection highlighted (with correct/wrong indicator)
- Point values shown per option
- Score for this question computed client-side from `optionPoints` + local selection
- Mini leaderboard: top 5 + participant's own rank
- "Waiting for next question..." until host advances

### Passage Display — PER_SUB_QUESTION

```
┌─────────────────────────────────────┐
│  PASSAGE                  ⏱ 0:22   │
│  ┌─────────────────────────────────┐│
│  │ Photosynthesis is the process   ││
│  │ by which plants convert light   ││
│  │ energy into chemical energy...  ││
│  └─────────────────────────────────┘│
│                                     │
│  Sub-question 1 / 3                 │
│  What is the primary input?         │
│                                     │
│  [A. Sunlight]  [B. Water]          │
│  [C. CO2]       [D. Soil]           │
│                                     │
│  [ 🔒 LOCK IN ]                    │
└─────────────────────────────────────┘
```

Passage text in a persistent panel at the top. Sub-questions advance one at a time below it.

### Passage Display — ENTIRE_PASSAGE

```
┌─────────────────────────────────────┐
│  PASSAGE                  ⏱ 1:42   │
│  ┌─────────────────────────────────┐│
│  │ Photosynthesis is the process   ││
│  │ by which plants convert light   ││
│  │ energy into chemical energy...  ││
│  └─────────────────────────────────┘│
│                                     │
│  Q1: What is the primary input?     │
│  [A ✓] [B] [C] [D]                 │
│                                     │
│  Q2: Select all outputs (multi)     │
│  [A ✓] [B ✓] [C] [D]              │
│                                     │
│  Q3: What drives the reaction?      │
│  [A] [B] [C ✓] [D]                 │
│                                     │
│  3/3 answered                       │
│  [ 🔒 LOCK IN ALL ]                │
└─────────────────────────────────────┘
```

All sub-questions visible simultaneously. Scrollable if needed. Single timer. Participant can answer in any order and revise freely. "Lock In All" freezes everything.

## WebSocket Subscriptions (Updated)

```
/topic/session.{id}.question → QUESTION_DISPLAYED, TIMER_START, QUESTION_FROZEN,
                                QUESTION_REVIEWED, PASSAGE_DISPLAYED, PASSAGE_FROZEN,
                                SCORING_CORRECTED, PARTICIPANT_LEADERBOARD, SESSION_END
```

**Publish destinations:**
```
/app/session/{sessionId}/answer   → { rejoinToken, questionId, selectedOptionIds }
/app/session/{sessionId}/lock-in  → { rejoinToken, questionId }
```

## State Model

```typescript
type QuestionLifecycle = "DISPLAYED" | "TIMED" | "FROZEN" | "REVIEWED";

interface ParticipantSessionState {
  sessionState: "LOBBY" | "ACTIVE" | "ENDED";
  sessionName: string;
  participantCount: number;
  
  // Question state
  questionLifecycle: QuestionLifecycle;
  question: QuestionData | null;
  passage: PassageData | null;
  
  // Answer state
  selectedOptionIds: Set<number>;  // local state, sent on change
  lockedIn: boolean;
  
  // Timer
  timeLeft: number | null;
  
  // Results (REVIEWED state)
  optionPoints: Record<string, number> | null;
  correctOptionIds: number[];
  myScore: number;  // computed client-side
  topLeaderboard: LeaderboardEntry[];
  totalParticipants: number;
  
  // For ENTIRE_PASSAGE mode
  passageAnswers: Map<number, Set<number>>;  // questionId → selectedOptionIds
}
```

## Local Testing

1. **Start services:** `docker-compose up`

2. **Participant joins session:** From `/app/join`, enter code and display name. Should be redirected to play page in LOBBY state.

3. **Host starts session:** Participant sees DISPLAYED state. Options visible but greyed out (disabled).

4. **Host starts timer:** Participant receives TIMER_START. Options become active (tappable).

5. **Test single-select:** Tap option A (highlights). Tap option B (A unhighlights, B highlights).

6. **Test multi-select:** Create multi-select question. Participant taps A (checkbox ☑). Taps B (checkbox ☑). Count shows "2 selected". Tap A again (checkbox ☐, deselected).

7. **Test answer submission:** Each tap should send WebSocket `POST /app/session/{id}/answer`. Verify no console errors.

8. **Test lock-in:** Participant clicks "🔒 LOCK IN". Further taps are ignored. Lock-in should be visually indicated (button disabled or greyed).

9. **Test freeze:** Wait for timer to expire. Options become disabled. Message shows "TIME'S UP" or similar.

10. **Test REVIEWED state:** Host grading completes. Participant sees:
    - ✓ correct options highlighted
    - ✗ wrong options if selected
    - "You scored: 10 pts"
    - Mini leaderboard (top 5 + own rank)

11. **Test passage display:** For PER_SUB_QUESTION passage, passage text should persist in a sticky panel above changing sub-questions. For ENTIRE_PASSAGE, all sub-questions visible below passage text with scrolling.

12. **Test rejoin:** Mid-session, refresh page. Should re-authenticate with rejoinToken, resume from current question state.

13. **Test SCORING_CORRECTED:** Host corrects answers. If participant is on results screen, score should update live.

## Acceptance Criteria

- [ ] Participant sees question in DISPLAYED state — options visible but disabled
- [ ] Options become active only after TIMER_START
- [ ] Single-select: tapping an option selects it; tapping another switches selection
- [ ] Multi-select: tapping toggles; "SELECT ALL THAT APPLY" label shown; selection count displayed
- [ ] Each selection change sends updated `selectedOptionIds` via WebSocket
- [ ] "Lock In" button freezes answer — subsequent taps are ignored
- [ ] After QUESTION_FROZEN, options are disabled
- [ ] After QUESTION_REVIEWED, correct answers and point values are shown
- [ ] Participant's own score computed client-side from optionPoints + local selection
- [ ] Mini leaderboard shown (top 5 + own rank)
- [ ] Passage text persists across sub-questions (PER_SUB_QUESTION mode)
- [ ] All sub-questions shown simultaneously in ENTIRE_PASSAGE mode
- [ ] SCORING_CORRECTED events update displayed scores in real-time
- [ ] Rejoin logic handles new lifecycle states correctly
