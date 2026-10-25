package dev.hishaam.hermes.dto.session;

/** The lobby as the organiser's screens show it, with the quiz title for the big screen. */
public record LobbyStateResponse(
    String status, long participantCount, String joinCode, String quizTitle) {}
