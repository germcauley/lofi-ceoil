import { test, expect } from '@playwright/test';
import { playChord, ARP_PATTERNS } from '../src/parts.js';
import { noteNameToMidi, chordPitchClasses } from '../src/theory.js';

function render (pattern, melodyAttacks = []) {
  const events = [];
  const state = { rootMidi: 48, scale: 'dorian', tempo: 72, random: () => 0.5,
    melodyAttacks, keys: { triggerAttackRelease (pitch, duration, at, velocity) {
      events.push ({ midi: noteNameToMidi (pitch), duration, at, velocity });
    } } };
  playChord (state, 0, [0, 'minor'], pattern);
  return { events, voicing: state.previousVoicing };
}

test ('arpeggios use single chord tones with distinct contours and a closing rest', () => {
  const chord = chordPitchClasses (48, 'dorian', 0, 'minor');
  for (const name of Object.keys (ARP_PATTERNS)) {
    const { events, voicing } = render (name);
    expect (events).toHaveLength (6);
    expect (events.every ((n, i) => chord.includes (n.midi % 12) && voicing.includes (n.midi)
      && n.velocity < 0.35 && (! i || n.at > events[i - 1].at))).toBe (true);
    expect (events.at (-1).at + events.at (-1).duration).toBeLessThan (4 * 60 / 72);
  }
  const up = render ('arp-up').events.slice (0, 4).map (n => n.midi);
  expect (up).toEqual ([...up].sort ((a, b) => a - b));
  expect (render ('arp-down').events.slice (0, 4).map (n => n.midi)).toEqual ([...up].reverse ());
  expect (render ('arp-alternate').events).not.toEqual (render ('arp-up').events);
});

test ('arpeggios leave main melody entrances clear while retaining the opening tone', () => {
  const full = render ('arp-up').events;
  const sparse = render ('arp-up', [0, 2, 4, 6]).events;
  expect (sparse.map (n => n.at)).toEqual ([full[0].at, full[1].at, full[4].at]);
  expect (sparse[0]).toEqual (full[0]);
});
