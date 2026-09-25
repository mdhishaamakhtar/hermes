/**
 * What this device remembers about sessions, in localStorage:
 *   hermes_session_{id}  the join code of a session this organiser launched
 *   hermes_rejoin_{id}   a player's rejoin token, their identity in a session
 *   hermes_name_{id}     the name that player joined under
 *
 * Every access is guarded: storage can be disabled or full (some embedded
 * browsers, strict privacy modes), and that must degrade to "remembers
 * nothing", never to a crash on the join screen.
 */

const JOIN_CODE = "hermes_session_";
const REJOIN_TOKEN = "hermes_rejoin_";
const DISPLAY_NAME = "hermes_name_";

type SessionId = string | number;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Nothing to do: the session still works, it just won't be remembered.
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // As above.
  }
}

export function getStoredJoinCode(sessionId: SessionId): string {
  return read(`${JOIN_CODE}${sessionId}`) ?? "";
}

export function storeJoinCode(sessionId: SessionId, joinCode: string) {
  write(`${JOIN_CODE}${sessionId}`, joinCode);
}

export function getStoredRejoinToken(sessionId: SessionId): string | null {
  return read(`${REJOIN_TOKEN}${sessionId}`);
}

export function getStoredDisplayName(sessionId: SessionId): string | null {
  return read(`${DISPLAY_NAME}${sessionId}`);
}

export function storePlayer(
  sessionId: SessionId,
  rejoinToken: string,
  displayName: string,
) {
  write(`${REJOIN_TOKEN}${sessionId}`, rejoinToken);
  write(`${DISPLAY_NAME}${sessionId}`, displayName);
}

export function forgetPlayer(sessionId: SessionId) {
  remove(`${REJOIN_TOKEN}${sessionId}`);
  remove(`${DISPLAY_NAME}${sessionId}`);
}

/** Sessions this device has joined, newest key order not guaranteed. */
export function listJoinedSessions(): Array<{
  sessionId: string;
  token: string;
}> {
  try {
    return Object.keys(localStorage)
      .filter((key) => key.startsWith(REJOIN_TOKEN))
      .flatMap((key) => {
        const token = localStorage.getItem(key);
        return token
          ? [{ sessionId: key.slice(REJOIN_TOKEN.length), token }]
          : [];
      });
  } catch {
    return [];
  }
}
