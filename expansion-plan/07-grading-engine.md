# 07 — Grading Engine

## What This Is

A server-side grading engine that computes scores when answers are frozen. Replaces the current binary +1/+0 scoring with sum-of-option-point-values. Handles all question types uniformly and broadcasts per-participant score breakdowns.

## Why It Is at Position 7

Depends on answer mutability (item 05) for the finalized answer set and the question lifecycle (item 06) for the freeze trigger. Must precede display mode runtime (item 08) because the grading results are what display modes control visibility of.

## Prerequisites

- Items 01-06: Schema, CRUD, mutability, and manual timer flow complete.

## Scope

### In Scope

- Grading logic: sum of `pointValue` for all selected options
- Per-participant score computation on freeze
- Leaderboard update (Redis sorted set)
- `QUESTION_REVIEWED` WebSocket event with correct answers and score breakdown
- Per-participant results broadcast
- Handling all question types: SINGLE_SELECT, MULTI_SELECT, passage sub-questions

### Out of Scope

- Display mode enforcement (which clients see what) — item 08
- Post-quiz answer correction — item 09
- Frontend rendering of results — items 10, 11
- Speed bonus — explicitly out of scope

## Grading Algorithm

When a question (or set of passage sub-questions) transitions to FROZEN:

```
For each participant who has a ParticipantAnswer for this question:
    score = sum(option.pointValue for option in selectedOptions)
    score = max(score, 0)  // Floor at 0 — a question cannot subtract from total
    
    Store: questionScore for this participant + question
    Update: leaderboard sorted set (increment by questionScore)

For participants who did NOT answer:
    score = 0 (no entry needed, leaderboard unchanged)
```

**Floor at 0 rationale:** A participant who picks all trap options should score 0 for the question, not go negative. Negative point values exist to reduce the benefit of guessing (picking everything) in multi-select, but the minimum per-question score is 0.

### Passage Grading

- **PER_SUB_QUESTION:** Each sub-question is graded independently when frozen (same as standalone questions).
- **ENTIRE_PASSAGE:** All sub-questions are graded together when the passage timer expires. Each sub-question still produces its own score (floored at 0). The sum of sub-question scores is added to the leaderboard.

## Tiebreaker

When two participants have the same leaderboard score, the tiebreaker is **cumulative answer time**: the sum of (answeredAt - questionTimerStartedAt) across all answered questions. Lower is better.

Redis key: `session:{sid}:cumulative_time` — Hash { participantId: totalMilliseconds }. Updated at grading time by adding the participant's answer time for the just-graded question.

The leaderboard sorted set score is encoded as: `totalPoints * 1_000_000 - totalMilliseconds` (assuming totalMilliseconds is capped at 999,999 per session, which is ~16 minutes of cumulative answer time). This allows Redis ZREVRANGEBYSCORE to sort by points descending, then by speed ascending, in a single sorted set.

## WebSocket Events

### `QUESTION_REVIEWED` (Server → All Clients on question topic)

Broadcast after grading completes. This is what participants see.

```json
{
  "event": "QUESTION_REVIEWED",
  "questionId": 42,
  "correctOptionIds": [10, 12],
  "optionPoints": { "10": 10, "11": -5, "12": 10, "13": 0 }
}
```

Contains the correct answers and point values for all options so the participant's client can show "you picked X which was worth Y points."

### Per-Participant Score (Server → Individual Participant)

After `QUESTION_REVIEWED`, each participant receives a personal message with their score. This uses a user-specific destination:

**Option: Embed in the broadcast.** Since participants don't see each other's answers, the broadcast can include a generic result and each participant's client computes their own score from their local selection + the `optionPoints` map. This avoids per-participant messages entirely.

**Recommended approach:** Include `optionPoints` in the `QUESTION_REVIEWED` broadcast. The participant's client already knows which options they selected (local state). The client computes: `myScore = sum(optionPoints[id] for id in mySelectedOptions)`, floored at 0. No per-user WebSocket messages needed.

### `LEADERBOARD_UPDATE` (Server → Host analytics topic)

Updated leaderboard after grading:

```json
{
  "event": "LEADERBOARD_UPDATE",
  "leaderboard": [
    { "rank": 1, "participantId": 5, "displayName": "Alice", "score": 30 },
    { "rank": 2, "participantId": 8, "displayName": "Bob", "score": 25 }
  ]
}
```

### `PARTICIPANT_LEADERBOARD` (Server → All Clients on question topic)

A limited leaderboard broadcast to all participants (top 5 + the participant's own rank):

```json
{
  "event": "PARTICIPANT_LEADERBOARD",
  "top": [
    { "rank": 1, "displayName": "Alice", "score": 30 },
    { "rank": 2, "displayName": "Bob", "score": 25 }
  ],
  "totalParticipants": 30
}
```

Each participant's client shows the top 5 and their own position (computed from `myScore` relative to the list). This avoids sending individual positions to each participant via separate messages.

## Service Changes

### New: `GradingService`

```java
public class GradingService {
    // Called when a question transitions to FROZEN
    void gradeQuestion(Long sessionId, Long questionId);
    
    // Called for ENTIRE_PASSAGE mode — grades all sub-questions
    void gradePassage(Long sessionId, Long passageId);
    
    // Regrade after host correction (item 09)
    void regradeQuestion(Long sessionId, Long questionId);
}
```

### Updated: `SessionEngine`

The `advanceSessionInternal` flow becomes:

```
Timer expires or host ends timer →
  Broadcast QUESTION_FROZEN →
  Call GradingService.gradeQuestion() →
  Broadcast QUESTION_REVIEWED →
  Broadcast LEADERBOARD_UPDATE (host) →
  Broadcast PARTICIPANT_LEADERBOARD (all) →
  Set question state to REVIEWING →
  Wait for host to advance
```

## Local Testing

1. **Start services:** `docker-compose up`

2. **Create quiz with varied scoring:**
   - Q1 (SINGLE_SELECT): A=10pts, B=0pts
   - Q2 (MULTI_SELECT): A=10pts, B=10pts, C=-5pts (trap)

3. **Run session with test participants:** Join as 3+ participants:
   - Participant 1: Q1→A, Q2→[A,B]
   - Participant 2: Q1→B, Q2→[A,B,C]
   - Participant 3: Q1→A, Q2→[C]

4. **Trigger grading:** Wait for timer to expire (or host ends timer early). Verify `QUESTION_REVIEWED` event broadcast:
   ```
   {
     "event": "QUESTION_REVIEWED",
     "questionId": 42,
     "correctOptionIds": [10],
     "optionPoints": { "10": 10, "11": 0 }
   }
   ```

5. **Verify scoring:**
   - Participant 1: Q2 = 10+10=20 (no penalty since not -5)
   - Participant 2: Q2 = 10+10-5=15 (selected trap)
   - Participant 3: Q2 = 0-5=-5, floored to 0

6. **Check leaderboard:** Verify `LEADERBOARD_UPDATE` event with correct cumulative scores:
   - Participant 1: 10+20=30
   - Participant 2: 0+15=15
   - Participant 3: 10+0=10

7. **Verify database:** Check `participant_answers` table — scores should be computed and stored. Redis leaderboard sorted set should match.

8. **Test tiebreaker:** Create scenario where two participants have same score. Verify tiebreaker by answer time (earlier answers win).

## Acceptance Criteria

- [ ] Single-select: score = pointValue of selected option (floored at 0)
- [ ] Multi-select: score = sum of pointValues of all selected options (floored at 0)
- [ ] Participants who didn't answer score 0
- [ ] Leaderboard sorted set is updated atomically after grading
- [ ] Tiebreaker by cumulative answer time works correctly
- [ ] `QUESTION_REVIEWED` broadcast includes correctOptionIds and optionPoints map
- [ ] Participants can compute their own score client-side from local selection + optionPoints
- [ ] `PARTICIPANT_LEADERBOARD` sent to all clients with top 5
- [ ] Passage sub-questions graded independently (PER_SUB_QUESTION) or together (ENTIRE_PASSAGE)
- [ ] `GradingService.regradeQuestion()` exists as a hook for item 09
