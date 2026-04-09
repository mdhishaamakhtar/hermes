# 09 — Post-Quiz Answer Correction + Leaderboard Recalculation

## What This Is

After a quiz session ends (or during the review window), the host can correct which options are correct and their point values. The server re-grades all participant answers and rebroadcasts the corrected leaderboard in real-time.

## Why It Is at Position 9

Depends on the grading engine (item 07) for the `regradeQuestion` capability. Must precede the frontend host session (item 10) which exposes the correction UI.

## Prerequisites

- Items 01-08: All backend runtime features complete.

## Scope

### In Scope

- API endpoint for host to patch option correctness/point values on a completed session
- Patching the session snapshot (not the original quiz template)
- Full re-grading of all participant answers for the affected question
- Leaderboard recalculation and rebroadcast to connected clients
- Correction available during REVIEWING state (per-question) and after SESSION_END (per-session)

### Out of Scope

- Frontend correction UI — item 10
- Modifying the original quiz template (corrections apply only to this session's snapshot)
- Cumulative event leaderboard recalculation — item 13 (will call the same regrading logic)

## API Changes

### PATCH `/api/sessions/{sessionId}/questions/{questionId}/scoring`

Host corrects the scoring for a specific question within a session.

**Request:**
```json
{
  "options": [
    { "optionId": 10, "pointValue": 10 },
    { "optionId": 11, "pointValue": 0 },
    { "optionId": 12, "pointValue": 10 },
    { "optionId": 13, "pointValue": -5 }
  ]
}
```

**Behavior:**
1. Validate: session belongs to host (ownership check)
2. Validate: session is in REVIEWING or ENDED state
3. Validate: question exists in this session's snapshot
4. Update the snapshot's option point values for this question
5. Persist updated snapshot to both Redis and PostgreSQL
6. Call `GradingService.regradeQuestion(sessionId, questionId)`
7. Rebroadcast corrected leaderboard

**Response:** `200 OK` with updated question scoring summary.

## Regrading Logic

`GradingService.regradeQuestion(sessionId, questionId)`:

```
1. Load all ParticipantAnswers for this question in this session
2. Load updated option point values from snapshot
3. For each answer:
   a. Compute new score = sum(pointValue for selected options), floored at 0
   b. Compute delta = newScore - previousScore
   c. Update stored question score
4. Recompute full leaderboard:
   a. For each participant, sum all question scores
   b. Update Redis sorted set with new totals
5. Broadcast LEADERBOARD_UPDATE to host analytics topic
6. Broadcast PARTICIPANT_LEADERBOARD to all clients
7. If corrected during REVIEWING state, rebroadcast QUESTION_REVIEWED with updated optionPoints
```

**Why full recompute instead of delta?** Deltas are error-prone if multiple corrections happen in sequence. A full recompute from stored answers + current snapshot is always correct. With typical session sizes (<1000 participants, <50 questions), this is fast enough.

## WebSocket Events

### `SCORING_CORRECTED` (Server → All Clients on question topic)

Notifies all connected clients that scoring has changed:

```json
{
  "event": "SCORING_CORRECTED",
  "questionId": 42,
  "correctOptionIds": [10, 12],
  "optionPoints": { "10": 10, "11": 0, "12": 10, "13": -5 }
}
```

Participants recalculate their own score for this question using local selection state.

### Updated `LEADERBOARD_UPDATE` / `PARTICIPANT_LEADERBOARD`

Same shape as item 07 — rebroadcast with corrected scores.

## Snapshot Mutation

The session snapshot is normally immutable after creation. Answer correction is the one exception. The snapshot is patched in-place:

- Redis: update the snapshot string at `session:{sid}:snapshot`
- PostgreSQL: update the `snapshot` JSONB column on `QuizSession`

A `correctedAt: OffsetDateTime` field is added to the snapshot per question to track which questions have been corrected and when.

## Local Testing

1. **Start services:** `docker-compose up`

2. **Run a session to completion:** Create quiz, run it, let grading complete. Verify initial leaderboard.

3. **Host corrects scoring:** Call `PATCH /api/sessions/{id}/questions/{qid}/scoring`:
   ```json
   {
     "options": [
       { "optionId": 10, "pointValue": 5 },
       { "optionId": 11, "pointValue": 0 }
     ]
   }
   ```
   (Originally optionId 10 was 10pts, now 5pts)

4. **Verify snapshot update:** Check session snapshot in PostgreSQL — option point values should be updated.

5. **Verify leaderboard recalculation:** Fetch leaderboard via API or WebSocket — scores should be lower. Host with 2x option 10 selections should drop from 20pts to 10pts.

6. **Check Redis:** Redis leaderboard sorted set should reflect corrected scores.

7. **Verify broadcast:** If clients are connected, `LEADERBOARD_UPDATE` should be broadcast with new scores.

8. **Verify stored scores:** Check `participant_answers` table — `isCorrect` or score fields should be updated.

9. **Multiple corrections:** Correct the same question twice. Verify final result is based on most recent correction, not cumulative.

10. **Verify ownership:** Try correcting as a different user — should fail with 403.

## Acceptance Criteria

- [ ] Host can PATCH option point values for any question in a completed or reviewing session
- [ ] Snapshot is updated in both Redis and PostgreSQL
- [ ] All participant answers are re-graded against updated point values
- [ ] Leaderboard is fully recomputed and rebroadcast
- [ ] `SCORING_CORRECTED` event sent to all connected clients
- [ ] Participants on the results screen see their scores update live
- [ ] Multiple corrections to the same question work correctly (full recompute, not delta)
- [ ] Original quiz template is NOT modified — corrections are session-scoped
- [ ] Ownership check: only the session's host can make corrections
