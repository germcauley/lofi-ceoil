import { test, expect } from '@playwright/test';
import { createMelodyGenerator } from '../src/melody.js';
import { playMelody } from '../src/parts.js';

const seeded = seed => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

test ('ornaments are chosen the way a player chooses them', () => {
  const generator = createMelodyGenerator (seeded (5), '6/8');
  const kinds = {};
  let notes = 0, repeatedSeparated = 0, repeatedPairs = 0;

  for (let i = 0; i < 2000; i++) {
    const phrase = generator.createPhrase ('dorian', generator.gappedPool ('dorian').length);
    for (let k = 0; k < phrase.length; k++) {
      const event = phrase[k];
      notes++;
      if (event.ornament) kinds[event.ornament] = (kinds[event.ornament] ?? 0) + 1;
      // Two notes of the same pitch in a row need separating, or they run
      // together — the one place an ornament is not optional.
      if (k && phrase[k - 1].degree === event.degree && phrase[k - 1].at + phrase[k - 1].length === event.at) {
        repeatedPairs++;
        if (event.ornament === 'cut') repeatedSeparated++;
      }
    }
  }

  // The whole vocabulary, not just the one ornament that used to exist.
  expect (kinds.cut).toBeGreaterThan (0);
  expect (kinds.roll).toBeGreaterThan (0);
  expect (kinds.tap).toBeGreaterThan (0);

  // A roll needs room; it must never land on a note too short to hold it.
  const ornamented = Object.values (kinds).reduce ((sum, n) => sum + n, 0);
  expect (ornamented / notes).toBeGreaterThan (0.05);
  expect (ornamented / notes).toBeLessThan (0.4);

  if (repeatedPairs > 20) expect (repeatedSeparated / repeatedPairs).toBeGreaterThan (0.3);
});

test ('a roll only lands where there is room for it, and a cran only at the bottom', () => {
  const generator = createMelodyGenerator (seeded (9), '6/8');
  for (let i = 0; i < 2000; i++) {
    for (const event of generator.createPhrase ('dorian', 14)) {
      if (event.ornament === 'roll') expect (event.length).toBeGreaterThanOrEqual (3);
      // A cran is what you play when there is no note below to strike.
      if (event.ornament === 'cran') expect (event.degree).toBeLessThanOrEqual (0);
    }
  }
});

test ('a roll sounds the note three times, and a cut once before it', () => {
  const played = [];
  const state = {
    lead: { triggerAttackRelease (note, duration, at, velocity) {
      played.push ({ note, duration, at, velocity });
    } },
    rootMidi: 48, scale: 'dorian', ornament: 1, meter: '4/4', tempo: 80,
    random: () => 0.5, swing: 0, density: 1
  };

  const render = event => {
    played.length = 0;
    playMelody ({ ...state }, 0, 0, [{ ...event, at: 0 }], null);
    return [...played];
  };

  const roll = render ({ degree: 4, length: 4, ornament: 'roll', dynamic: 0.8 });
  const cut = render ({ degree: 4, length: 4, ornament: 'cut', dynamic: 0.8 });
  const plain = render ({ degree: 4, length: 4, ornament: null, dynamic: 0.8 });

  expect (plain).toHaveLength (1);
  expect (cut).toHaveLength (2);
  // A cut is a grace: short, above, and before the note it decorates.
  expect (cut[0].at).toBeLessThan (cut[1].at);
  expect (cut[0].duration).toBeLessThan (0.05);

  // The note, a cut, the note, a tap, the note.
  expect (roll).toHaveLength (5);
  const main = roll.filter (note => note.duration > 0.05);
  const graces = roll.filter (note => note.duration <= 0.05);
  expect (main).toHaveLength (3);
  expect (graces).toHaveLength (2);
  expect (main.every (note => note.note === main[0].note)).toBe (true);
  // Above then below, and every event in order — retriggering one monophonic
  // voice backwards is what breaks a plucked lead.
  expect (roll.map (note => note.at)).toEqual ([...roll.map (note => note.at)].sort ((a, b) => a - b));
});
