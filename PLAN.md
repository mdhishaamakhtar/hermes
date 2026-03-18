You are building Hermes — a real-time quiz and polling platform. The Spring Boot backend scaffold is already present in backend/ from start.spring.io. You need to build the full backend, frontend, and local development infrastructure from scratch based on the spec below.

---

## PROJECT OVERVIEW

Hermes allows organisers to create events containing quizzes, make quizzes live as sessions, and see real-time analytics as anonymous participants answer questions. Participants join via a 6-character code, answer questions in real-time, and see their personal results at session end.

Two distinct user types:
- **Organiser** — authenticated user, creates/manages events and quizzes, runs live sessions, sees real-time analytics dashboard
- **Participant** — anonymous, joins via code, answers questions, sees personal results at end. Can rejoin if they close the tab.

---

## REPOSITORY STRUCTURE

```
hermes/
├── backend/          ← Spring Boot scaffold already here from start.spring.io
├── frontend/         ← Next.js app, you create this
├── docker-compose.yml
└── README.md
```

---

## BACKEND SPEC

### Tech Stack
- Java 25
- Spring Boot 4 (latest stable, already scaffolded)
- Maven
- PostgreSQL (via Spring Data JPA)
- Redis (via Spring Data Redis)
- WebSocket with STOMP (spring-boot-starter-websocket)
- Spring Security (not in the starter — add spring-boot-starter-security to pom.xml)
- SpringDoc OpenAPI (auto-generated Swagger UI at /swagger-ui.html)
- Spotless Maven plugin with Google Java Format
- Virtual threads enabled: spring.threads.virtual.enabled=true
- JWT for organiser auth (jjwt library) — use Spring Security's filter chain via SecurityFilterChain bean, not a manual filter. Write a JwtUtil class for signing/validating tokens and a UserDetailsService that loads from the users table. Use @PreAuthorize on controllers for route-level auth. Configure BCryptPasswordEncoder as a bean for password hashing.

### Spotless Configuration
Add to pom.xml:

```xml
<plugin>
  <groupId>com.diffplug.spotless</groupId>
  <artifactId>spotless-maven-plugin</artifactId>
  <version>LATEST</version>
  <configuration>
    <java>
      <googleJavaFormat/>
    </java>
  </configuration>
</plugin>
```

Add mvn spotless:apply and mvn spotless:check as usable commands.

### Package Structure

```
com.hermes
├── config/          ← WebSocket, Security, Redis, Swagger config
├── controller/      ← REST controllers
├── ws/              ← WebSocket message handlers (@MessageMapping)
├── service/         ← Business logic
├── repository/      ← Spring Data JPA repositories
├── entity/          ← JPA entities
├── dto/             ← Request/Response DTOs (Java records)
├── security/        ← JWT filter, auth utilities
└── exception/       ← Global exception handler
```

### Database Schema (PostgreSQL)

```sql
-- users: organisers only
users
  id BIGSERIAL PK
  email TEXT UNIQUE NOT NULL
  password_hash TEXT NOT NULL
  display_name TEXT NOT NULL
  created_at TIMESTAMPTZ DEFAULT now()

-- events: top-level container owned by an organiser
events
  id BIGSERIAL PK
  user_id BIGINT FK → users NOT NULL
  title TEXT NOT NULL
  description TEXT
  created_at TIMESTAMPTZ DEFAULT now()

-- quizzes: belong to an event, reusable across multiple sessions
quizzes
  id BIGSERIAL PK
  event_id BIGINT FK → events NOT NULL
  title TEXT NOT NULL
  order_index INT NOT NULL
  created_at TIMESTAMPTZ DEFAULT now()

-- questions: static definition, belong to a quiz
questions
  id BIGSERIAL PK
  quiz_id BIGINT FK → quizzes NOT NULL
  text TEXT NOT NULL
  order_index INT NOT NULL
  time_limit_seconds INT NOT NULL
  created_at TIMESTAMPTZ DEFAULT now()

-- options: belong to a question, exactly one is_correct enforced at app layer
options
  id BIGSERIAL PK
  question_id BIGINT FK → questions NOT NULL
  text TEXT NOT NULL
  is_correct BOOLEAN NOT NULL DEFAULT false

-- quiz_sessions: one live run of a quiz
quiz_sessions
  id BIGSERIAL PK
  quiz_id BIGINT FK → quizzes NOT NULL
  join_code TEXT UNIQUE         -- 6 char uppercase, nulled on session end
  status TEXT NOT NULL          -- LOBBY | ACTIVE | ENDED
  current_question_id BIGINT FK → questions  -- null in LOBBY
  started_at TIMESTAMPTZ
  ended_at TIMESTAMPTZ
  created_at TIMESTAMPTZ DEFAULT now()

-- participants: anonymous, one per session join
participants
  id BIGSERIAL PK
  session_id BIGINT FK → quiz_sessions NOT NULL
  display_name TEXT             -- null for now, future feature
  rejoin_token TEXT UNIQUE NOT NULL  -- random token, stored in participant's browser localStorage
  joined_at TIMESTAMPTZ DEFAULT now()

-- participant_answers: every answer submitted
participant_answers
  id BIGSERIAL PK
  session_id BIGINT FK → quiz_sessions NOT NULL
  participant_id BIGINT FK → participants NOT NULL
  question_id BIGINT FK → questions NOT NULL
  option_id BIGINT FK → options NOT NULL
  is_correct BOOLEAN NOT NULL   -- denormalized from options.is_correct at write time
  answered_at TIMESTAMPTZ DEFAULT now()
  UNIQUE(participant_id, question_id)  -- no resubmission enforced at DB level
```

Use spring.jpa.hibernate.ddl-auto=create-drop for local development. No migration tool needed.

### Redis Key Structure

```
session:{sessionId}:status                         → String: LOBBY | ACTIVE | ENDED
session:{sessionId}:current_question               → String: questionId | null
session:{sessionId}:participant_count              → String: integer
session:{sessionId}:question:{questionId}:counts   → Hash: { optionId → count }
session:{sessionId}:leaderboard                    → Sorted set: { participantId → score (correct count) }
participant:{rejoinToken}                          → String: participantId  (TTL: 24h)
```

### REST API Endpoints

All responses follow standard structure:
```json
{ "success": true, "data": {}, "error": null }
```

**Auth**
```
POST /api/auth/register    body: { email, password, displayName }
POST /api/auth/login       body: { email, password } → { token, user }
GET  /api/auth/me          header: Authorization: Bearer <token>
```

**Events** (all require organiser auth)
```
GET    /api/events
POST   /api/events              body: { title, description }
GET    /api/events/{id}         → event with quizzes
PUT    /api/events/{id}         body: { title, description }
DELETE /api/events/{id}
```

**Quizzes** (all require organiser auth)
```
POST   /api/events/{eventId}/quizzes     body: { title, orderIndex }
GET    /api/quizzes/{id}                 → quiz with questions and options
PUT    /api/quizzes/{id}                 body: { title, orderIndex }
DELETE /api/quizzes/{id}
```

**Questions** (all require organiser auth)
```
POST   /api/quizzes/{quizId}/questions   body: { text, orderIndex, timeLimitSeconds, options: [{text, isCorrect}] }
PUT    /api/questions/{id}               body: { text, orderIndex, timeLimitSeconds, options: [{text, isCorrect}] }
DELETE /api/questions/{id}
```

**Sessions**
```
POST /api/sessions                       auth required, body: { quizId } → { sessionId, joinCode }
POST /api/sessions/{id}/start            auth required → LOBBY→ACTIVE, broadcasts first question
POST /api/sessions/{id}/next             auth required → advances to next question or ends session
POST /api/sessions/{id}/end              auth required → force ends session
GET  /api/sessions/{id}/results          auth required → full session analytics: per-question option counts + final leaderboard (works on ENDED sessions)
GET  /api/quizzes/{id}/sessions          auth required → list of past sessions for a quiz (id, status, started_at, ended_at, participant count)

POST /api/sessions/join                  no auth, body: { joinCode } → { participantId, rejoinToken, sessionId }
POST /api/sessions/rejoin                no auth, body: { rejoinToken } → { participantId, sessionId, currentQuestion, alreadyAnswered: [questionId] }
GET  /api/sessions/{id}/my-results       no auth, header: X-Rejoin-Token → personal results for participant (only works after session ENDED)
```

### WebSocket / STOMP

Endpoint: /ws-hermes
No SockJS — use native WebSocket.

Auth: Organiser JWT passed in STOMP CONNECT frame header Authorization: Bearer <token>. Validated in a ChannelInterceptor. Participants are fully anonymous — no principal assignment. No auth header required on participant STOMP connections.

**Organiser subscribes to:**
```
/topic/session.{sessionId}.analytics   ← live answer counts per option + leaderboard at session end
/topic/session.{sessionId}.control     ← participant join/leave counts
```

**Participant subscribes to:**
```
/topic/session.{sessionId}.question    ← question broadcasts and session end signal
```

**Client SEND destinations:**
```
/app/session/{sessionId}/answer        ← participant submits answer
  body: { rejoinToken, questionId, optionId }
```

**Server broadcast message shapes:**

Question start → /topic/session.{sessionId}.question:
```json
{
  "event": "QUESTION_START",
  "questionId": "...",
  "text": "...",
  "options": [{ "id": "...", "text": "..." }],
  "timeLimitSeconds": 30,
  "questionIndex": 1,
  "totalQuestions": 5
}
```

Question end → /topic/session.{sessionId}.question:
```json
{
  "event": "QUESTION_END",
  "questionId": "...",
  "correctOptionId": "..."
}
```

Answer update → /topic/session.{sessionId}.analytics:
```json
{
  "event": "ANSWER_UPDATE",
  "questionId": "...",
  "counts": { "optionId": count },
  "totalAnswered": 2,
  "totalParticipants": 10
}
```

Live leaderboard update → /topic/session.{sessionId}.analytics:
```json
{
  "event": "LEADERBOARD_UPDATE",
  "leaderboard": [
    { "rank": 1, "participantId": "...", "score": 3 }
  ]
}
```
Broadcast after every correct answer is recorded. participantId is used as an anonymous identifier (shown as "Player {rank}" or similar on the UI — no display name).

Participant joined → /topic/session.{sessionId}.control:
```json
{
  "event": "PARTICIPANT_JOINED",
  "count": 5
}
```

Session ended signal → /topic/session.{sessionId}.question:
```json
{
  "event": "SESSION_END"
}
```
Participants receive this broadcast and redirect to /session/[id]/results, where they fetch their personal results via REST using their rejoinToken.

Session ended leaderboard → /topic/session.{sessionId}.analytics:
```json
{
  "event": "SESSION_END",
  "leaderboard": [
    { "rank": 1, "displayName": "Anonymous", "score": 5, "totalQuestions": 5 }
  ],
  "totalParticipants": 10
}
```
Broadcast to organiser's analytics topic. Organiser host screen shows leaderboard alongside the final response graph.

### Answer Submission Flow (on /app/session/{sessionId}/answer)
1. Receive STOMP message
2. Redis lookup participant:{rejoinToken} → participantId (no Postgres hit)
3. Redis lookup session:{sessionId}:status → must be ACTIVE, else reject
4. Redis lookup session:{sessionId}:current_question → must match questionId in body, else reject
5. Check UNIQUE constraint will not be violated (participant already answered this question), else reject silently
6. Look up option from DB to get is_correct value
7. INSERT into participant_answers immediately (Postgres is source of truth, never buffer answers)
8. Redis HINCRBY session:{sessionId}:question:{questionId}:counts {optionId} 1
9. If answer is correct: Redis ZINCRBY session:{sessionId}:leaderboard 1 {participantId}
10. Read updated counts from Redis hash → Broadcast ANSWER_UPDATE to /topic/session.{sessionId}.analytics
11. Read updated leaderboard from Redis sorted set (ZREVRANGE with scores) → Broadcast LEADERBOARD_UPDATE to /topic/session.{sessionId}.analytics

### Question Progression Flow (on POST /api/sessions/{id}/next or timer expiry)
1. Determine next question by order_index from DB
2. If no next question exists, end the session (same as POST /api/sessions/{id}/end)
3. If next question exists:
   - Update quiz_sessions.current_question_id in Postgres
   - Update session:{sessionId}:current_question in Redis
   - Initialise Redis hash session:{sessionId}:question:{nextQuestionId}:counts with all options at 0
   - Broadcast QUESTION_START to /topic/session.{sessionId}.question
   - Schedule timer for next question's time_limit_seconds using Spring's TaskScheduler

### Session End Flow
1. Update Postgres: quiz_sessions status=ENDED, ended_at=now(), join_code=null, current_question_id=null
2. Update Redis: session:{sessionId}:status → ENDED
3. Broadcast SESSION_END to /topic/session.{sessionId}.question — participants receive this and redirect to results page
4. Read final leaderboard from Redis sorted set → broadcast SESSION_END (with leaderboard payload) to /topic/session.{sessionId}.analytics for the organiser
5. Clean up Redis keys for this session (DELETE session:{sessionId}:*)
6. participant:{rejoinToken} keys can expire naturally via TTL
Note: Postgres is the persistent store for all historical data. GET /api/sessions/{id}/results recomputes leaderboard and per-question counts from participant_answers at query time — no Redis needed for past sessions.

### Timer Implementation
Use Spring's TaskScheduler to schedule question auto-advancement. When a question starts, schedule a task for time_limit_seconds in the future that calls the same question progression logic. If organiser manually advances before timer fires, cancel the scheduled task. Store ScheduledFuture references in a ConcurrentHashMap keyed by sessionId so they can be cancelled.

---

## FRONTEND SPEC

> **Implementation note:** Use the `impeccable:frontend-design` skill (via `Skill tool`) when building **every** frontend page and component. Do not build frontend UI without invoking it. This ensures high design quality and avoids generic AI aesthetics.

### Branding

**Logo:** A custom SVG of a winged foot/sandal — referencing Hermes, the Greek messenger god, whose iconic attribute is his winged shoes (talaria). The logo is geometric and bold, not illustrative. Think flat/solid shapes, not outlines.

**Colour:** Primary blue — approximately `#2563EB` (Tailwind `blue-600`) as the dominant brand colour. Use lighter blues for hover states and accents. Dark background (`#0A0A0F` or similar near-black) to make the blue pop.

**Typography:** Strong, modern sans-serif. Suggest a wide/extended weight for the wordmark "HERMES" in all-caps. Body text clean and legible.

**Logo usage:** The winged foot SVG sits to the left of the wordmark. Used in the top-left navbar across all pages. On the landing page, displayed larger as the hero brand mark.

### Tech Stack
- Next.js (latest stable)
- TypeScript
- Tailwind CSS
- ESLint
- Prettier
- @stomp/stompjs v7+ for WebSocket (no SockJS)
- Framer Motion (latest) for all animations

### Rendering Strategy
- Landing page (/) — SSR for SEO. Static enough for search engines.
- All other pages — CSR. No server components beyond the landing page. Use 'use client' directive explicitly on all non-landing pages.
- Use Next.js Link component for all internal navigation to get prefetching.

### Scripts in package.json
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint:check": "eslint .",
  "lint:fix": "eslint . --fix",
  "format:check": "prettier --check .",
  "format:fix": "prettier --write .",
  "check": "npm run lint:check && npm run format:check",
  "fix": "npm run lint:fix && npm run format:fix"
}
```

### Pages and Routing

```
/                          ← Landing page (SSR). Has two CTAs: "Host a Quiz" (→ /auth/login) and "Join a Session" (→ /join)
/auth/login                ← Organiser login (CSR)
/auth/register             ← Organiser register (CSR)
/dashboard                 ← Organiser dashboard, list of events (CSR, auth required)
/events/[id]               ← Event detail, list of quizzes (CSR, auth required)
/events/[id]/quizzes/[qid] ← Quiz editor, questions and options + list of past sessions with links to /session/[id]/review (CSR, auth required)
/session/[id]/host         ← Organiser live session view with real-time analytics (CSR, auth required)
/session/[id]/review       ← Organiser post-session review: per-question graphs + leaderboard (CSR, auth required)
/join                      ← Participant enter join code (CSR)
/session/[id]/play         ← Participant live quiz view (CSR)
/session/[id]/results      ← Participant personal results at end (CSR)
```

### State Management
Use React Context for auth state (organiser JWT). Use component-level useState/useEffect for everything else. No Redux or Zustand needed.

### WebSocket Hook
Create a reusable useStompClient hook that:
- Accepts connection headers (JWT or rejoinToken depending on user type)
- Handles connect, disconnect, reconnect
- Exposes subscribe(destination, callback) and publish(destination, body) methods
- Cleans up subscriptions on unmount

### Organiser Live Session View (/session/[id]/host)
This is the most important screen. It must show:
- Current question text and which question number it is (e.g. Question 2 of 5)
- Toggle between two live panels: **Response Graph** (bar chart of option counts, animated) and **Leaderboard** (ranked list with scores). Both update in real-time via WebSocket. Toggle persists across question advances.
- Total answered count and total participant count
- Timer countdown for current question
- Next Question button (or End Quiz if last question)
- Participant count in lobby before session starts
- At session end: final leaderboard shown by default, toggle still works to review final response graph. Button to navigate to /session/[id]/review for full historical view.

### Participant Live Quiz View (/session/[id]/play)
- Shows current question text
- Shows answer options as large clickable buttons
- Once answered, buttons disable and show "Answer recorded" — no right/wrong yet
- Timer countdown visible
- When question ends, highlight correct option and show whether participant was right or wrong
- On SESSION_END broadcast, redirect to /session/[id]/results

### Organiser Session Review View (/session/[id]/review)
- Auth required. Loads via GET /api/sessions/{id}/results (Postgres query, no Redis needed).
- Shows: final leaderboard + per-question breakdown. Per-question: question text, bar chart of option counts with correct option highlighted.
- Question selector (tabs or prev/next) to navigate through all questions.
- Accessible from the quiz editor page (/events/[id]/quizzes/[qid]) which lists all past sessions for that quiz via GET /api/quizzes/{id}/sessions.

### Participant Results View (/session/[id]/results)
- On mount, calls GET /api/sessions/{id}/my-results with X-Rejoin-Token from localStorage
- Shows per-question breakdown: question text, selected option, correct option, right/wrong
- Shows total score (e.g. 3/5)

### Design
Dark theme (`#0A0A0F` base). Primary accent: `blue-600` (#2563EB). High-energy, live-event feel — think sports scoreboard meets modern SaaS. Use Tailwind utility classes only, no custom CSS files. Typography: wide/bold sans-serif for headings, clean for body. The winged foot SVG logo appears in the navbar on every page. All animations use Framer Motion — no CSS transitions or Tailwind transition utilities for anything interactive. Key animation moments:
- Page transitions: smooth fade+slide between routes
- Bar chart: `animate` on width with spring physics as counts update
- Leaderboard: `AnimatePresence` + `layout` prop so items smoothly re-rank when scores change
- Answer buttons: scale+opacity on hover, satisfying press feedback on click, green/red reveal on question end
- Timer countdown: subtle pulse as time runs low (under 5s)
- Question advance: outgoing question slides out, incoming slides in
- Lobby participant count: number ticks up with a small bounce each time someone joins
- Score reveal on results page: staggered entry per question row

---

## DOCKER SETUP

### docker-compose.yml (at repo root)
Services:
- postgres: postgres:17-alpine, port 5432, database hermes, user hermes, password hermes
- redis: redis:7-alpine, port 6379
- backend: builds from backend/Dockerfile, port 8080, depends on postgres and redis
- frontend: builds from frontend/Dockerfile, port 3000, depends on backend

All services on a shared bridge network hermes-network.

Use named volumes for postgres data persistence.

Include a healthcheck on postgres using pg_isready. Backend should have condition: service_healthy on postgres dependency.

### backend/Dockerfile
### frontend/Dockerfile

Standard production ready dockerfiles (multi step build etc)
```

Use Next.js standalone output mode: add output: 'standalone' to next.config.ts.

### Environment Variables

backend application.properties (with docker-compose overrides via environment:):
```
spring.datasource.url=jdbc:postgresql://postgres:5432/hermes
spring.datasource.username=hermes
spring.datasource.password=hermes
spring.data.redis.host=redis
spring.data.redis.port=6379
spring.threads.virtual.enabled=true
jwt.secret=<generate a strong default for local dev>
jwt.expiration-ms=86400000
```

frontend .env.local:
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws-hermes
```

---

## GENERAL IMPLEMENTATION NOTES

- All entity IDs are auto-incremented BIGINT (BIGSERIAL in Postgres). Map to Long in Java entities using @GeneratedValue(strategy = GenerationType.IDENTITY).
- Use Java records for all DTOs.
- Global exception handler using @RestControllerAdvice returns { success: false, data: null, error: { code, message } }.
- Validate all REST request bodies using Jakarta Bean Validation (@Valid, @NotBlank, etc).
- Join code generation: 6 uppercase alphanumeric characters, verify uniqueness before persisting.
- Exactly one is_correct option per question enforced in service layer — throw a validation error if violated.
- Options are always saved/updated as a full replace (delete existing, insert new) when a question is updated.
- Do not expose is_correct in any API response that participants can access. It only appears in QUESTION_END broadcast and SESSION_END results.
- CORS: allow http://localhost:3000 in development.
- Swagger UI available at /swagger-ui.html in all environments.
- Run mvn spotless:apply before any commit. CI should run mvn spotless:check.
- Frontend API calls use a centralised api.ts utility that attaches the JWT from context automatically.
- rejoinToken stored in browser localStorage under key hermes_rejoin_{sessionId}. Generate rejoin tokens as a cryptographically random alphanumeric string (32 chars), not a UUID.
- Participants are fully anonymous throughout — no WebSocket principal assignment. Personal results are fetched via REST after session end using the rejoinToken as identity.

---

## WHAT TO BUILD IN ORDER

1. Docker Compose and Dockerfiles
2. Backend: pom.xml dependencies (add spring-boot-starter-security, jjwt, springdoc-openapi), application.properties
3. Backend: entities and repositories
4. Backend: Spring Security config (SecurityFilterChain, JwtUtil, UserDetailsService, BCryptPasswordEncoder), auth endpoints (register, login, /me)
5. Backend: event, quiz, question CRUD
6. Backend: session REST endpoints (create, join, rejoin, start, end, next)
7. Backend: WebSocket config and STOMP channel interceptor
8. Backend: answer submission WebSocket handler
9. Backend: question timer scheduling
10. Backend: session end flow with private results broadcast
11. Frontend: Next.js init, Tailwind, ESLint, Prettier setup, package.json scripts
12. Frontend: API utility, auth context
13. Frontend: Landing page (SSR) — use `impeccable:frontend-design`
14. Frontend: Auth pages (login, register) — use `impeccable:frontend-design`
15. Frontend: Dashboard and event/quiz management pages — use `impeccable:frontend-design`
16. Frontend: useStompClient hook
17. Frontend: Organiser live session view with real-time charts — use `impeccable:frontend-design`
18. Frontend: Participant join, play, and results pages — use `impeccable:frontend-design`
```