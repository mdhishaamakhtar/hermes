package dev.hishaam.hermes.dto.session;

import java.util.List;

/**
 * The room as the organiser's screens show it: the quiz title for the big screen, and everyone who
 * has joined, in the order they arrived.
 */
public record LobbyStateResponse(
    String status,
    long participantCount,
    String joinCode,
    String quizTitle,
    List<PlayerInfo> players) {}
