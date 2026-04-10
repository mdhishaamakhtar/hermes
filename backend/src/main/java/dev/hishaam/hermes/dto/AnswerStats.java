package dev.hishaam.hermes.dto;

import java.util.Map;

public record AnswerStats(
    Map<Long, Long> optionCounts, long totalAnswered, long totalParticipants, long totalLockedIn) {}
