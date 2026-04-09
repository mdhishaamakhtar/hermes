# 12 — Event Session Model + Participant Persistence

## What This Is

Introduces the `EventSession` entity — a joinable, participant-holding runtime container that wraps multiple quiz sessions. Participants join an event once and persist across all quizzes within it. The host controls quiz progression.

## Why It Is at Position 12

Depends on all single-quiz features being stable (items 01-11). The EventSession layers on top of the existing QuizSession engine — it doesn't replace it. Each quiz within the event still runs through the same QuizSession lifecycle.

## Prerequisites

- Items 01-11: All single-quiz features (schema, CRUD, host/participant UI) complete.

## Scope

### In Scope

- New `EventSession` entity with join code, status, and participant roster
- New `EventSessionStatus` enum: `LOBBY`, `ACTIVE`, `ENDED`
- Participants join the EventSession (not individual QuizSessions)
- When a quiz starts within the event, participants are automatically enrolled in the QuizSession
- Host controls: start event → start quiz 1 → quiz 1 ends → inter-quiz screen → start quiz 2 → ... → end event
- EventSession-scoped rejoin tokens (one per participant per event, valid for the entire event duration)
- REST API for EventSession lifecycle
- WebSocket topics for event-level broadcasts

### Out of Scope

- Cumulative leaderboard — item 13
- Frontend — item 14
- Running a quiz standalone (outside an event) — this already works and is unchanged

## Schema Changes

### New Entity: `EventSession`

```
event_sessions
├── id: Long (PK, auto)
├── event_id: Long (FK → events, non-null)
├── join_code: String (unique, non-null, 6-char)
├── status: EventSessionStatus (non-null, default LOBBY)
├── current_quiz_session_id: Long (FK → quiz_sessions, nullable)
├── started_at: OffsetDateTime (nullable)
├── ended_at: OffsetDateTime (nullable)
├── created_at: OffsetDateTime
└── snapshot: String (JSONB) — serialized event structure
```

### New Enum: `EventSessionStatus`

```java
public enum EventSessionStatus {
    LOBBY,    // Participants joining, no quiz started yet
    ACTIVE,   // At least one quiz is running or in inter-quiz state
    ENDED     // All quizzes complete, event concluded
}
```

### New Entity: `EventParticipant`

```
event_participants
├── id: Long (PK, auto)
├── event_session_id: Long (FK → event_sessions, non-null)
├── display_name: String (non-null)
├── rejoin_token: String (unique, non-null, 32-char)
├── joined_at: OffsetDateTime
```

This replaces the per-quiz `Participant` for event-scoped sessions. When a quiz starts within the event, a `Participant` record is created for each `EventParticipant`, linking them to the `QuizSession`.

### Modified: `QuizSession`

```
quiz_sessions (modified)
├── ... existing fields ...
├── event_session_id: Long (FK → event_sessions, nullable)
```

When `event_session_id` is non-null, this quiz session is part of an event. Its participants come from the EventSession roster. When null, it's a standalone quiz session (existing behavior unchanged).

### Modified: `Participant`

No schema change. For event-scoped quiz sessions, Participant records are auto-created from EventParticipant records when a quiz starts. The `rejoinToken` on the Participant can be the same as the EventParticipant's token, or a derived one.

**Decision:** Reuse the EventParticipant's `rejoinToken` for all QuizSessions within the event. This means the participant uses one token for the entire event. The `participant:{token}` Redis key maps to the EventParticipant ID, and a lookup resolves the current QuizSession's Participant ID from there.

## Redis Changes

### Event Session Keys

- `eventsession:{esid}:status` — EventSessionStatus
- `eventsession:{esid}:participant_count` — integer
- `eventsession:{esid}:current_quiz_session` — current QuizSession ID (or null)
- `eventsession:{esid}:names` — Hash { eventParticipantId: displayName }
- `joincode:{code}` — maps to `event_session:{esid}` (same namespace as quiz session join codes, prefixed to distinguish)

### Participant Token Resolution

`participant:{token}` → now can map to either a Participant ID (standalone) or an EventParticipant ID (event-scoped). Add a prefix to distinguish:

- `participant:standalone:{token}` → participantId
- `participant:event:{token}` → eventParticipantId

Or simpler: store a JSON value `{ "type": "event", "eventParticipantId": 5, "eventSessionId": 1 }` so the resolver can handle both cases.

## API Changes

### Event Session Lifecycle

```
POST   /api/event-sessions                     → Create (requires eventId in body)
POST   /api/event-sessions/{id}/start          → Start event (LOBBY → ACTIVE)
POST   /api/event-sessions/{id}/start-quiz     → Start next quiz within event
POST   /api/event-sessions/{id}/end            → End event session
GET    /api/event-sessions/{id}/lobby           → Lobby state (status, participant count, join code)
GET    /api/event-sessions/{id}/status          → Current status + which quiz is active
```

### Participant Join (Updated)

```
POST   /api/sessions/join
```

The join endpoint inspects the join code. If it maps to an EventSession, create an EventParticipant. If it maps to a QuizSession (standalone), create a Participant as before.

**Response for event join:**
```json
{
  "type": "event",
  "eventSessionId": 1,
  "participantId": 42,
  "rejoinToken": "abc123...",
  "eventTitle": "Biology Finals"
}
```

### Rejoin (Updated)

```
POST   /api/sessions/rejoin
```

For event-scoped tokens, returns the event session state + current quiz session state (if a quiz is active).

## WebSocket Topics

### New Event-Level Topic

```
/topic/eventsession.{esid}.control
  → EVENT_QUIZ_STARTED   { quizSessionId, quizTitle, quizIndex, totalQuizzes }
  → EVENT_QUIZ_ENDED     { quizSessionId, quizTitle }
  → EVENT_ENDED          { }
  → PARTICIPANT_JOINED   { count }
```

Participants subscribe to this topic for event-level navigation. When a quiz starts, they also subscribe to the quiz session's topics (reusing existing `/topic/session.{sid}.*`).

## Quiz Start Within Event Flow

```
1. Host calls POST /api/event-sessions/{esid}/start-quiz
2. Server determines next quiz (by orderIndex) in the event
3. Server creates a QuizSession for this quiz, linked to the EventSession
4. Server auto-creates Participant records for all EventParticipants
5. Server caches participant data in Redis (names, leaderboard entries)
6. Server broadcasts EVENT_QUIZ_STARTED to event topic
7. Participants' clients subscribe to the new QuizSession's STOMP topics
8. Normal quiz lifecycle proceeds (host displays first question, etc.)
9. When quiz ends, server broadcasts EVENT_QUIZ_ENDED
10. Host sees inter-quiz screen, presses "Start Next Quiz" when ready
```

## Local Testing

1. **Start services:** `docker-compose up`

2. **Create event session:** Via Swagger UI or frontend, navigate to an Event detail page. Create EventSession.

3. **Verify join code:** Copy the event join code (6 chars).

4. **Participants join event:** 3+ participants use `/app/join`, enter event code. All should join the same EventSession. Each gets a single `rejoinToken`.

5. **Host starts event:** Host calls `POST /api/event-sessions/{id}/start`. Event status transitions to ACTIVE.

6. **Host starts first quiz:** Host calls `POST /api/event-sessions/{id}/start-quiz`. Verify:
   - `EVENT_QUIZ_STARTED` broadcast to event topic
   - A QuizSession is created for the first quiz
   - Participants are enrolled (Participant records created)
   - Normal quiz lifecycle begins

7. **Quiz runs:** Run one full quiz (questions, answers, grading, review).

8. **Quiz ends:** Host advances past final question. Verify `EVENT_QUIZ_ENDED` broadcast.

9. **Inter-quiz:** Host and participants see inter-quiz screen. Verify cumulative standings (currently empty, item 13).

10. **Start next quiz:** Host starts second quiz. Verify new QuizSession created, participants re-enrolled with same rejoinToken.

11. **Rejoin test:** Mid-session, participant refreshes. Should rejoin with event token and resume in current quiz.

12. **Verify standalone sessions still work:** Create a standalone QuizSession (not in an event). Participant joins with that code. Should work as before.

## Acceptance Criteria

- [ ] EventSession can be created for an Event with a join code
- [ ] Participants join an EventSession and receive a single rejoin token for the entire event
- [ ] Host can start the event (LOBBY → ACTIVE)
- [ ] Host can start individual quizzes within the event in order
- [ ] Participants are automatically enrolled in each QuizSession when it starts
- [ ] Quiz lifecycle (items 05-09) works identically within an event context
- [ ] Event-level WebSocket topic broadcasts quiz start/end events
- [ ] Rejoin with event-scoped token returns correct event + quiz state
- [ ] Standalone quiz sessions (no event) continue to work unchanged
- [ ] Join code namespace handles both EventSession and standalone QuizSession codes
