package dev.hishaam.hermes.entity.enums;

/**
 * What the big screen shows while a session is live. QUESTION is the default; the host can cut to
 * STANDINGS between questions, once one is reviewed. Advancing to the next question always cuts
 * back. Lives in Redis only, with the rest of the live state.
 */
public enum StageScene {
  QUESTION,
  STANDINGS
}
