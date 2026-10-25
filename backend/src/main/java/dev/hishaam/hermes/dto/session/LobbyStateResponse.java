package dev.hishaam.hermes.dto.session;

import java.util.List;

/**
 * The room as the organiser's screens show it: the quiz title for the big screen, everyone who has
 * joined in the order they arrived, and whether this is the host's own rehearsal.
 */
public record LobbyStateResponse(
    String status,
    long participantCount,
    String joinCode,
    String quizTitle,
    List<PlayerInfo> players,
    boolean rehearsal) {}
