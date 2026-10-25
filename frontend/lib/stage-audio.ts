"use client";

/*
 * The big screen's sound: a handful of soft bell tones on the moments a
 * gallery would mark (answers opening, time up, the reveal, the standings,
 * the podium) and nothing else. No ticking clock, no chirp per player: the
 * room should notice the moment, not the sound. Synthesised rather than
 * sampled, so there is nothing to download and every cue sits in one key.
 * Off by default; a browser only lets audio start after someone presses
 * something, so turning it on is also what unlocks it.
 */

let context: AudioContext | null = null;
let master: GainNode | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!context) {
    const Context =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Context) return null;
    context = new Context();
    // Everything passes through one low-pass, so no cue is ever bright or
    // sharp on a hall's speakers.
    const tone = context.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2600;
    master = context.createGain();
    master.gain.value = 0.35;
    master.connect(tone).connect(context.destination);
  }
  return context;
}

/**
 * One bell tone: a sine with a quieter octave above it that fades first,
 * a soft 20ms attack and a long exponential tail, so it rings rather than
 * beeps.
 */
function bell(frequency: number, { at = 0, ring = 1.1, volume = 0.1 } = {}) {
  const ctx = audio();
  if (!ctx || !master || ctx.state !== "running") return;
  const start = ctx.currentTime + at;
  const partials = [
    { ratio: 1, level: 1, ring },
    { ratio: 2, level: 0.18, ring: ring * 0.45 },
  ];
  for (const partial of partials) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency * partial.ratio, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(
      volume * partial.level,
      start + 0.02,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, start + partial.ring);
    oscillator.connect(gain).connect(master);
    oscillator.start(start);
    oscillator.stop(start + partial.ring + 0.05);
  }
}

// One key (C major) for every cue, so they sound like one station.
const G4 = 392;
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

export const stageAudio = {
  /** Call from a press: browsers keep audio suspended until one. */
  async unlock() {
    const ctx = audio();
    if (ctx && ctx.state !== "running") await ctx.resume();
  },
  answersOpen() {
    bell(C5, { volume: 0.08 });
    bell(G5, { at: 0.14, volume: 0.07 });
  },
  timeUp() {
    bell(G4, { ring: 1.4, volume: 0.08 });
  },
  reveal() {
    bell(C5, { volume: 0.08 });
    bell(E5, { at: 0.12, volume: 0.08 });
    bell(G5, { at: 0.24, ring: 1.6, volume: 0.08 });
  },
  standings() {
    bell(G4, { volume: 0.07 });
    bell(C5, { at: 0.16, ring: 1.4, volume: 0.07 });
  },
  /** A podium place landing; the winner gets the full rise. */
  place(rank: number) {
    if (rank === 1) {
      [C5, E5, G5, C6].forEach((frequency, index) =>
        bell(frequency, { at: index * 0.16, ring: 1.8, volume: 0.08 }),
      );
    } else {
      bell(rank === 2 ? E5 : C5, { ring: 1.3, volume: 0.07 });
    }
  },
};

/*
 * Whether the big screen plays sound: a per-machine preference, kept in
 * this browser so a projector laptop remembers it between sessions.
 */
const SOUND_KEY = "hermes_screen_sound";
const listeners = new Set<() => void>();
let soundOn: boolean | null = null;

function readSound(): boolean {
  if (soundOn === null) {
    try {
      soundOn = localStorage.getItem(SOUND_KEY) === "on";
    } catch {
      soundOn = false;
    }
  }
  return soundOn;
}

export const soundSetting = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  get: readSound,
  getServer: () => false,
  async set(on: boolean) {
    if (on) await stageAudio.unlock();
    soundOn = on;
    try {
      localStorage.setItem(SOUND_KEY, on ? "on" : "off");
    } catch {
      // Storage refused: the choice lasts until the page closes.
    }
    listeners.forEach((listener) => listener());
  },
};
