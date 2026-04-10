# Code Cleanup Batches

Use this as the handoff plan after the Batch 3 cleanup. It covers the concrete cleanup backlog from the current codebase pass, not every possible style or micro-refactor.

Work in order. Each batch should be small enough to review and verify independently. Avoid mechanical package moves until the behavior-adjacent splits are done.

## Before Expansion Items 12-14

Do these before starting the last three expansion-plan items (`12-event-session-model`, `13-cumulative-leaderboard`, `14-frontend-event-session`):

- Batch 1, because item 14 introduces `hermes_rejoin_event_{eventSessionId}` and mixed standalone/event join routing. Centralized session storage should exist before adding another token namespace.
- Batch 2, because item 14 reuses or wraps host/play session pages with event context. Extracting `useHostSession` and `usePlaySession` first avoids threading event state through 1500-2000 line route files.
- Batch 5, because items 12 and 13 add event-level WebSocket topics. Finish the publisher boundary before adding `eventsession.{id}.control` messages.
- Batch 6, because item 13 depends on score aggregation, answer correction recomputation, and leaderboard projection. Extract scoring/result rules before building cumulative event scoring on top.
- Batch 8's participant identity/token parts, because item 12 needs event-scoped rejoin tokens and a join endpoint that can resolve standalone vs event joins. At minimum, extract `ParticipantRejoinTokenStore` or equivalent before implementing event participants.
- Batch 8's leaderboard/time store parts, because item 13 needs event cumulative leaderboard and cumulative time Redis structures. It is safer to add event stores beside a narrowed session leaderboard store than into the current broad `SessionLiveStateService`.

Can wait until after expansion items 12-14:

- Batch 3 render-section extraction, if Batch 2 already made the session pages behavior-light.
- Batch 4 quiz editor cleanup, unless item 14 work touches quiz editor launch/create-entry points heavily.
- Batch 7 full `SessionEngine` split, unless event quiz start needs to call deeper lifecycle internals directly. Keep the facade if it lets event sessions reuse the existing quiz lifecycle without churn.
- Batch 9 package/naming moves and Batch 10 DTO grouping. These are mechanical and should not be mixed with the event-session feature work.

## Current State

- Backend session broadcast sends are mostly behind `SessionEventPublisher`.
- `AnswerWebSocketHandler` still sends user-specific answer ACK/reject messages directly through `SimpMessagingTemplate`.
- Frontend host/play session pages already use reducers, but the route files still contain data loading, subscriptions, timers, handlers, and large render branches.
- `frontend/app/session/[id]/play/page.tsx` still defines an inline participant `QuestionCard`.
- `SessionEngine`, `SessionLiveStateService`, and the quiz editor files remain the largest cleanup targets.

## Batch 1 - Shared Storage And Small Frontend Extractions

Goal: reduce repeated client storage and move isolated components without changing session flow.

Files:

- `frontend/app/join/page.tsx`
- `frontend/app/session/[id]/host/page.tsx`
- `frontend/app/session/[id]/play/page.tsx`
- `frontend/app/session/[id]/results/page.tsx`
- `frontend/lib/session-storage.ts`
- `frontend/components/session/`

Tasks:

- Add `frontend/lib/session-storage.ts` for `hermes_session_*` and `hermes_rejoin_*` keys.
- Replace direct localStorage key construction in join, host, play, and results pages with the helper.
- Extract the participant `QuestionCard` from `frontend/app/session/[id]/play/page.tsx` into `frontend/components/session/ParticipantQuestionCard.tsx`, or adapt the existing session `QuestionCard` if the prop model stays clean.
- Extract `QuestionResultCard` from `frontend/app/session/[id]/results/page.tsx` into `frontend/components/session/QuestionResultCard.tsx`.

Verification:

```bash
cd frontend
bunx tsc --noEmit
bun run lint
bun run format
```

## Batch 2 - Session Page Hooks

Goal: make host/play route files thin enough that later render-component extraction is low risk.

Files:

- `frontend/app/session/[id]/host/page.tsx`
- `frontend/app/session/[id]/play/page.tsx`
- `frontend/features/session/host/`
- `frontend/features/session/play/`
- `frontend/features/session/shared/`

Create:

```text
frontend/features/session/host/
  useHostSession.ts
  host-session-reducer.ts
  host-session-types.ts

frontend/features/session/play/
  usePlaySession.ts
  play-session-reducer.ts
  play-session-types.ts

frontend/features/session/shared/
  session-message-types.ts
  session-view-models.ts
```

Tasks:

- Move reducer state/actions out of the route files.
- Move WebSocket subscriptions, timers, API handlers, and sync logic into `useHostSession(sessionId)` and `usePlaySession(sessionId)`.
- Keep `host/page.tsx` and `play/page.tsx` as render shells that call the hook and render returned view state/actions.

Verification:

```bash
cd frontend
bunx tsc --noEmit
bun run lint
bun run format
```

## Batch 3 - Session Render Components

Goal: split large render branches after the hooks own behavior.

Files:

- `frontend/app/session/[id]/host/page.tsx`
- `frontend/app/session/[id]/play/page.tsx`
- `frontend/components/session/`
- `frontend/features/session/host/`
- `frontend/features/session/play/`

Host candidates:

- `HostLobbyView`
- `HostLiveView`
- `HostEndedView`
- `HostTimerPanel`
- `HostLeaderboardPanel`
- `HostControlsPanel`

Play candidates:

- `PlayLobbyView`
- `PlayLiveView`
- `PlayPassagePanel`
- `PlayAnswerStatePanel`
- `PlayLeaderboardPanel`
- `PlaySessionDetailsPanel`

Rules:

- Keep reusable visual components in `frontend/components/session/`.
- Put feature-specific render sections beside the hooks under `frontend/features/session/`.
- Do not change WebSocket or timer behavior in this batch.

Verification:

```bash
cd frontend
bunx tsc --noEmit
bun run lint
bun run format
```

## Batch 4 - Quiz Editor Frontend Cleanup

Goal: reduce the next-largest frontend state/render modules after the session pages.

Files:

- `frontend/components/quizzes/QuestionCard.tsx`
- `frontend/components/quizzes/PassageCard.tsx`
- `frontend/components/quizzes/useQuizEditor.ts`
- `frontend/components/quizzes/`

Tasks:

- Split `QuestionCard.tsx`: extract `QuestionEditForm` and a small edit-state hook such as `useQuestionEditDraft`.
- Split `PassageCard.tsx`: extract `PassageEditForm`, `SubQuestionComposer`, and a passage edit-state hook.
- Split `useQuizEditor.ts`: keep it as a facade, but move pure quiz tree mutations into `quiz-editor-state.ts`.
- Move session launch/abandon commands out of `useQuizEditor.ts` into a narrower helper or hook so quiz editing and session lifecycle actions are not coupled in one hook.

Verification:

```bash
cd frontend
bunx tsc --noEmit
bun run lint
bun run format
```

## Batch 5 - Backend WebSocket Boundary

Goal: finish the publisher boundary before splitting deeper session services.

Files:

- `backend/src/main/java/dev/hishaam/hermes/ws/AnswerWebSocketHandler.java`
- `backend/src/main/java/dev/hishaam/hermes/service/SessionEventPublisher.java`
- Optional: `backend/src/main/java/dev/hishaam/hermes/service/AnswerEventPublisher.java`

Tasks:

- Move `AnswerWebSocketHandler` user-specific answer ACK/reject sends behind `SessionEventPublisher` or a dedicated `AnswerEventPublisher`.
- Keep the handler responsible for WebSocket routing and exception mapping only.
- Verify direct `SimpMessagingTemplate` usage is limited to publisher classes/configuration.

Verification:

```bash
cd backend
./mvnw spotless:check
./mvnw test
```

## Batch 6 - Backend Scoring And Result Boundaries

Goal: separate scoring rules and result projection before changing session orchestration.

Files:

- `backend/src/main/java/dev/hishaam/hermes/service/GradingService.java`
- `backend/src/main/java/dev/hishaam/hermes/service/SessionResultsService.java`
- `backend/src/main/java/dev/hishaam/hermes/service/SessionService.java`
- New service/projector files as needed.

Tasks:

- Extract shared score/correctness rules from `GradingService` and `SessionResultsService` into `AnswerScoringService`.
- Keep result DTO assembly in a dedicated projector such as `SessionResultsProjector`.
- Move scoring correction orchestration out of `SessionService` into `ScoringCorrectionService` or fold it into `GradingService`.
- Keep database queries in the existing repositories; this batch should not change schema or persistence contracts.

Verification:

```bash
cd backend
./mvnw spotless:check
./mvnw test
```

## Batch 7 - Backend Session Orchestration Split

Goal: split `SessionEngine` after scoring/publisher boundaries are stable.

Files:

- `backend/src/main/java/dev/hishaam/hermes/service/SessionEngine.java`
- `backend/src/main/java/dev/hishaam/hermes/service/SessionService.java`
- New session orchestration services as needed.

Extract:

- `SessionLifecycleService` - `advanceSessionInternal`, `doEndSession`, `updateDbCurrentQuestion`
- `SessionTimerOrchestrator` - `startTimerInternal`, `onTimerExpired`
- `PassageDisplayHelper` - `displayEntirePassage`, `findLastSubQuestion`
- `SessionSnapshotFactory` or equivalent - `SessionService.buildSnapshot`, `toPassageSnapshot`, `resolveEffectiveDisplayMode`

Rules:

- Keep `SessionEngine` temporarily as a coordinator/facade for existing callers.
- Do not rename or remove `SessionEngine` in the same batch as the extraction.
- Preserve transaction boundaries explicitly; the original reason for `SessionEngine` was cross-bean `@Transactional` behavior.

Verification:

```bash
cd backend
./mvnw spotless:check
./mvnw test
```

## Batch 8 - Backend Redis State Boundaries

Goal: split the Redis god class after orchestration callers are clearer.

Files:

- `backend/src/main/java/dev/hishaam/hermes/service/SessionLiveStateService.java`
- `backend/src/main/java/dev/hishaam/hermes/service/ParticipantService.java`
- `backend/src/main/java/dev/hishaam/hermes/service/SessionRedisHelper.java`
- New Redis store services as needed.

Tasks:

- Split `SessionLiveStateService` into narrower stores. Candidate boundaries:
  - `SessionStateStore` for status/current question/current passage/question lifecycle.
  - `SessionTimerStateStore` for timer TTL, timer start time, and sequence.
  - `SessionParticipantStateStore` for participant count, names, and rejoin context pieces.
  - `SessionAnswerStatsStore` for counts, selected options, answered sets, and lock-in sets.
  - `SessionLeaderboardStore` for leaderboard scores and cumulative time.
- Move rejoin-token Redis caching out of `ParticipantService` into `ParticipantRejoinTokenStore` or `ParticipantIdentityService`.
- Move rejoin response assembly out of `ParticipantService` into `ParticipantRejoinViewBuilder` after token lookup is separated.

Verification:

```bash
cd backend
./mvnw spotless:check
./mvnw test
```

## Batch 9 - Mechanical Package And Naming Cleanup

Goal: do import-heavy moves only after the underlying boundaries are stable.

Backend package move:

```text
backend/src/main/java/dev/hishaam/hermes/service/session/
  SessionService.java
  SessionEngine.java or SessionCoordinator.java
  SessionLifecycleService.java
  SessionTimerOrchestrator.java
  PassageDisplayHelper.java
  SessionEventPublisher.java
  SessionLiveStateService.java or narrower stores
  SessionRedisHelper.java or SessionRedisKeys.java
  SessionSnapshotService.java
  SessionSnapshotFactory.java
  SessionTimerScheduler.java
  SessionResultsService.java
  SessionCodeService.java
```

Optional naming:

- `SessionEngine` -> `SessionCoordinator`, if it remains after extraction.
- `SessionRedisHelper` -> `SessionRedisKeys`, if it mostly owns key/TTL construction.
- `SessionLiveStateService` -> `SessionLiveStateStore`, only if it remains as a Redis-backed persistence facade after the split.
- `components/session/QuestionCard.tsx` -> `SessionQuestionCard.tsx`, only if imports become confusing beside `components/quizzes/QuestionCard.tsx`.

Verification:

```bash
cd backend
./mvnw spotless:check
./mvnw test
cd ../frontend
bunx tsc --noEmit
bun run lint
bun run format
```

## Batch 10 - Optional DTO Grouping

Goal: improve backend navigation with a mechanical import-only move.

Only do this after earlier backend batches settle:

```text
backend/src/main/java/dev/hishaam/hermes/dto/session/
backend/src/main/java/dev/hishaam/hermes/dto/ws/
```

Rules:

- Keep this as a mechanical move/import PR.
- Do not combine with behavior changes.

Verification:

```bash
cd backend
./mvnw spotless:check
./mvnw test
```

## General Verification Notes

- Backend tests require a JDK that supports the project target in `backend/pom.xml`; `java.version` is currently `25`.
- Prefer `spotless:check` during investigation and `spotless:apply` only when you intend to write formatting changes.
- After each batch, check direct infrastructure usage with targeted greps such as:

```bash
rg -n "SimpMessagingTemplate|convertAndSend" backend/src/main/java/dev/hishaam/hermes
rg -n "StringRedisTemplate" backend/src/main/java/dev/hishaam/hermes/service
rg -n "localStorage|getItem\\(|setItem\\(|removeItem\\(" frontend/app frontend/components frontend/lib
```
