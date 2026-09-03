import { test, expect } from '@playwright/test';
import { coordinateBassWithKick, makeRoomForMelody, addTransitionFill } from '../src/ensemble.js';

const note = (role, at, duration = 1) => ({ role, at, duration, midi: 36, velocity: 0.55 });

test ('transition fills preserve the backbone and avoid duplicate noise triggers', () => {
  const input = [note ('kick', 0), note ('kick', 3.5), note ('snare', 3.01),
    note ('hat', 3.5), note ('ghost', 3.75), note ('lead', 2, 1.9)];
  const bar = { barInPart: 7, section: 'A', nextSection: 'B', winding: false };
  for (const variant of [0.1, 0.8]) {
    let draws = 0;
    const output = addTransitionFill (input, bar, () => draws++ ? variant : 0.1);
    expect (output.filter (n => n.fill).length).toBeGreaterThanOrEqual (2);
    expect (output.filter (n => ['kick', 'lead'].includes (n.role))).toEqual (input.filter (n => ['kick', 'lead'].includes (n.role)));
    expect (output).toContainEqual (input[2]);
    for (const role of ['hat', 'ghost', 'snare']) {
      const events = output.filter (n => n.role === role).sort ((a, b) => a.at - b.at);
      expect (events.every ((n, i) => ! i || n.at - events[i - 1].at >= 0.15)).toBe (true);
    }
    expect (output.filter (n => n.fill).every (n => n.at >= 3.25 && n.at + n.duration < 4 && n.velocity < 0.5)).toBe (true);
  }
});

test ('fills respect rests, busy melodies, repeated sections and final endings', () => {
  const notes = [note ('snare', 3)];
  const bar = { barInPart: 7, section: 'A', nextSection: 'B' };
  for (const change of [{ barInPart: 6 }, { nextSection: 'A' }, { nextSection: null }, { winding: true }]) {
    expect (addTransitionFill (notes, { ...bar, ...change }, () => 0)).toEqual (notes);
  }
  expect (addTransitionFill ([], bar, () => 0)).toEqual ([]);
  expect (addTransitionFill (notes, bar, () => 0.9)).toEqual (notes);
  const busy = [...notes, ...[3, 3.25, 3.5].map (at => note ('lead', at, 0.2))];
  expect (addTransitionFill (busy, bar, () => 0)).toEqual (busy);
});

test ('rolled chords leave room for melody attacks and sustain without losing harmony', () => {
  const input = [note ('keys', 0, 3.9), note ('keys', 0.04, 3.9), note ('keys', 0.08, 3.9),
    note ('lead', 0.02, 1.8), note ('keys', 1), note ('keys', 2.5), note ('bass', 0)];
  const original = structuredClone (input);
  const result = makeRoomForMelody (input);
  for (let i = 0; i < 3; i++) expect (result[i].velocity).toBeCloseTo (0.55 * 0.68);
  expect (result[4].velocity).toBeCloseTo (0.55 * 0.82);
  expect (result[5]).toEqual (input[5]); // A chord response in a melody rest.
  expect (result.filter (n => n.role !== 'keys')).toEqual (input.filter (n => n.role !== 'keys'));
  expect (result.map (({ velocity, ...event }) => event)).toEqual (input.map (({ velocity, ...event }) => event));
  expect (input).toEqual (original);
});

test ('chord-only introductions and short ornaments keep their original dynamics', () => {
  const chords = [note ('keys', 0), note ('keys', 0.04)];
  expect (makeRoomForMelody (chords)).toEqual (chords);
  const ornament = [...chords, note ('lead', 0, 0.1)];
  expect (makeRoomForMelody (ornament)).toEqual (ornament);
});

test ('bass meets actual kick attacks while passing notes and levels stay intact', () => {
  const input = [note ('bass', 0.01), note ('bass', 2, 1.4), note ('bass', 3),
    note ('kick', 0.002), note ('kick', 2.51), note ('snare', 1)];
  const original = structuredClone (input);
  const result = coordinateBassWithKick (input, 'walk');
  expect (result.filter (n => n.role === 'bass').map (n => n.at)).toEqual ([0.002, 2.51, 3]);
  expect (result[1].duration).toBeCloseTo (0.45);
  expect (result.map (n => [n.midi, n.velocity])).toEqual (input.map (n => [n.midi, n.velocity]));
  expect (result.filter (n => n.role !== 'bass')).toEqual (input.filter (n => n.role !== 'bass'));
  expect (input).toEqual (original);
});

test ('drumless bars, sparse openings and anticipations retain their timing', () => {
  const bass = [note ('bass', 0.01, 3.9), note ('bass', 3.5, 0.45)];
  expect (coordinateBassWithKick (bass, 'held')).toEqual (bass);
  const withKicks = [...bass, note ('kick', 0), note ('kick', 3.51)];
  for (const pattern of ['sparse', 'anticipate']) {
    expect (coordinateBassWithKick (withKicks, pattern)).toEqual (withKicks);
  }
});

test ('coordination keeps bass events ordered and inside the bar', () => {
  for (let step = 0; step < 40; step++) {
    const input = [note ('bass', 0.01, 4), note ('bass', 2, 1), note ('bass', 3.8, 0.18),
      note ('kick', 0), note ('kick', 2 + step / 100), note ('kick', 3.99)];
    const bass = coordinateBassWithKick (input, 'walk').filter (n => n.role === 'bass');
    expect (bass.every ((n, i) => n.duration > 0 && n.at + n.duration <= 4
      && (! i || n.at > bass[i - 1].at))).toBe (true);
  }
});
