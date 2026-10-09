# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hermes is a real-time live quiz/polling platform. Organizers create events and quizzes; anonymous participants join sessions and answer questions in real time via WebSocket.

## Commands

### Full Stack (Docker Compose)
```bash
docker-compose up          # Start all services (postgres, redis, backend, frontend)
```

### Backend
```bash
cd backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=local   # Run (requires postgres + redis on localhost)
./mvnw clean package       # Build JAR
./mvnw test                # Run tests
./mvnw spotless:apply      # Format code (Google Java Format — run before committing)
./mvnw spotless:check      # Check formatting
```

### Frontend
```bash
cd frontend
bun run dev                # Dev server at http://localhost:3000
bun run build              # Production build
bun run lint               # ESLint auto-fix
bun run format             # Prettier auto-fix
```

## Architecture

### Tech Stack
- **Backend:** Spring Boot 4.0.8, Java 25, PostgreSQL 17, Redis 7, STOMP WebSockets, JWT auth
- **Frontend:** Next.js 16.3, React 19, TypeScript, Tailwind CSS 4, Motion, `@stomp/stompjs`

### Session Lifecycle
```
LOBBY → ACTIVE → ENDED
```
- **LOBBY:** Participants join anonymously; organizer waits.
- **ACTIVE:** Questions advance one-by-one (timer or manual). Answers submitted via WebSocket.
- **ENDED:** Leaderboard shown; results available for review.

### Authentication
- **Organizers** authenticate with JWT, stored in `localStorage` as `hermes_token` and mirrored in a same-name cookie that only `frontend/proxy.ts` reads: it sends signed-out requests for organiser routes to `/auth/login?next=…` and signed-in visits to `/auth/*` to the dashboard. Both are written/cleared together via `frontend/lib/auth.ts`. A ky `beforeRequest` hook (`frontend/lib/api.ts`) attaches the token; player calls pass `skipAuth`. A 401 on an authenticated request clears the token and notifies `OrganiserShell`, which drops the SWR cache and routes to login; after signing in the organiser returns to the page they were on. Validated on STOMP handshake via `StompChannelInterceptor`.
- **Participants** are anonymous. They receive a rejoin token on `POST /api/sessions/join`, stored in `localStorage` as `hermes_rejoin_{sessionId}`.

### WebSocket Communication (STOMP)
- **Broker mode:** `STOMP_BROKER_MODE` selects `simple` (default, in-process, no external
  service) or `relay` (external STOMP broker via `BROKER_RELAY_*`). Switching is config-only.
  The simple broker keeps subscriptions in the process holding the WebSocket, so it is correct
  for a single instance only — running more than one replica requires `relay`.
- **Endpoint:** `/ws-hermes`
- **Client → Server:** `/app/session/{sessionId}/answer` (submit or change an answer) and `/app/session/{sessionId}/lock-in`; both have HTTP fallbacks the player uses when no acknowledgement arrives within 2s. `StompChannelInterceptor` refuses a client SEND to anything outside `/app/**`, so clients cannot publish to topics
- **Server → Client subscriptions:**
  - `/topic/session.{sessionId}.question` — lifecycle events (`QUESTION_DISPLAYED`, `PASSAGE_DISPLAYED`, `TIMER_START`, `QUESTION_FROZEN`, `PASSAGE_FROZEN`, `QUESTION_REVIEWED`, `SCORING_CORRECTED`, `SESSION_END`), plus `PARTICIPANT_JOINED`, `ANSWER_UPDATE`, `ANSWER_REVEAL` and `PARTICIPANT_LEADERBOARD` repeated for players
  - `/topic/session.{sessionId}.analytics` — answer counts, `LEADERBOARD_UPDATE`, and `SESSION_END` with final standings (organizer only)
  - `/user/queue/answers` — a player's own `ANSWER_ACCEPTED` / `ANSWER_REJECTED` acknowledgements

The wire types live in `frontend/features/session/session-types.ts`. The connection is managed by `frontend/features/session/useStompClient.ts`: exponential reconnect from 500ms to 5s, 10s heartbeats both ways (the simple broker beats too; the client ticks from a worker so background throttling spares it), an immediate reconnect when the tab returns or the network comes back — including when the socket still claims to be open but has heard nothing for 15s — and subscriptions replayed on every reconnect.

Live screens mix REST snapshots with STOMP events through `frontend/features/session/live-sync.ts`: overlapping resyncs collapse into one follow-up, and events that land while a snapshot is in flight are replayed on top of it, so a snapshot never undoes newer news. The player keeps any pick or lock-in the server hasn't confirmed when a snapshot lands; the host reads the session back after every control instead of waiting on the socket, and a control refused because the screen was stale (409) just catches up.

### State Split: PostgreSQL vs Redis
- **PostgreSQL:** Users, Events, Quizzes, Questions, Sessions, Participants, Answers (persistent). Scores and standings are always derived from the graded answers here.
- **Redis:** Active session state, current question index, timers, live answer tallies (ephemeral, removed on session end).

### Key Backend Services
| Service | Responsibility |
|---|---|
| `session/SessionService` | Organizer-facing session API: authorizes every call, validates lifecycle preconditions, delegates transitions to `SessionEngine` |
| `session/SessionEngine` | Transactional state machine: session start, question display/advance, timer start and expiry, session end. No auth checks — callers authorize first and invoke cross-bean so `@Transactional` applies |
| `session/SessionTransitions` | Per-session Redis lock held across each lifecycle transition (host controls and timer expiry), so overlapping presses take effect once and the rest are refused with 409 |
| `session/SessionTimerScheduler` | Schedules and cancels the per-session Quartz job that fires `jobs/SessionTimeoutJob` on timer expiry |
| `session/SessionSnapshotService` | Builds, serializes, and loads the quiz snapshot frozen at session creation |
| `session/SessionEventPublisher` | All STOMP broadcasts; drops messages silently while the broker is offline |
| `session/SessionResultsService` | Post-session results and per-participant results, computed purely from PostgreSQL |
| `GradingService` + `ScoreCalculator` | Grading orchestration (persist, broadcast) and the stateless scoring math it calls |
| `LeaderboardService` | The single source of standings — live, at session end, and on the results pages — ranked from PostgreSQL by score, then answer time |
| `AnswerService` | Answer submission and lock-in during a live session |
| `ParticipantService` | Anonymous join/rejoin logic and rejoin-token management |
| `OwnershipService` | Ensures organizers can only manage their own resources |
| `util/SessionRedisKeys` | Static Redis key builders and the shared session/rejoin TTLs |
| `repository/redis/SessionStateRedisRepository` | Live state: status, current question/passage, lifecycle, participant count, timer, sequence, snapshot JSON, join-code reservations |
| `repository/redis/SessionScoringRedisRepository` | Live tallies per question: option counts, who has answered, who has locked in |
| `repository/redis/ParticipantRejoinTokenRedisRepository` | Rejoin-token cache (pure cache; the Postgres fallback lives in `ParticipantService`) |

### Key Frontend Files
| File | Purpose |
|---|---|
| `lib/api.ts` | ky client: attaches the JWT, unwraps the response envelope, throws `HermesError`; `describeError` turns a failure into user-facing copy |
| `lib/auth.ts` | Auth token storage (localStorage + cookie) and the safe post-login redirect |
| `lib/session-storage.ts` | Device storage: rejoin tokens, player names, hosts' join codes |
| `components/Providers.tsx` | SWR config (capped retries, none on 401/403/404), reduced-motion handling, toasts |
| `components/OrganiserShell.tsx` | Organiser top bar, sign-out, and expired-token handling |
| `features/session/useStompClient.ts` | STOMP connection, subscription replay, queued publishes, dead-socket detection on tab return |
| `features/session/live-sync.ts` | Ordering of REST snapshots against live events (coalesced resyncs, in-flight event replay) |
| `features/session/{host,play}/` | Each side's reducer (`*-state.ts`), hook (`use*Session.ts`), and screens |
| `app/globals.css` | Design tokens and component classes (buttons, inputs, option tiles, dialogs) |
| `lib/motion.ts` | Motion vocabulary, mirroring the CSS duration tokens |

### Environment Variables (Frontend)
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws-hermes
```

### API Documentation
Swagger UI available at `http://localhost:8080/swagger-ui.html` when backend is running.

## Design Context

### Users
Anyone, anywhere: teachers running classroom assessments, facilitators running team trivia, event hosts polling a live audience. The host is typically one focused, technically-comfortable person; participants are a mixed crowd who need to act quickly and read the screen from a distance. Design must work for both simultaneously.

### Brand Personality
**Energetic, playful, live.** The interface should feel like something is always happening — like you caught it mid-broadcast. Urgent, electric, and a little dramatic. It earns attention.

### Aesthetic Direction
- **Dark mode only.** Deep navy/near-black backgrounds. No light mode.
- **Terminal as a soul, not a costume.** Sharp corners are foundational identity — not decoration. Terminal structure: monospace type, uppercase labels, pixel-precise borders. No scanlines.
- **Flat backgrounds, no gradients.** Page and surface backgrounds are flat solid colours — no radial blooms, no linear gradients, no vignettes.
- **Control room, not costume.** The broadcast lives in real instruments that each say something true: the tally (standby / on air / off air), the station clock, the slate before each question, the host's rundown. No colour bars, CRT glow, or glitch effects.
- **Energetic, not garish.** Dark backgrounds make colour pop. Use the established palette with confidence.
- **Not like Kahoot.** No bright primaries on white, no confetti-for-confetti's-sake. Energy comes from motion, density, and contrast — not noise.
- **Unique.** No direct design references. Hermes should look like nothing else in the category.

### Design Principles
1. **Speed over decoration.** Every frame matters in a live quiz. Remove friction first; add delight second.
2. **The screen is the stage.** During a session, the interface should feel like a broadcast — full-bleed, high-contrast, legible from across a room.
3. **Colour earns its place.** A single well-placed accent on a dark background is more effective than a rainbow.
4. **Motion tells the story.** Transitions between states (question start, answer lock, reveal, results) should feel satisfying. Choreograph state changes, don't just cut.
5. **Broad audience, zero ambiguity.** Every action, state, and label must be instantly understood by someone who has never seen the app before.

### Color System
Always use semantic tokens from `app/globals.css` — never raw hex values in components. The option colours are CSS variables too; `lib/options.ts` maps an option's position to its letter and colour.
- Neutrals are broadcast video levels, true greys named by 8-bit code: stage `--color-background` (#101010, video black), `--color-surface` (#161616), `--color-border` (#262626), text up to legal white (#ebebeb). No pure #000/#fff
- Key blue `--color-primary` (#005fd0, chroma-key): primary actions, the slate. Text on it uses `--color-on-primary` / `--color-on-primary-muted`, never raw white. Key light `--color-accent` (#92c1fd): focus, highlights
- Lamps: `--color-tally` (#ec5542) means on air, the last seconds, and faults; `--color-warning` (#ffa746) is standby
- Options A–D are the SMPTE colour bars in bar order: yellow / cyan / violet / magenta, stepping down in lightness (that staircase is what keeps them apart for colour-blind players; re-validate with the dataviz validator if you change one). Lit lamps take ink text (`--color-ink`), never white
- Three rules keep it coherent: two hero lights (key blue, tally) at full gain OKLCH C 0.19, every other lamp at one shared gain C 0.15; every hue holds its own wheel slot ≥ ~40° from the rest (tally 30 · standby 65 · A 105 · go 148 · B 196 · key/accent 255 · C 304 · D 354). A new colour must fit those rules, not just look right alone

### Typography
Archivo on its width axis (`.display`, `.display-tight`) for questions, slates and headlines; Schibsted Grotesk for the interface; Azeret Mono for data (codes, clocks, scores).

Full design context: `PRODUCT.md` and `DESIGN.md` in the project root.
