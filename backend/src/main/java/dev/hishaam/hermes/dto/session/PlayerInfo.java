package dev.hishaam.hermes.dto.session;

/** A player in the room, as the host's screens list them. */
public record PlayerInfo(Long participantId, String displayName) {}
