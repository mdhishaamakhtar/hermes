# Batch 3 Fixes — God Class Splits

High-risk refactors. All items below are pending. Batch 1 and Batch 2 are complete.

---

## Item 5 — WebSocket broadcasting mixed into business logic (Backend)

**Files:** `SessionEngine.java`, `GradingService.java`, `ParticipantService.java`

**Problem:** All three classes inject `SimpMessagingTemplate` directly and call `messaging.convertAndSend(...)` inline with business logic.

**Fix:**
- Long-term: extract a `SessionEventPublisher` interface with methods like `publishQuestionStart(...)`, `publishLeaderboard(...)`, etc.
- Medium-term acceptable: consolidate all `messaging.convertAndSend` calls into `SessionEngine` only — `GradingService` and `ParticipantService` should delegate broadcast calls to `SessionEngine` or the publisher.

---

## Item 6 — `useReducer` in host and play pages (Frontend)

**Files:** `frontend/app/session/[id]/host/page.tsx`, `frontend/app/session/[id]/play/page.tsx`

**Problem:** Each page has 18+ `useState` calls. WebSocket message handlers update 6+ state vars per event, causing multiple re-renders per message.

**Fix:** Replace all related `useState` calls with `useReducer` and typed action union:
```ts
type SessionAction =
  | { type: 'QUESTION_DISPLAYED'; payload: ... }
  | { type: 'TIMER_START'; payload: ... }
  | { type: 'ANSWER_LOCKED' }
  | { type: 'SESSION_END'; payload: ... }
  // etc.
```
Each WebSocket message handler dispatches a single action instead of multiple `setState` calls.

---

## Item 9 — `SessionEngine.java` god class (Backend)

**File:** `backend/src/main/java/dev/hishaam/hermes/service/SessionEngine.java`

**Problem:** ~8 distinct responsibilities in one class.

**Split into:**
- `SessionLifecycleService` — owns `advanceSessionInternal`, `doEndSession`, `updateDbCurrentQuestion`
- `SessionTimerOrchestrator` — owns `startTimerInternal`, `onTimerExpired`
- `PassageDisplayHelper` — self-contained: `displayEntirePassage`, `findLastSubQuestion`
- Keep `SessionEngine` as a thin coordinator, or rename to `SessionBroadcastService` and move all broadcast methods there

---

## Item 10 — `host/page.tsx` and `play/page.tsx` god components (Frontend)

**Files:** `frontend/app/session/[id]/host/page.tsx`, `frontend/app/session/[id]/play/page.tsx`

**Problem:** Each is ~1000 lines mixing WebSocket subscription logic, timer management, state handling, and rendering.

**Split into:**
- `useHostSession(sessionId)` hook — owns all state, WebSocket subscriptions, timers, and handlers; returns only what the component needs to render
- `usePlaySession(sessionId)` hook — same pattern for the participant side
- Page components become thin shells: call the hook, render the result
- Extract `QuestionCard`, `ScoringDrawer`, `CardBadge` from `host/page.tsx` → `frontend/components/session/` (these are already identified as inline components to extract per item 7, which is part of this same refactor)

**Note:** Item 7 (extract inline components) is a prerequisite sub-task within item 10. `QuestionCard`, `CardBadge`, and `ScoringDrawer` are currently defined as module-level functions inside the page file and must be moved to `components/session/` before or during the hook extraction.
