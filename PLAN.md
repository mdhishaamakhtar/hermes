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
  <version>3.3.0</version>
  <configuration>
    <java>
      <googleJavaFormat/>
    </java>
  </configuration>
</plugin>
```

Add mvn spotless:apply and mvn spotless:check as usable commands.

Use Spotless version **3.3.0** (latest stable as of March 2026).

### Required pom.xml Dependencies

The spring.io scaffold is missing several dependencies. Add these to `pom.xml`:

```xml
<!-- Spring Security -->
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-security</artifactId>
</dependency>

<!-- Jakarta Bean Validation -->
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-validation</artifactId>
</dependency>

<!-- JWT — use modular jjwt 0.13.x -->
<dependency>
  <groupId>io.jsonwebtoken</groupId>
  <artifactId>jjwt-api</artifactId>
  <version>0.13.0</version>
</dependency>
<dependency>
  <groupId>io.jsonwebtoken</groupId>
  <artifactId>jjwt-impl</artifactId>
  <version>0.13.0</version>
  <scope>runtime</scope>
</dependency>
<dependency>
  <groupId>io.jsonwebtoken</groupId>
  <artifactId>jjwt-jackson</artifactId>
  <version>0.13.0</version>
  <scope>runtime</scope>
</dependency>
```

**Test dependencies:** The scaffold uses non-standard starters like `spring-boot-starter-data-jpa-test` — these do not exist as real artifacts. Replace all test dependencies with the standard:

```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-test</artifactId>
  <scope>test</scope>
</dependency>
```

`spring-boot-starter-test` includes JUnit 5, Mockito, AssertJ, MockMvc, and all standard Spring test utilities.

### Package Structure

```
dev.hishaam.hermes
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
  order_index INT NOT NULL      -- explicit ordering, stable across full-replace updates
  is_correct BOOLEAN NOT NULL DEFAULT false

-- quiz_sessions: one live run of a quiz
quiz_sessions
  id BIGSERIAL PK
  quiz_id BIGINT FK → quizzes NOT NULL
  join_code TEXT UNIQUE NOT NULL  -- 6 char uppercase, permanent (never nulled). Active join lookup is via Redis joincode:{code} key, which is deleted on session end.
  status TEXT NOT NULL            -- LOBBY | ACTIVE | ENDED
  current_question_id BIGINT FK → questions  -- convenience pointer for the active question; null in LOBBY/ENDED. Not load-bearing for correctness — snapshot is the source of truth for question content.
  snapshot JSONB NOT NULL         -- immutable copy of the full quiz taken at session creation time. Shape documented below. All question/option text in results and broadcasts is read from this, never from the live questions/options tables.
  started_at TIMESTAMPTZ
  ended_at TIMESTAMPTZ
  created_at TIMESTAMPTZ DEFAULT now()

-- participants: anonymous, one per session join
-- display_name is required — participant must enter it on the join screen before entering the session.
participants
  id BIGSERIAL PK
  session_id BIGINT FK → quiz_sessions NOT NULL
  display_name TEXT NOT NULL    -- chosen by participant at join time, shown on leaderboard
  rejoin_token TEXT UNIQUE NOT NULL  -- random token, stored in participant's browser localStorage
  joined_at TIMESTAMPTZ DEFAULT now()

-- participant_answers: every answer submitted
-- question_id and option_id are NOT enforced as FK constraints. The snapshot is the
-- authoritative source of question/option content. Enforcing FKs here would prevent
-- full-replace option edits on quizzes that have ended sessions (the edit guard only
-- blocks LOBBY/ACTIVE). IDs are valid at write time (validated against the snapshot);
-- referential integrity post-session is intentionally not DB-enforced.
participant_answers
  id BIGSERIAL PK
  session_id BIGINT FK → quiz_sessions NOT NULL
  participant_id BIGINT FK → participants NOT NULL
  question_id BIGINT NOT NULL   -- references questions(id) logically, no FK constraint
  option_id BIGINT NOT NULL     -- references options(id) logically, no FK constraint
  is_correct BOOLEAN NOT NULL   -- denormalized from options.is_correct at write time
  answered_at TIMESTAMPTZ DEFAULT now()
  UNIQUE(participant_id, question_id)  -- no resubmission enforced at DB level
```

Use spring.jpa.hibernate.ddl-auto=create-drop for local development. No migration tool needed.

### Session Snapshot (JSONB)

When `POST /api/sessions` is called, the service loads the full quiz (all questions and their options) and serialises it into `quiz_sessions.snapshot`. This column is written once and never updated. All downstream reads — question broadcasts, answer validation, results pages — use the snapshot.

```json
{
  "quizId": 1,
  "title": "General Knowledge",
  "questions": [
    {
      "id": 42,
      "text": "What is the capital of France?",
      "orderIndex": 1,
      "timeLimitSeconds": 30,
      "options": [
        { "id": 101, "text": "London",  "isCorrect": false, "orderIndex": 1 },
        { "id": 102, "text": "Paris",   "isCorrect": true,  "orderIndex": 2 },
        { "id": 103, "text": "Berlin",  "isCorrect": false, "orderIndex": 3 },
        { "id": 104, "text": "Madrid",  "isCorrect": false, "orderIndex": 4 }
      ]
    }
  ]
}
```

IDs in the snapshot are the real DB IDs, so `participant_answers.question_id` and `option_id` FK references remain valid. The snapshot is deserialised into a Java record (`QuizSnapshot`) for in-memory use — no JSONB query operators needed.

**Quiz edit guard:** `PUT /api/questions/{id}`, `DELETE /api/questions/{id}`, and `PUT /api/quizzes/{id}` must check whether the quiz has any session with status `LOBBY` or `ACTIVE`. If so, return 409 Conflict with message "Quiz has an active session and cannot be edited." This prevents live content from diverging from an in-flight snapshot.

### Database Indexes

Required indexes (add via `@Index` on JPA entities — Hibernate will create them with `create-drop`):

```sql
-- Organiser dashboard and event detail pages
CREATE INDEX idx_events_user_id              ON events(user_id);
CREATE INDEX idx_quizzes_event_id            ON quizzes(event_id);

-- Quiz editor CRUD (questions/options tables still used for editing)
CREATE INDEX idx_questions_quiz_id           ON questions(quiz_id);
CREATE INDEX idx_options_question_id         ON options(question_id);

-- Session management
CREATE INDEX idx_quiz_sessions_quiz_id       ON quiz_sessions(quiz_id);
CREATE INDEX idx_quiz_sessions_join_code     ON quiz_sessions(join_code);  -- fallback DB lookup

-- Participant lookups
CREATE INDEX idx_participants_session_id     ON participants(session_id);

-- Results aggregation from participant_answers (snapshot handles text, these cover counts)
CREATE INDEX idx_participant_answers_session ON participant_answers(session_id);
CREATE INDEX idx_participant_answers_part    ON participant_answers(participant_id);
CREATE INDEX idx_pa_session_question         ON participant_answers(session_id, question_id);
```

### Redis Key Structure

```
session:{sessionId}:status                         → String: LOBBY | ACTIVE | ENDED
session:{sessionId}:snapshot                       → String: JSON-serialised QuizSnapshot (written at session creation, read on every answer and question advance — never hits Postgres on the hot path)
session:{sessionId}:current_question               → String: questionId | null
session:{sessionId}:participant_count              → String: integer
session:{sessionId}:question:{questionId}:counts   → Hash: { optionId → count }
session:{sessionId}:leaderboard                    → Sorted set: { participantId → score (correct count) }
session:{sessionId}:question_seq                   → String: integer (incremented on every question advance; used to detect stale timer firings)
session:{sessionId}:timer                          → String: "1" with TTL = time_limit_seconds (existence = timer active; DELETE = cancel)
joincode:{code}                                    → String: sessionId (created on session create; deleted on session end — this is the active join lookup, not the DB join_code column)
participant:{rejoinToken}                          → String: participantId  (TTL: 24h — covers the live event plus same-day results review)
```

All session keys should carry a safety-net TTL of 48h set at session creation (via `EXPIRE`). If the session end cleanup is interrupted, keys will not accumulate indefinitely.

`session:{sessionId}:snapshot` is written once at `POST /api/sessions` immediately after the Postgres insert, using the same JSON that goes into the `snapshot` JSONB column. It is deleted as part of session end cleanup. On any cache miss (should not happen in normal operation), fall back to reading `quiz_sessions.snapshot` from Postgres and re-populate Redis.

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

POST /api/sessions/join                  no auth, body: { joinCode, displayName } → { participantId, rejoinToken, sessionId }
POST /api/sessions/rejoin                no auth, body: { rejoinToken } → { participantId, sessionId, currentQuestion, alreadyAnswered: [questionId] }
GET  /api/sessions/{id}/my-results       no auth, header: X-Rejoin-Token → personal results for participant (only works after session ENDED). Resolve rejoinToken → participantId via Redis first; on cache miss fall back to SELECT id FROM participants WHERE rejoin_token = ? (the column is unique-indexed, no extra index needed).
```

### WebSocket / STOMP

#### How WebSocket, STOMP, and the Broker fit together

**WebSocket** is the raw transport — a persistent, full-duplex TCP connection between browser and server. It sends raw bytes with no routing or message structure.

**STOMP** (Simple Text Oriented Messaging Protocol) is a messaging protocol that runs on top of WebSocket. It adds structure: named destinations (`/topic/...`, `/app/...`), subscriptions, and message frames. Think of it as the postal routing layer — WebSocket is the wire, STOMP is the addressing system.

**The message broker** is the component that routes STOMP messages to subscribers. Spring provides two options:

| | Simple In-Memory Broker | Full External Broker (RabbitMQ) |
|---|---|---|
| Setup | Zero config, built into Spring | Requires running RabbitMQ instance |
| Scaling | Single JVM only | All backend nodes share one broker |
| Features | Basic pub/sub to `/topic` and `/queue` | Full STOMP including acks, receipts, durable queues |
| Use case | Single-node deployments | Horizontally scaled deployments |

**Hermes v0 uses the simple in-memory broker.** This is correct for a single-node deployment. The in-memory broker is configured with `.enableSimpleBroker("/topic")`. All WebSocket connections to the same server instance share the broker, so broadcasts reach all subscribers.

If Hermes ever scales horizontally (multiple backend pods), replace `.enableSimpleBroker` with `.enableStompBrokerRelay` pointing at a RabbitMQ instance with the STOMP plugin enabled. This is a one-line config change — the rest of the code is identical.

---

Endpoint: /ws-hermes
No SockJS — use native WebSocket.

Auth: Organiser JWT passed in STOMP CONNECT frame header Authorization: Bearer <token>. Validated in a ChannelInterceptor. Participants are fully anonymous — no principal assignment. No auth header required on participant STOMP connections.

**Subscription authorization:** The ChannelInterceptor must also validate SUBSCRIBE frames, not just CONNECT. When an organiser subscribes to `/topic/session.{sessionId}.analytics` or `/topic/session.{sessionId}.control`, verify that the sessionId belongs to a quiz owned by the authenticated organiser (session → quiz → event → user). Reject with an error frame if not. Participant subscriptions to `/topic/session.{sessionId}.question` are unauthenticated and always permitted. This is intentional: session IDs are not secret, and observing question broadcasts without having joined does not affect scoring or leaderboard standing. The join code is the participation gate (REST), not the observation gate (WebSocket).

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
    { "rank": 1, "participantId": "...", "displayName": "Alice", "score": 3 }
  ]
}
```
Broadcast after every correct answer is recorded. displayName is the name the participant entered on join.

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
    { "rank": 1, "participantId": "...", "displayName": "Alice", "score": 5, "totalQuestions": 5 }
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
5. GET session:{sessionId}:snapshot from Redis → deserialise into QuizSnapshot. Look up optionId to get is_correct. Also validate that optionId actually belongs to questionId in the snapshot; reject if not. (No Postgres hit. On Redis miss, fall back to DB and re-populate.)
6. INSERT into participant_answers using `ON CONFLICT (participant_id, question_id) DO NOTHING`. If the row already exists the insert is a no-op at the DB level — no exception, no extra round-trip. Use a native `@Query` in the repository. If 0 rows were inserted, return immediately without updating Redis or broadcasting.
7. Redis HINCRBY session:{sessionId}:question:{questionId}:counts {optionId} 1
8. If answer is correct: Redis ZINCRBY session:{sessionId}:leaderboard 1 {participantId}
9. Read updated counts from Redis hash → Broadcast ANSWER_UPDATE to /topic/session.{sessionId}.analytics
10. Read updated leaderboard from Redis sorted set (ZREVRANGE with scores) → resolve displayName for each participantId via a single Postgres query (`SELECT id, display_name FROM participants WHERE id IN (...)`) → Broadcast LEADERBOARD_UPDATE to /topic/session.{sessionId}.analytics

### Question Progression Flow (on POST /api/sessions/{id}/next or timer expiry)
1. GET session:{sessionId}:snapshot from Redis → deserialise into QuizSnapshot. No Postgres hit.
2. Determine next question by finding the entry in snapshot.questions with orderIndex immediately after the current question.
3. If no next question exists, end the session (same as POST /api/sessions/{id}/end).
4. If next question exists:
   - Update quiz_sessions.current_question_id in Postgres (convenience pointer)
   - Update session:{sessionId}:current_question in Redis
   - Initialise Redis hash session:{sessionId}:question:{nextQuestionId}:counts with all options at 0 (option IDs come from the snapshot)
   - Broadcast QUESTION_START to /topic/session.{sessionId}.question (all text/options sourced from snapshot)
   - Schedule timer using Spring's TaskScheduler per the Timer Implementation section

### Session End Flow
1. Update Postgres: quiz_sessions status=ENDED, ended_at=now(), current_question_id=null. **Do not null join_code** — it is kept permanently for audit/history.
2. DEL `joincode:{code}` from Redis — this is the join lookup gate. New join attempts will fail from this point.
3. Update Redis: session:{sessionId}:status → ENDED
4. Broadcast SESSION_END to /topic/session.{sessionId}.question — participants receive this and redirect to results page
5. Read final leaderboard from Redis sorted set → broadcast SESSION_END (with leaderboard payload) to /topic/session.{sessionId}.analytics for the organiser
6. Clean up Redis keys for this session (DELETE session:{sessionId}:* — includes snapshot, status, current_question, participant_count, all question count hashes, leaderboard, question_seq, timer)
7. participant:{rejoinToken} keys expire naturally via their 24h TTL
Note: Postgres is the persistent store for all historical data. GET /api/sessions/{id}/results recomputes leaderboard and per-question counts from participant_answers at query time — no Redis needed for past sessions.

### Timer Implementation

Use a Redis key as the canonical timer state rather than an in-memory `ScheduledFuture`. This eliminates the race condition between organiser manual advance and timer auto-advance, and avoids single-node timer state.

**When a question starts:**
1. Increment `session:{sessionId}:question_seq` (INCR) — capture the resulting value as `seqAtStart`.
2. SET `session:{sessionId}:timer` = "1" with `EX time_limit_seconds` — this key's existence means the timer is active.
3. Schedule a Spring `TaskScheduler` task for `time_limit_seconds` in the future. The task closure captures `seqAtStart`.

**When the scheduled task fires:**
1. Read `session:{sessionId}:question_seq` from Redis.
2. If the current seq ≠ `seqAtStart`, the organiser already advanced — abort silently (stale timer).
3. If seq matches, proceed with the question progression flow (same logic as `POST /api/sessions/{id}/next`).

**When organiser manually advances (before timer fires):**
1. DEL `session:{sessionId}:timer` — cancels the logical timer.
2. INCR `session:{sessionId}:question_seq` — invalidates any in-flight scheduled task.
3. Proceed with question progression normally.

The `question_seq` integer makes the cancellation atomic from the scheduled task's perspective — no `ConcurrentHashMap`, no `ScheduledFuture` references to track, and this pattern is safe across multiple JVM instances if needed later.

> Note: Spring's `TaskScheduler` is still used for the actual delay mechanism — the difference is that the task is idempotent/no-op if the seq has changed. The in-memory task fires but does nothing harmful. Prefer `ThreadPoolTaskScheduler` with `setPoolSize(4)` as the bean.

> **Known v0 limitation:** If the JVM process dies mid-session, any scheduled timers are lost. The organiser will need to manually click Next to advance. This is acceptable for a single-node deployment. See the v1 scaling section below for the fix.

---

## V1 HORIZONTAL SCALING PATH

These two changes must ship together. Doing one without the other still leaves the system broken for multi-node deployments.

### 1. Replace Spring TaskScheduler with Quartz (JDBC JobStore)

**Why:** Spring's `TaskScheduler` is in-process. If the node that scheduled a timer dies, the timer is gone. Quartz with `JDBCJobStore` persists jobs in Postgres — any surviving node picks them up on its next cluster poll.

**What to add:**
```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-quartz</artifactId>
</dependency>
```

**Configuration (`application.yaml`):**
```yaml
spring:
  quartz:
    job-store-type: jdbc
    jdbc:
      initialize-schema: always   # creates Quartz tables automatically
    properties:
      org.quartz.jobStore.isClustered: true
      org.quartz.jobStore.clusterCheckinInterval: 2000   # ms — controls timer granularity
      org.quartz.scheduler.instanceId: AUTO
```

**What changes in the code:**
- Replace `ThreadPoolTaskScheduler` bean with a Quartz `JobDetail` + `Trigger` per question start
- The job class calls the same question progression logic (seq check still applies as a belt-and-suspenders guard)
- Cancel on manual advance: delete the Quartz trigger by key before INCR seq

**What stays the same:** the `question_seq` idempotency guard in Redis. Quartz's cluster lock ensures only one node fires the job, but the seq check costs nothing and protects against any edge cases.

Quartz creates 11 tables in Postgres (prefixed `QRTZ_`). These are managed automatically with `initialize-schema: always`. No manual migration needed for local dev.

> Clock sync requirement: all nodes must have NTP-synchronised clocks. Standard in any cloud environment (EC2, GKE, etc.). Not a concern in practice.

---

### 2. Replace In-Memory STOMP Broker with RabbitMQ Relay

**Why:** Spring's simple in-memory broker routes messages only to WebSocket connections on the same JVM. A broadcast from node A never reaches a subscriber connected to node B. With multiple nodes, participants and organisers will miss messages depending on which node they're connected to.

**What to add:**
```xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-reactor-netty</artifactId>
</dependency>
```
And run RabbitMQ with the STOMP plugin enabled (add to `docker-compose.yml`):
```yaml
rabbitmq:
  image: rabbitmq:3-management
  ports:
    - "5672:5672"    # AMQP
    - "61613:61613"  # STOMP
    - "15672:15672"  # management UI
  command: >
    sh -c "rabbitmq-plugins enable rabbitmq_stomp && rabbitmq-server"
```

**What changes in `WebSocketConfig`:**
```java
// Before (v0):
config.enableSimpleBroker("/topic");

// After (v1):
config.enableStompBrokerRelay("/topic")
      .setRelayHost("rabbitmq")
      .setRelayPort(61613);
```

That is the only code change. All `@MessageMapping` handlers, `SimpMessagingTemplate.convertAndSend(...)` calls, and client subscriptions remain identical.

---

### Why these must ship together

| Scenario | Result |
|---|---|
| Quartz only, no broker relay | Timers survive node failure ✅ but broadcasts still only reach subscribers on the firing node ❌ |
| Broker relay only, no Quartz | Broadcasts reach all nodes ✅ but timers die with their scheduling node ❌ |
| Both | Fully stateless backend nodes — any node can handle any session ✅ |

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
/join                      ← Participant enter join code + display name (CSR)
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

**The goal is a visually stunning UI with genuine personality — not generic AI-generated SaaS. Every screen should feel like it was designed by someone who cared deeply. Avoid: rounded cards on grey backgrounds, generic hero sections with gradient text, default Tailwind blue buttons, symmetrical bento grids, anything that looks like a shadcn demo.**

**Aesthetic:** Dark, electric, live-event energy. Think F1 timing screens, esports tournament overlays, Bloomberg terminal meets nightclub. The UI should feel like something is always happening, even when it's not.

**Colour system:**
- Base: `#0A0A0F` (near-black with a blue undertone — not pure black)
- Primary: `#2563EB` (blue-600) — used sparingly for key actions and live indicators, not plastered everywhere
- Accent: `#38BDF8` (sky-400) — for highlights, active states, glowing elements
- Surface: `#0F1117` cards/panels with `#1A1F2E` borders — barely-there separation
- Danger/wrong: `#EF4444` with a subtle red glow
- Success/correct: `#22C55E` with a subtle green glow
- Text: `#F8FAFC` primary, `#94A3B8` secondary — not pure white

**Typography:**
- Wordmark "HERMES": `font-black` tracking-widest, all-caps — feels stamped, not printed
- Question text: large, bold, high contrast — needs to be readable from across a room
- Numbers (scores, counts, timers): monospaced or tabular-nums, so they don't jump as digits change
- Labels and UI chrome: small, `tracking-wider`, uppercase — telegraphic

**Signature visual details — use these throughout:**
- **Glows:** `box-shadow: 0 0 20px rgba(37,99,235,0.4)` on active/live elements. The primary blue should glow, not just be a flat colour.
- **Scanline texture:** A subtle repeating horizontal line texture (CSS, very low opacity ~3%) on dark surfaces — gives depth without noise
- **Live indicator:** A pulsing dot (CSS animation, not Framer) next to anything live — session status, participant count during a live session
- **Grid/rule lines:** Thin `1px` lines at `opacity-10` to divide sections. No cards with borders and shadows — use ruled lines instead.
- **Monospaced numbers everywhere:** Scores, timer, counts — always `font-variant-numeric: tabular-nums` so layout doesn't shift

**Per-screen personality:**

*Landing page:* The logo and wordmark dominate. Asymmetric layout — not centred hero. One CTA left-aligned, one right. Background has a very subtle radial gradient bloom from centre (blue, barely visible). No illustrations, no feature lists, no testimonials.

*Join page (/join):* Giant join code input — the code field should feel like typing into a terminal. Monospaced font, `letter-spacing: 0.3em`, characters feel individual. Display name field below. Minimal chrome — this screen is about the action.

*Lobby (/session/[id]/play before start):* Full-screen, centred. Session name large at top. Participant count in the middle — huge, monospaced, ticks up with a bounce. Tagline: "Waiting for host to start…" in secondary text. Feels like a countdown without being a countdown.

*Host view (/session/[id]/host):* The most complex screen — treat it like a command centre. Left panel: question + progress + timer. Right panel: response graph or leaderboard (toggled). The timer should be the most visually dominant element when under 10s — it should grow or glow as it counts down. The response bar chart bars should look like energy bars, not Excel columns — thin, glowing at the top.

*Play view (/session/[id]/play):* Four answer buttons fill the screen in a 2×2 grid. Each option gets a distinct accent colour (not all blue) — e.g. blue, purple, amber, rose. On answer lock-in: the unchosen options fade to near-invisible, the chosen one gets a border glow. On question end: correct option floods green, wrong floods red.

*Results page (/session/[id]/results):* Score displayed huge, centred, with a staggered reveal. Each question row comes in with a slight delay. Right/wrong indicated with icon + colour, not just text.

**What not to do:**
- No `rounded-xl` cards with `shadow-lg` on everything
- No gradient text (`bg-clip-text` purple-to-pink) anywhere
- No confetti (cheap)
- No skeleton loaders that look like grey rectangles
- No hover tooltips for things that are already labelled
- No loading spinners — use skeleton states that match the actual layout

**All animations use Framer Motion** — no CSS transitions or Tailwind `transition` utilities for anything interactive. Key moments:
- Page transitions: fade + 8px vertical slide, 200ms
- Bar chart: width animated with spring physics (`stiffness: 300, damping: 30`) as counts update
- Leaderboard: `AnimatePresence` + `layout` prop — items slide to new rank position smoothly
- Answer buttons: `whileHover` scale 1.02, `whileTap` scale 0.97 — subtle, not bouncy
- Correct/wrong reveal: colour flood from centre outward using a clip-path animation
- Timer under 5s: scale pulses from 1.0 → 1.05 → 1.0 each second, colour shifts from white → amber → red
- Question advance: outgoing question exits left, incoming enters from right — feels like a carousel
- Lobby join count: number animates with `AnimatePresence` key on value change — old number exits up, new enters from below
- Score reveal: staggered `y: 20 → 0, opacity: 0 → 1` per row, 60ms delay between rows

---

## DOCKER SETUP

### docker-compose.yml (at repo root)
Services:
- postgres: postgres:18-alpine, port 5432, database hermes, user hermes, password hermes
- redis: redis:8-alpine, port 6379
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

backend application.yaml (the scaffold uses YAML, not .properties — docker-compose overrides via environment:):
```yaml
spring:
  datasource:
    url: jdbc:postgresql://postgres:5432/hermes
    username: hermes
    password: hermes
  data:
    redis:
      host: redis
      port: 6379
  threads:
    virtual:
      enabled: true
jwt:
  secret: <generate a strong default for local dev>
  expiration-ms: 86400000
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
- Join code generation: 6 uppercase alphanumeric characters. Attempt up to 5 times, checking uniqueness against Postgres each time. If all 5 attempts collide, throw a 500-level error (this is astronomically unlikely in practice with 36^6 ≈ 2.2B combinations). Also write `joincode:{code}` → sessionId to Redis after DB persist — this is the active join lookup key.
- Session join flow uses `joincode:{code}` Redis key to resolve sessionId. If key does not exist, session is not joinable (ended or invalid code). No Postgres lookup needed for join.
- Exactly one is_correct option per question enforced in service layer — throw a validation error if violated.
- Options are always saved/updated as a full replace (delete existing, insert new) when a question is updated.
- Do not expose is_correct in any API response that participants can access. It only appears in QUESTION_END broadcast and SESSION_END results.
- **Access control ownership:** "Auth required" is not sufficient on its own. Every organiser-authenticated endpoint that operates on an event, quiz, question, or session must verify the resource is owned by the authenticated user. Walk the FK chain: session → quiz → event → user_id == authenticated user. Return 403 Forbidden (not 404) if ownership check fails. Implement this as a reusable service-layer method, not inline in every controller.
- **Participant count semantics:** `session:{sessionId}:participant_count` and the `PARTICIPANT_JOINED` broadcast represent the total number of participants who have successfully joined (i.e., have a row in the `participants` table). This is a monotonically increasing counter — there are no leave events. It is not "currently connected sockets." Increment on `POST /api/sessions/join`, never decrement.
- **Display name:** required at join time. Validate as `@NotBlank`, max 30 characters. Stored in `participants.display_name`. Shown on the organiser's leaderboard. The `/join` page shows two fields: join code and display name, submitted together.
- CORS: allow http://localhost:3000 in development.
- Swagger UI available at /swagger-ui.html in all environments.
- Run mvn spotless:apply before any commit. CI should run mvn spotless:check.
- Frontend API calls use a centralised api.ts utility that attaches the JWT from context automatically.
- rejoinToken stored in browser localStorage under key hermes_rejoin_{sessionId}. Generate rejoin tokens as a cryptographically random alphanumeric string (32 chars), not a UUID.
- Participants are fully anonymous throughout — no WebSocket principal assignment. Personal results are fetched via REST after session end using the rejoinToken as identity.

---

## WHAT TO BUILD IN ORDER

1. Docker Compose and Dockerfiles
2. Backend: pom.xml dependencies (add spring-boot-starter-security, jjwt, springdoc-openapi), application.yaml
3. Backend: entities and repositories (include snapshot JSONB column on QuizSession entity)
4. Backend: Spring Security config (SecurityFilterChain, JwtUtil, UserDetailsService, BCryptPasswordEncoder), auth endpoints (register, login, /me)
5. Backend: event, quiz, question CRUD — include ownership verification service method and quiz edit guard (block edits when active session exists)
6. Backend: session REST endpoints (create — takes snapshot at this point, join, rejoin, start, end, next)
7. Backend: WebSocket config and STOMP channel interceptor (CONNECT + SUBSCRIBE authorization)
8. Backend: answer submission WebSocket handler (is_correct from snapshot, INSERT with duplicate-key handling)
9. Backend: question timer scheduling (Redis seq-based)
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
