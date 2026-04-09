# 14 — Frontend Event Session Flow

## What This Is

Full host and participant UI for the event session lifecycle: event lobby, quiz progression, inter-quiz screens, cumulative leaderboard, and final results.

## Why It Is at Position 14

Depends on the EventSession model (item 12) and cumulative leaderboard (item 13). This is the capstone item — everything else must be working.

## Prerequisites

- Items 01-13: All backend and single-quiz frontend complete.

## Scope

### In Scope

- Event session creation flow (from event detail page)
- Event lobby page (host): join code, participant list, "Start Event" button
- Event lobby page (participant): waiting screen after joining
- Inter-quiz screen (host): per-quiz results summary, cumulative leaderboard, "Start Next Quiz" button
- Inter-quiz screen (participant): cumulative standing, waiting for next quiz
- Quiz-within-event flow: reuses existing host/participant session pages with event context
- Final event results page (host): cumulative leaderboard with per-quiz breakdown table
- Final event results page (participant): personal cumulative results
- Event session join flow: participant enters event join code, joins once for all quizzes
- Rejoin handling for event-scoped tokens

### Out of Scope

- Standalone quiz sessions — already working, unchanged
- Quiz editor — item 04
- Per-quiz runtime — items 10, 11

## New Pages

### `/app/event-session/[id]/host/page.tsx` — Host Event Control

The host's command center for the event. Cycles through states:

**EVENT LOBBY:**
```
┌─────────────────────────────────────┐
│  SCIENCE OLYMPICS                   │
│                                     │
│  JOIN CODE                          │
│  X7K29M            [ Copy ]        │
│                                     │
│  Participants: 28                   │
│                                     │
│  Quizzes in this event:             │
│  1. Biology (10 questions)          │
│  2. Chemistry (8 questions)         │
│  3. Physics (12 questions)          │
│                                     │
│  [ START EVENT → ]                  │
└─────────────────────────────────────┘
```

**QUIZ ACTIVE:**

Redirects to / embeds the existing host session page (`/app/session/[quizSessionId]/host`), wrapped with an event context banner showing:
- Event name
- "Quiz 1 of 3: Biology"
- Cumulative leaderboard toggle

When the quiz ends, the host is returned to the event control page.

**INTER-QUIZ SCREEN:**
```
┌─────────────────────────────────────┐
│  SCIENCE OLYMPICS — Quiz 1 Complete │
│                                     │
│  Biology Results                    │
│  1. Alice  30pts                    │
│  2. Bob    25pts                    │
│  3. Carol  22pts                    │
│                                     │
│  ── CUMULATIVE STANDINGS ──         │
│  1. Alice  30pts (30)               │
│  2. Bob    25pts (25)               │
│  3. Carol  22pts (22)               │
│                                     │
│  Next: Chemistry (8 questions)      │
│                                     │
│  [ START NEXT QUIZ → ]              │
└─────────────────────────────────────┘
```

**EVENT ENDED:**
```
┌─────────────────────────────────────┐
│  SCIENCE OLYMPICS — FINAL RESULTS   │
│                                     │
│  ── CUMULATIVE LEADERBOARD ──       │
│                                     │
│  Rank  Name    Bio  Chem  Phys  Total
│  1.    Alice   30   25    30    85  │
│  2.    Bob     25   28    25    78  │
│  3.    Carol   22   20    28    70  │
│  ...                                │
│                                     │
│  28 participants · 3 quizzes        │
│                                     │
│  [ VIEW DETAILED REVIEW → ]        │
└─────────────────────────────────────┘
```

### `/app/event-session/[id]/play/page.tsx` — Participant Event View

**EVENT LOBBY:**
```
┌─────────────────────────────────────┐
│  SCIENCE OLYMPICS                   │
│                                     │
│  Welcome, Alice!                    │
│                                     │
│  28 participants joined             │
│                                     │
│  Waiting for host to start...       │
└─────────────────────────────────────┘
```

**QUIZ ACTIVE:**

Redirects to / embeds the existing participant play page, wrapped with event context.

**INTER-QUIZ (waiting):**
```
┌─────────────────────────────────────┐
│  SCIENCE OLYMPICS                   │
│                                     │
│  Biology — Complete!                │
│  Your score: 22 pts (Rank #5)       │
│                                     │
│  ── CUMULATIVE ──                   │
│  Your total: 22 pts (Rank #5)       │
│  Leader: Alice (30 pts)             │
│                                     │
│  Next up: Chemistry                 │
│  Waiting for host...                │
└─────────────────────────────────────┘
```

**EVENT ENDED:**
```
┌─────────────────────────────────────┐
│  SCIENCE OLYMPICS — FINAL           │
│                                     │
│  Your Results                       │
│  Total: 65 pts — Rank #5 of 28     │
│                                     │
│  Biology:    22 pts (8/10 correct)  │
│  Chemistry:  18 pts (5/8 correct)   │
│  Physics:    25 pts (9/12 correct)  │
│                                     │
│  ── TOP 5 ──                        │
│  1. Alice  85pts                    │
│  2. Bob    78pts                    │
│  3. Carol  70pts                    │
│  4. Dave   68pts                    │
│  5. Eve    66pts                    │
└─────────────────────────────────────┘
```

### `/app/event-session/[id]/results/page.tsx` — Event Results (Participant)

Detailed personal results page with per-quiz breakdown.

### `/app/event-session/[id]/review/page.tsx` — Event Review (Host)

Detailed review with tabs: cumulative leaderboard, per-quiz breakdown, individual quiz question analysis.

## Join Flow Update

The existing join page (`/app/join/page.tsx`) handles both event and standalone join codes. After `POST /api/sessions/join`:

- If response `type` is `"event"`: redirect to `/event-session/{eventSessionId}/play`
- If response `type` is `"standalone"` (or current behavior): redirect to `/session/{sessionId}/play`

localStorage key for event rejoin: `hermes_rejoin_event_{eventSessionId}`

## WebSocket Subscriptions

Participants subscribe to:

```
/topic/eventsession.{esid}.control → EVENT_QUIZ_STARTED, EVENT_QUIZ_ENDED, 
                                      EVENT_ENDED, CUMULATIVE_LEADERBOARD_UPDATE,
                                      PARTICIPANT_JOINED
```

When a quiz starts, additionally subscribe to per-quiz topics as in items 10/11.

## State Model

```typescript
type EventSessionState = "LOBBY" | "QUIZ_ACTIVE" | "INTER_QUIZ" | "ENDED";

interface EventSessionHostState {
  eventTitle: string;
  status: EventSessionState;
  joinCode: string;
  participantCount: number;
  quizzes: { id: number; title: string; questionCount: number; status: string }[];
  currentQuizIndex: number;
  currentQuizSessionId: number | null;
  cumulativeLeaderboard: CumulativeLeaderboardEntry[];
  lastQuizLeaderboard: LeaderboardEntry[];
}

interface CumulativeLeaderboardEntry {
  rank: number;
  displayName: string;
  cumulativeScore: number;
  quizScores: number[];
}

interface EventSessionParticipantState {
  eventTitle: string;
  status: EventSessionState;
  participantCount: number;
  currentQuizTitle: string | null;
  currentQuizSessionId: number | null;
  myRank: number;
  myCumulativeScore: number;
  myQuizScores: { quizTitle: string; score: number }[];
  topLeaderboard: CumulativeLeaderboardEntry[];
}
```

## API Client Updates

```typescript
eventSessionsApi = {
  create: (eventId: number) => Promise<ApiResponse<{ id: number; joinCode: string }>>
  start: (id: number) => Promise<ApiResponse<void>>
  startQuiz: (id: number) => Promise<ApiResponse<void>>
  end: (id: number) => Promise<ApiResponse<void>>
  lobby: (id: number) => Promise<ApiResponse<EventLobbyState>>
  status: (id: number) => Promise<ApiResponse<EventSessionStatus>>
  results: (id: number) => Promise<ApiResponse<EventResults>>
  myResults: (id: number, rejoinToken: string) => Promise<ApiResponse<MyEventResults>>
}
```

## Local Testing

1. **Start services:** `docker-compose up`

2. **Host creates event session:** Navigate to Event detail page (e.g., `/app/events/1`). Click "Create Event Session". Verify redirect to event session host page.

3. **Event lobby (host):** Verify display:
   - Event title
   - Join code (6-char, copyable)
   - Participant count (0 initially)
   - Quiz list (Quizzes 1, 2, 3)
   - "START EVENT" button

4. **Participants join:** 3+ participants use `/app/join`, enter event code. See event lobby:
   - Event title
   - "Welcome, [name]!"
   - Participant count (updates live)
   - "Waiting for host to start..."

5. **Host starts event:** Host clicks "START EVENT". Status changes to ACTIVE. First quiz becomes available.

6. **Host starts Q1:** Host clicks "START QUIZ". Redirected to Q1 host session page with event context banner ("SCIENCE OLYMPICS — Quiz 1 of 3: Biology").

7. **Q1 runs:** Normal quiz lifecycle (items 10-11). Host and participants interact as normal.

8. **Q1 ends:** After final question review, host is returned to inter-quiz screen:
   - "Quiz 1 Complete"
   - Q1 leaderboard (top 3)
   - Cumulative leaderboard (currently matches Q1 since only one quiz done)
   - "Next: Chemistry"
   - "START NEXT QUIZ" button

9. **Participants inter-quiz:** See:
   - Quiz 1 score and rank
   - Cumulative standing (rank + score)
   - "Waiting for host to start Quiz 2..."

10. **Q2 and Q3 run:** Repeat for quizzes 2 and 3. After each, inter-quiz screen updates cumulative leaderboard with running totals.

11. **Event ends:** After Q3, host sees final results:
    - Event title + "FINAL RESULTS"
    - Cumulative leaderboard table:
      ```
      Rank  Name    Q1   Q2   Q3  Total
      1.    Alice   25   30   20   75
      2.    Bob     20   28   25   73
      ```
    - "VIEW DETAILED REVIEW" button

12. **Participant final results:** See personal cumulative results:
    - Name, rank, total score
    - Per-quiz breakdown (Q1: 25pts, Q2: 30pts, Q3: 20pts)
    - Top 5 leaderboard

13. **Host review page:** Click "VIEW DETAILED REVIEW" → `/app/event-session/[id]/review`. Show tabs: cumulative leaderboard, per-quiz breakdown, individual quiz question analysis (same as item 10's host review).

14. **Rejoin test:** Mid-event, participant refreshes. Should rejoin with event token, resume in current quiz or inter-quiz screen as appropriate.

15. **Route test:** Create two join codes (one event, one standalone quiz). Verify `/app/join` routes to correct session type afterward.

## Acceptance Criteria

- [ ] Host can create an event session from the event detail page
- [ ] Event lobby shows join code, participant count, and quiz list
- [ ] Participants join with event code and see event lobby
- [ ] Host starts event → first quiz is available to start
- [ ] During quiz: host/participant pages work as in items 10/11 with event context banner
- [ ] After quiz ends: inter-quiz screen shows quiz results + cumulative leaderboard
- [ ] Host presses "Start Next Quiz" to begin the next quiz
- [ ] After all quizzes: final results page shows cumulative leaderboard with per-quiz breakdown
- [ ] Participant final results show personal score breakdown per quiz
- [ ] Join page correctly routes to event or standalone session based on join code type
- [ ] Rejoin with event-scoped token resumes correctly in any event state
- [ ] Cumulative leaderboard updates live via WebSocket
- [ ] All event session pages follow the Hermes design system (dark mode, design tokens, animations)
