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
./mvnw spring-boot:run     # Run (requires postgres + redis on localhost)
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
- **Backend:** Spring Boot 4.0.3, Java 25, PostgreSQL 17, Redis 7, STOMP WebSockets, JWT auth
- **Frontend:** Next.js 16.2, React 19, TypeScript, Tailwind CSS 4, Framer Motion, `@stomp/stompjs`

### Session Lifecycle
```
LOBBY → ACTIVE → ENDED
```
- **LOBBY:** Participants join anonymously; organizer waits.
- **ACTIVE:** Questions advance one-by-one (timer or manual). Answers submitted via WebSocket.
- **ENDED:** Leaderboard shown; results available for review.

### Authentication
- **Organizers** authenticate with JWT (stored in `localStorage` as `hermes_token`). Token is injected by an Axios request interceptor (`frontend/lib/api.ts`) and validated on STOMP handshake via `StompChannelInterceptor`.
- **Participants** are anonymous. They receive a rejoin token on `POST /api/sessions/join`, stored in `localStorage` as `hermes_rejoin_{sessionId}`.

### WebSocket Communication (STOMP)
- **Endpoint:** `/ws-hermes`
- **Client → Server:** `/app/session/{sessionId}/answer` — submit an answer
- **Server → Client subscriptions:**
  - `/topic/session.{sessionId}.question` — `QUESTION_START`, `QUESTION_END`, `SESSION_END` events
  - `/topic/session.{sessionId}.analytics` — live leaderboard and answer-count updates (organizer only)

Frontend WebSocket is managed by `frontend/hooks/useStompClient.ts` with automatic reconnect (3s).

### State Split: PostgreSQL vs Redis
- **PostgreSQL:** Users, Events, Quizzes, Questions, Sessions, Participants, Answers (persistent).
- **Redis:** Active session state, current question index, timers, leaderboard caches (ephemeral, replaced on session end).

### Key Backend Services
| Service | Responsibility |
|---|---|
| `SessionService` | Session lifecycle (create/start/next/end) |
| `SessionEngine` | Transactional ops and timer scheduling for questions |
| `SessionRedisHelper` | Redis read/write for ephemeral session state |
| `AnswerService` | Answer recording and leaderboard updates |
| `ParticipantService` | Join/rejoin logic and token management |
| `OwnershipService` | Ensures organizers can only manage their own resources |

### Key Frontend Files
| File | Purpose |
|---|---|
| `lib/api.ts` | Axios wrapper; injects JWT, handles 401 logout |
| `lib/auth-context.tsx` | React Context for organizer auth state |
| `hooks/useStompClient.ts` | STOMP client lifecycle and subscription management |
| `lib/session-constants.ts` | Shared session-related constants |
| `lib/design-tokens.ts` | Design system colors and UI constants |

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
Always use semantic tokens from `globals.css` / `lib/design-tokens.ts` — never raw hex values in components.
- Background: `--color-background` (#0a0a0f), Surface: `--color-surface` (#1a1f2e)
- Primary: `--color-primary` (#2563eb), Accent: `--color-accent` (#38bdf8)
- Options A–D: blue / violet / amber / rose (defined as `--color-option-a` through `--color-option-d`)

Full design context: `.impeccable.md` in project root.

@.impeccable.md
