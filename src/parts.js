// The arrangement: what each instrument plays in a given bar.
//
// Every function here takes the current state and a bar-start time, and
// schedules notes. Nothing holds state of its own, so patterns stay easy to
// reason about and easy to replace.

import * as Tone from 'tone';
import { buildChord, scaleDegreeToMidi, midiToNoteName } from './theory.js';
import { gappedPool } from './melody.js';

const chance = p => Math.random() < p;
const pick = arr => arr[Math.floor (Math.random() * arr.length)];

/** Small timing and velocity variation. Perfectly quantised lofi sounds like a
    MIDI demo; this is most of what makes it feel played. */
const humanise = (amount = 0.012) => (Math.random() - 0.5) * 2 * amount;

/** Applies jitter without ever landing before the bar's own start time, which
    would try to schedule into the past on the very first bar. */
const jitter = (time, base, amount) => Math.max (time, base + humanise (amount));

export function playChord (state, time, chordSpec) {
  const { keys, rootMidi, scale } = state;
  const [degree, quality] = chordSpec;
  const notes = buildChord (rootMidi, scale, degree, quality, 60);

  // Roll the voicing slightly rather than hitting all notes dead together.
  notes.forEach ((midi, i) => {
    const at = jitter (time, time + i * 0.012, 0.01);
    const velocity = 0.32 + Math.random() * 0.12;
    keys.triggerAttackRelease (midiToNoteName (midi), '2n.', at, velocity);
  });

  // A second, quieter stab late in the bar keeps two-chord vamps from
  // feeling static.
  if (chance (0.4)) {
    const at = jitter (time, time + Tone.Time ('2n').toSeconds(), 0.02);
    notes.slice (1).forEach ((midi, i) => {
      state.keys.triggerAttackRelease (
        midiToNoteName (midi), '4n', at + i * 0.01, 0.18 + Math.random() * 0.08);
    });
  }
}

export function playBass (state, time, chordSpec) {
  const { bass, rootMidi, scale } = state;
  const [degree, quality] = chordSpec;
  const notes = buildChord (rootMidi, scale, degree, quality, 60);

  // Root two octaves down, then optionally the fifth on beat three.
  const root = notes[0] - 24;
  bass.triggerAttackRelease (midiToNoteName (root), '4n.', jitter (time, time, 0.012), 0.75);

  if (chance (0.55)) {
    const fifth = root + (chance (0.3) ? 12 : 7);
    const at = jitter (time, time + Tone.Time ('2n').toSeconds(), 0.012);
    bass.triggerAttackRelease (midiToNoteName (fifth), '4n', at, 0.55);
  }
}

/** Kick, snare and hats on a sixteenth grid. Swing comes from the Transport,
    so it is not applied here. */
export function playDrums (state, time) {
  const { drums, chain, density } = state;
  const sixteenth = Tone.Time ('16n').toSeconds();
  const at = step => jitter (time, time + step * sixteenth, 0.008);

  // Kick: beat one always, beat three usually, plus an occasional pickup.
  drums.kick.triggerAttackRelease ('C1', '8n', at (0), 0.9);
  chain.duck (at (0), state.pump, state.tempo);

  if (chance (0.75)) {
    drums.kick.triggerAttackRelease ('C1', '8n', at (10), 0.8);
    chain.duck (at (10), state.pump, state.tempo);
  }

  if (chance (0.25)) drums.kick.triggerAttackRelease ('C1', '8n', at (14), 0.6);

  // Snare on two and four, the backbone of the whole feel.
  drums.snare.triggerAttackRelease ('8n', at (4), 0.7);
  drums.snare.triggerAttackRelease ('8n', at (12), 0.7);

  // Ghost notes fill the gaps as density rises. Their own voice, so they never
  // collide with the backbeat.
  for (const step of [7, 11, 15]) {
    if (chance (density * 0.35)) drums.ghost.triggerAttackRelease ('32n', at (step), 0.5);
  }

  // Hats on eighths, with the odd sixteenth flourish.
  for (let step = 0; step < 16; step += 2) {
    if (chance (0.9)) {
      const velocity = step % 4 === 0 ? 0.5 : 0.3;
      drums.hat.triggerAttackRelease ('32n', at (step), velocity + Math.random() * 0.1);
    }

    if (chance (density * 0.3)) {
      drums.hat.triggerAttackRelease ('32n', at (step + 1), 0.16);
    }
  }
}

/** Plays the slice of the current phrase belonging to this bar.

    Notes are laid end to end by construction, and each one is shortened
    slightly so the following cut has somewhere to sit — the lead is a single
    monophonic voice, so overlapping notes would fight over it. */
export function playMelody (state, time, barInPhrase, phrase) {
  const { lead, rootMidi, scale, ornament } = state;
  if (! phrase) return;

  const pool = gappedPool (scale);
  const eighth = Tone.Time ('8n').toSeconds();
  const gap = Math.min (0.08, eighth * 0.35);

  // Sits the line above the chords without straying into whistle register.
  const base = rootMidi + 12;

  for (const event of phrase) {
    if (Math.floor (event.at / 8) !== barInPhrase) continue;

    const offsetEighths = event.at % 8;
    const start = jitter (time, time + offsetEighths * eighth, 0.014);
    const duration = Math.max (0.08, event.length * eighth - gap);

    const degree = pool[Math.min (pool.length - 1, event.degree)];
    const midi = scaleDegreeToMidi (base, scale, degree);

    // A cut: a very short note a scale step above, flicked in just before the
    // beat. This one ornament does more for the folk character than any
    // amount of note choice.
    if (event.ornament && chance (ornament)) {
      const above = scaleDegreeToMidi (base, scale, degree + 1);
      lead.triggerAttackRelease (
        midiToNoteName (above), 0.03, Math.max (time, start - 0.038), 0.22);
    }

    lead.triggerAttackRelease (
      midiToNoteName (midi), duration, start, 0.26 + Math.random() * 0.16);
  }
}

/** The counter line: an arpeggio of the current chord that fills the melody's
    rests.

    Two rules do all the work. Notes come from the chord, so it is always
    consonant with the harmony rather than merely in key. And it plays where
    the melody is silent — complementary rhythm is what makes two lines sound
    like a duet instead of a pile. */
export function playCounter (state, time, barInPhrase, chordSpec, plan) {
  const { pluck, rootMidi, scale, counter } = state;
  if (! plan || counter <= 0.001) return;

  const [degree, quality] = chordSpec;

  // Sits below the melody and above the bass, so the three parts stay legible.
  const chord = buildChord (rootMidi, scale, degree, quality, 55);
  const busy = plan.busy[barInPhrase] ?? new Array (8).fill (false);

  const eighth = Tone.Time ('8n').toSeconds();
  let step = 0;

  for (let slot = 0; slot < 8; slot++) {
    // The rest the melody leaves is where this part belongs.
    const free = ! busy[slot];

    // Density rises with the knob; a few notes still sneak in under held
    // melody notes at higher settings, which keeps it from sounding like a
    // rigid alternation.
    const probability = free ? 0.55 + counter * 0.45 : counter * 0.18;
    if (! chance (probability)) continue;

    const index = plan.pattern[step % plan.pattern.length];
    const midi = chord[index % chord.length];

    step++;

    pluck.triggerAttackRelease (
      midiToNoteName (midi),
      eighth * 0.9,
      jitter (time, time + slot * eighth, 0.012),
      free ? 0.5 : 0.3);
  }
}

/** A sustained fifth underneath, the way pipes hold a drone. Quiet enough to
    read as atmosphere rather than a part. */
export function playDrone (state, time) {
  const { drone, rootMidi, scale, droneLevel } = state;
  if (droneLevel <= 0.001) return;

  const bar = Tone.Time ('1m').toSeconds();
  const fifth = scaleDegreeToMidi (rootMidi - 12, scale, 4);

  drone.triggerAttackRelease (midiToNoteName (fifth), bar * 0.98, time, droneLevel * 0.5);
}

/** Random pops in the vinyl bed, scattered across the bar.

    The pop voice is a single monophonic noise source, so the times have to be
    sorted and spaced: scheduling an earlier time after a later one is what
    makes Tone reject the event. */
export function playVinyl (state, time) {
  const { vinyl, dust } = state;
  const bar = Tone.Time ('1m').toSeconds();
  const count = Math.floor (Math.random() * (2 + dust * 8));
  const minGap = 0.06;

  const offsets = Array.from ({ length: count }, () => Math.random() * bar).sort ((a, b) => a - b);

  let previous = -Infinity;

  for (const offset of offsets) {
    if (offset - previous < minGap) continue;

    previous = offset;
    vinyl.pops.triggerAttackRelease ('64n', time + offset, 0.2 + Math.random() * 0.5);
  }
}
