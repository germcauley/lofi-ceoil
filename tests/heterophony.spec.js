import { test, expect } from '@playwright/test';
import { playCounter } from '../src/parts.js';

const seeded = seed => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

const PHRASE = [
  { at: 0, degree: 4, length: 2, dynamic: 0.9 },
  { at: 2, degree: 5, length: 1, dynamic: 0.8 },
  { at: 3, degree: 6, length: 1, dynamic: 0.8 },
  { at: 4, degree: 5, length: 2, dynamic: 0.85 },
  { at: 6, degree: 4, length: 1, dynamic: 0.8 },
  { at: 7, degree: 3, length: 1, dynamic: 0.8 }
];

function run (repeats = 300, phrase = PHRASE) {
  const played = [];
  const state = {
    pluck: { triggerAttackRelease (note, duration, at, velocity) {
      played.push ({ note, duration, at, velocity });
    } },
    rootMidi: 48, scale: 'dorian', meter: '4/4', tempo: 80,
    counter: 0.55, random: seeded (99), swing: 0
  };

  const bars = [];
  for (let i = 0; i < repeats; i++) {
    played.length = 0;
    playCounter (state, 0, 0, [0, 'min7'], { texture: 'heterophony' }, phrase);
    bars.push ([...played]);
  }
  return bars;
}

test ('the second player agrees on the beat and differs in between', () => {
  const eighth = 60 / 80 / 2;
  const onBeat = [], offBeat = [];

  for (const bar of run()) {
    for (const note of bar) {
      if (note.duration < 0.05) continue;            // a grace, not a melody note
      const slot = Math.round (note.at / eighth);
      const deviation = Math.abs (note.at - slot * eighth);
      (slot === 0 || slot === 4 ? onBeat : offBeat).push (deviation);
    }
  }

  const mean = list => list.reduce ((sum, n) => sum + n, 0) / list.length;
  expect (onBeat.length).toBeGreaterThan (10);
  expect (offBeat.length).toBeGreaterThan (10);

  // This is the whole idea: the divergence in between is only legible because
  // the players keep landing together on the structural notes.
  expect (mean (offBeat)).toBeGreaterThan (mean (onBeat) * 2);
});

test ('it thins the tune rather than doubling it', () => {
  const bars = run();
  const notes = bars.map (bar => bar.filter (note => note.duration >= 0.05).length);
  const average = notes.reduce ((sum, n) => sum + n, 0) / notes.length;

  // Fewer notes than the melody has: the second player leaves some out and
  // holds through others. Doubling every note is a chorus effect, not a player.
  expect (average).toBeLessThan (PHRASE.length);
  expect (average).toBeGreaterThan (PHRASE.length * 0.4);

  // And it is not the same thinning every bar, or it would just be a variant.
  expect (new Set (notes).size).toBeGreaterThan (1);
});

test ('nothing is ever scheduled before the bar it belongs to', () => {
  // The second player is allowed to come in ahead of the beat, which on the
  // downbeat would mean scheduling before the bar started.
  for (const bar of run (400)) {
    for (const note of bar) expect (note.at).toBeGreaterThanOrEqual (0);
  }
});

test ('a cadence is one of the notes the players land on together', () => {
  const eighth = 60 / 80 / 2;
  const phrase = PHRASE.map ((event, i) =>
    i === PHRASE.length - 1 ? { ...event, cadence: true, scaleDegree: 0 } : event);

  const deviations = [];
  for (const bar of run (300, phrase)) {
    for (const note of bar) {
      if (note.duration < 0.05) continue;
      const slot = Math.round (note.at / eighth);
      if (slot === 7) deviations.push (Math.abs (note.at - slot * eighth));
    }
  }

  expect (deviations.length).toBeGreaterThan (10);
  const mean = deviations.reduce ((sum, n) => sum + n, 0) / deviations.length;
  expect (mean).toBeLessThan (0.02);
});
