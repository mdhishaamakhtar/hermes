# 13 — Cumulative Event Leaderboard

## What This Is

Aggregates scores across all quiz sessions within an event session into a cumulative leaderboard. Updated after each quiz ends. Shown as the final screen when the event concludes.

## Why It Is at Position 13

Depends on the EventSession model (item 12) and the grading engine (item 07). The cumulative leaderboard reads from per-quiz leaderboards and aggregates them.

## Prerequisites

- Items 01-12: All single-quiz and event session features complete.

## Scope

### In Scope

- Redis-backed cumulative leaderboard for EventSessions
- Update cumulative scores after each QuizSession ends
- Recompute on answer correction (item 09) within any quiz in the event
- Broadcast cumulative leaderboard to event topic after each quiz
- Final cumulative leaderboard broadcast on event end
- REST endpoint for cumulative results
- Tiebreaker: total cumulative answer time across all quizzes

### Out of Scope

- Frontend — item 14
- Per-quiz leaderboards — already handled in items 07, 09

## Redis Data Structures

### Cumulative Leaderboard

`eventsession:{esid}:cumulative_leaderboard` — Sorted Set

Same encoding as per-quiz leaderboard: `score * 1_000_000 - totalMilliseconds`.

Key: EventParticipant ID.

### Cumulative Time

`eventsession:{esid}:cumulative_time` — Hash { eventParticipantId: totalMilliseconds }

Sum of per-quiz cumulative times.

### Per-Quiz Score Tracking

`eventsession:{esid}:quiz_scores:{quizSessionId}` — Hash { eventParticipantId: quizScore }

Stores each participant's total score for each quiz. Used for:
- Displaying per-quiz breakdowns in the final results
- Recomputation when a quiz's scores are corrected

## Aggregation Logic

### After Quiz Ends

```
1. QuizSession ends → grading complete → per-quiz leaderboard finalized
2. For each EventParticipant:
   a. Read their score from the quiz's leaderboard
   b. Store in eventsession:{esid}:quiz_scores:{qsid}
   c. Compute cumulative = sum of all quiz_scores for this participant
   d. Read cumulative time from per-quiz cumulative_time, add to event cumulative_time
   e. Update cumulative_leaderboard sorted set
3. Broadcast CUMULATIVE_LEADERBOARD_UPDATE to event topic
```

### On Answer Correction

When `GradingService.regradeQuestion()` runs for a quiz within an event:

```
1. Per-quiz leaderboard is recomputed (item 09)
2. Read corrected quiz scores for all participants
3. Update eventsession:{esid}:quiz_scores:{qsid}
4. Recompute cumulative leaderboard from all quiz_scores
5. Broadcast CUMULATIVE_LEADERBOARD_UPDATE
```

## WebSocket Events

### `CUMULATIVE_LEADERBOARD_UPDATE` (Server → Event Topic)

```
/topic/eventsession.{esid}.control

{
  "event": "CUMULATIVE_LEADERBOARD_UPDATE",
  "leaderboard": [
    { "rank": 1, "displayName": "Alice", "cumulativeScore": 85, "quizScores": [30, 25, 30] },
    { "rank": 2, "displayName": "Bob", "cumulativeScore": 78, "quizScores": [25, 28, 25] }
  ],
  "quizTitles": ["Biology", "Chemistry", "Physics"],
  "totalParticipants": 30
}
```

Includes per-quiz score breakdown so the UI can show a table.

### `EVENT_FINAL_RESULTS` (Server → Event Topic)

Sent when the event session ends. Same shape as `CUMULATIVE_LEADERBOARD_UPDATE` but signals that this is the final, complete result.

## REST API

### GET `/api/event-sessions/{id}/results`

Returns full cumulative results for the event session. Auth required (host only).

```json
{
  "eventSessionId": 1,
  "eventTitle": "Science Olympics",
  "status": "ENDED",
  "quizzes": [
    { "quizSessionId": 10, "title": "Biology", "questionCount": 10 },
    { "quizSessionId": 11, "title": "Chemistry", "questionCount": 8 }
  ],
  "leaderboard": [
    {
      "rank": 1,
      "displayName": "Alice",
      "cumulativeScore": 85,
      "quizScores": [30, 25, 30]
    }
  ],
  "totalParticipants": 30
}
```

### GET `/api/event-sessions/{id}/my-results`

Participant's personal cumulative results. Requires `X-Rejoin-Token` header.

```json
{
  "displayName": "Alice",
  "rank": 1,
  "totalParticipants": 30,
  "cumulativeScore": 85,
  "quizResults": [
    { "quizTitle": "Biology", "score": 30, "correctCount": 8, "totalQuestions": 10 },
    { "quizTitle": "Chemistry", "score": 25, "correctCount": 6, "totalQuestions": 8 }
  ]
}
```

## Local Testing

1. **Start services:** `docker-compose up`

2. **Run event with 3 quizzes:** Create event session, add 3 quizzes (Q1, Q2, Q3). Run all three with ~3 participants.

3. **After Q1 ends:** Verify `CUMULATIVE_LEADERBOARD_UPDATE` broadcast with:
   ```
   {
     "leaderboard": [
       { "rank": 1, "displayName": "Alice", "cumulativeScore": 25, "quizScores": [25, 0, 0] },
       { "rank": 2, "displayName": "Bob", "cumulativeScore": 20, "quizScores": [20, 0, 0] }
     ],
     "quizTitles": ["Q1", "Q2", "Q3"]
   }
   ```

4. **After Q2 ends:** Verify cumulative scores updated (sum of Q1 + Q2). quizScores array now has [Q1 score, Q2 score, 0].

5. **After Q3 ends:** Verify final cumulative. Example: Alice [25, 30, 20] = 75 total.

6. **Test answer correction in Q1:** After event is over, host corrects a Q1 answer. Verify cumulative leaderboard recomputed and rebroadcast.

7. **Host API:** Call `GET /api/event-sessions/{id}/results` (auth required). Should return full leaderboard with per-quiz breakdown:
   ```json
   {
     "leaderboard": [
       {
         "rank": 1,
         "displayName": "Alice",
         "cumulativeScore": 75,
         "quizScores": [25, 30, 20]
       }
     ],
     "quizzes": [
       { "title": "Q1", "questionCount": 10 },
       { "title": "Q2", "questionCount": 8 },
       { "title": "Q3", "questionCount": 12 }
     ]
   }
   ```

8. **Participant API:** Call `GET /api/event-sessions/{id}/my-results` with rejoin token. Should return personal results:
   ```json
   {
     "displayName": "Alice",
     "rank": 1,
     "cumulativeScore": 75,
     "quizResults": [
       { "quizTitle": "Q1", "score": 25, "correctCount": 7, "totalQuestions": 10 },
       { "quizTitle": "Q2", "score": 30, "correctCount": 8, "totalQuestions": 8 },
       { "quizTitle": "Q3", "score": 20, "correctCount": 5, "totalQuestions": 12 }
     ]
   }
   ```

9. **Tiebreaker test:** Create scenario where two participants have same cumulative score. Verify tiebreaker by total cumulative answer time (earlier answers win).

10. **Redis verification:** Check `eventsession:{esid}:quiz_scores:{qsid}` hashes — should track per-quiz scores for all participants.

## Acceptance Criteria

- [ ] Cumulative leaderboard updates after each quiz session ends
- [ ] Cumulative scores = sum of per-quiz scores for each participant
- [ ] Tiebreaker by cumulative answer time across all quizzes
- [ ] Answer correction in any quiz triggers cumulative leaderboard recomputation
- [ ] `CUMULATIVE_LEADERBOARD_UPDATE` broadcast includes per-quiz score breakdown
- [ ] `EVENT_FINAL_RESULTS` broadcast on event session end
- [ ] Host can retrieve full cumulative results via REST
- [ ] Participant can retrieve personal cumulative results via REST
- [ ] Per-quiz score tracking in Redis enables efficient recomputation
