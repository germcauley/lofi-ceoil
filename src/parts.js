// The arrangement: what each instrument plays in a given bar.
//
// Every function here takes the current state and a bar-start time, and
// schedules notes. Musical patterns use the supplied state; the live vinyl
// bank also remembers its queued noise times across bars.

import { buildChord, chordPitchClasses, voiceLead, fitToChordTone, scaleDegreeToMidi, midiToNoteName } from './theory.js';
import { meterInfo } from './musical-meter.js';
import { gappedPool } from './melody.js';

const random = state => (state.random ?? Math.random)();
const chance = (state, p) => random (state) < p;


/** Musical duration at the supplied tempo. Composition uses this with a
    recording adapter; live playback has no influence on these calculations. */
export function durationSeconds (state, value) {
  if (typeof value === 'number') return value;
  const beats = value === '1m' ? meterInfo (state.meter).beats : 4 / Number (value.slice (0, -1));
  return beats * 60 / state.tempo;
}

/** Small timing and velocity variation. Perfectly quantised lofi sounds like a
    MIDI demo; this is most of what makes it feel played. */
const humanise = (state, amount = 0.012) => (random (state) - 0.5) * 2 * amount;

/** Applies jitter without ever landing before the bar's own start time, which
    would try to schedule into the past on the very first bar. */
const jitter = (state, time, base, amount) => Math.max (time, base + humanise (state, amount));

// How the keys place a chord in the bar. One figure every bar — a hit on the
// downbeat and a stab halfway — is a sequencer, not a player. These are the
// backings a rhythm instrument actually uses, and one is chosen per part.
//
// `quality` on an event overrides the chord's own: a sus4 landing first and
// resolving to the third is deeply Celtic and costs nothing.
export const COMP_PATTERNS = {
  // One chord, held. Lets everything else be heard.
  sustain:    [{ at: 0, len: 8, velocity: 1 }],
  // Short and out of the way.
  stab:       [{ at: 0, len: 2, velocity: 1 }],
  // The offbeats only, so the downbeat belongs to the bass.
  offbeat:    [{ at: 2, len: 2, velocity: 0.85 }, { at: 6, len: 2, velocity: 0.75 }],
  // Driving quavers, the bouzouki backing behind a session tune.
  bouzouki:   [{ at: 0, len: 1, velocity: 1 }, { at: 2, len: 1, velocity: 0.65 },
               { at: 4, len: 1, velocity: 0.85 }, { at: 6, len: 1, velocity: 0.65 }],
  // Chord on the backbeat.
  boomChuck:  [{ at: 2, len: 2, velocity: 0.9 }, { at: 6, len: 2, velocity: 0.8 }],
  // Pushes into the next bar, so the change arrives early.
  anticipate: [{ at: 0, len: 4, velocity: 1 }, { at: 7, len: 1, velocity: 0.6 }],
  // Suspended fourth, resolving to the third halfway through.
  suspension: [{ at: 0, len: 4, velocity: 1, quality: 'sus4' },
               { at: 4, len: 4, velocity: 0.85 }]
};

export const ARP_PATTERNS = {
  'arp-up': [0, 1, 2, 3, 0, 1],
  'arp-down': [3, 2, 1, 0, 3, 2],
  'arp-alternate': [0, 2, 1, 3, 1, 2]
};
export const COMP_PATTERN_NAMES = [...Object.keys (COMP_PATTERNS), ...Object.keys (ARP_PATTERNS)];

export function playChord (state, time, chordSpec, compName = 'sustain') {
  const { keys, rootMidi, scale } = state;
  const [degree, quality] = chordSpec;

  if (ARP_PATTERNS[compName]) {
    const pitches = voiceLead (state.previousVoicing,
      chordPitchClasses (rootMidi, scale, degree, quality), 60);
    state.previousVoicing = pitches;
    const ordered = [...pitches].sort ((a, b) => a - b);
    const eighth = durationSeconds (state, '8n');
    // Six possible attacks, then a breath before the next bar. Retain the
    // first tone as a harmonic anchor; leave other melody entrances clear.
    (state.meter === '6/8' ? [0, 1, 2, 3, 4] : [0, 1, 2, 4, 5, 6]).forEach ((slot, i) => {
      if (slot && state.melodyAttacks?.some (attack => Math.abs (attack - slot) < 0.75)) return;
      const index = Math.min (ordered.length - 1, ARP_PATTERNS[compName][i]);
      keys.triggerAttackRelease (midiToNoteName (ordered[index]),
        Math.max (0.1, eighth * 0.85), jitter (state, time, time + slot * eighth, 0.008),
        (slot === 0 ? 0.28 : 0.23) + random (state) * 0.03);
    });
    return;
  }

  const patterns = state.meter === '6/8' ? JIG_COMP_PATTERNS : COMP_PATTERNS;
  const pattern = patterns[compName] ?? patterns.sustain;
  const eighth = durationSeconds (state, '8n');

  for (const hit of pattern) {
    // Move each voice to the nearest tone of the new chord rather than
    // rebuilding the voicing from scratch. Common tones stay put, which is what
    // stops a progression sounding like a row of unrelated blocks.
    const pitchClasses = chordPitchClasses (rootMidi, scale, degree, hit.quality ?? quality);
    const notes = voiceLead (state.previousVoicing, pitchClasses, 60);

    state.previousVoicing = notes;

    const at = time + hit.at * eighth;
    const duration = Math.max (0.12, hit.len * eighth - 0.05);

    // Roll the voicing slightly rather than hitting all notes dead together.
    notes.forEach ((midi, i) => {
      const start = jitter (state, time, at + i * 0.012, 0.01);
      const velocity = (0.3 + random (state) * 0.08) * hit.velocity;

      keys.triggerAttackRelease (midiToNoteName (midi), duration, start, velocity);
    });
  }
}

// Bass patterns as positions in eighths, with the scale step above the chord
// root and an optional octave lift. Having a library rather than one fixed
// figure is most of what stops the low end sounding like a metronome — and
// `sparse` deliberately leaves the downbeat empty, which is the only way the
// bar stops being bass-driven.
export const BASS_PATTERNS = {
  root:       [{ at: 0, step: 0, len: 6 }],
  held:       [{ at: 0, step: 0, len: 8 }],
  rootFifth:  [{ at: 0, step: 0, len: 3 }, { at: 4, step: 4, len: 3 }],
  octave:     [{ at: 0, step: 0, len: 3 }, { at: 4, step: 0, len: 3, oct: 1 }],
  walk:       [{ at: 0, step: 0, len: 3 }, { at: 4, step: 4, len: 2 }, { at: 6, step: 2, len: 2 }],
  // Pushes the root a quaver early, so the bar arrives before the downbeat.
  anticipate: [{ at: 0, step: 0, len: 5 }, { at: 7, step: 0, len: 1 }],
  // No downbeat at all: the bar opens on the chord and the melody instead.
  sparse:     [{ at: 2, step: 0, len: 5 }]
};

export const BASS_PATTERN_NAMES = Object.keys (BASS_PATTERNS);

export function playBass (state, time, chordSpec, patternName = 'root') {
  const { bass, rootMidi, scale } = state;
  const [degree] = chordSpec;

  const patterns = state.meter === '6/8' ? JIG_BASS_PATTERNS : BASS_PATTERNS;
  const pattern = patterns[patternName] ?? patterns.root;
  const eighth = durationSeconds (state, '8n');

  // The bass takes the chord's actual root, independent of how the keys are
  // voiced — voice leading moves the upper parts, not the foundation.
  const root = scaleDegreeToMidi (rootMidi, scale, degree) - 12;

  for (const note of pattern) {
    const midi = scaleDegreeToMidi (root, scale, note.step) + (note.oct ?? 0) * 12;

    bass.triggerAttackRelease (
      midiToNoteName (midi),
      Math.max (0.1, note.len * eighth - 0.04),
      jitter (state, time, time + note.at * eighth, 0.012),
      note.at === 0 ? 0.75 : 0.55);
  }
}

/** Kick, snare and hats on a sixteenth grid. Swing comes from the Transport,
    so it is not applied here. */
export function playDrums (state, time, { kick = true } = {}) {
  if (state.meter === '6/8') return playJigDrums (state, time, kick);
  const { drums, chain, density } = state;
  const sixteenth = durationSeconds (state, '16n');
  const at = step => jitter (state, time, time + step * sixteenth, 0.008);

  // Kick: beat one always, beat three usually, plus an occasional pickup.
  if (kick) {
    drums.kick.triggerAttackRelease ('C1', '8n', at (0), 0.9);
    chain.duck (at (0), state.pump, state.tempo);
  }

  if (kick && chance (state, 0.75)) {
    drums.kick.triggerAttackRelease ('C1', '8n', at (10), 0.8);
    chain.duck (at (10), state.pump, state.tempo);
  }

  if (kick && chance (state, 0.25)) drums.kick.triggerAttackRelease ('C1', '8n', at (14), 0.6);

  // Snare on two and four, the backbone of the whole feel.
  drums.snare.triggerAttackRelease ('8n', at (4), 0.7);
  drums.snare.triggerAttackRelease ('8n', at (12), 0.7);

  // Ghost notes fill the gaps as density rises. Their own voice, so they never
  // collide with the backbeat.
  for (const step of [7, 11, 15]) {
    if (chance (state, density * 0.35)) drums.ghost.triggerAttackRelease ('32n', at (step), 0.5);
  }

  // Hats on eighths, with the odd sixteenth flourish.
  for (let step = 0; step < 16; step += 2) {
    if (chance (state, 0.9)) {
      const velocity = step % 4 === 0 ? 0.5 : 0.3;
      drums.hat.triggerAttackRelease ('32n', at (step), velocity + random (state) * 0.1);
    }

    if (chance (state, density * 0.3)) {
      drums.hat.triggerAttackRelease ('32n', at (step + 1), 0.16);
    }
  }
}

/** Plays the slice of the current phrase belonging to this bar.

    Notes are laid end to end by construction, and each one is shortened
    slightly so the following cut has somewhere to sit — the lead is a single
    monophonic voice, so overlapping notes would fight over it. */
export function playMelody (state, time, barInPhrase, phrase, chordSpec) {
  const { lead, rootMidi, scale, ornament } = state;
  if (! phrase) return;

  const pool = gappedPool (scale);
  const eighth = durationSeconds (state, '8n');
  const gap = Math.min (0.08, eighth * 0.35);

  // Sits the line above the chords without straying into whistle register.
  const base = rootMidi + 12;

  // Held notes on strong beats are where a clash with the harmony actually
  // shows. Short notes passing between chord tones are dissonant by design and
  // are left alone.
  const chordTones = chordSpec
    ? new Set (chordPitchClasses (rootMidi, scale, chordSpec[0], chordSpec[1]))
    : null;

  for (const event of phrase) {
    if (Math.floor (event.at / meterInfo (state.meter).eighths) !== barInPhrase) continue;

    const offsetEighths = event.at % meterInfo (state.meter).eighths;

    // Articulation. A slurred note runs almost into the next one; a lifted
    // note is cut short so the line breathes. This is most of what separates
    // a played line from a row of notes.
    const articulationGap = event.slur ? gap * 0.25 : event.lift ? gap * 2.2 : gap;

    // A player takes a moment before starting a new sentence.
    const breath = event.breath ? 0.022 : 0;

    const start = jitter (state, time, time + offsetEighths * eighth + breath, 0.014);
    const duration = Math.max (0.08, event.length * eighth - articulationGap);

    const poolIndex = Math.min (pool.length - 1, event.degree);
    // A cadence carries the note it actually means. The gapped pool leaves out
    // the fourth in major and the seventh in major and minor, and those are
    // where a fifth of real parts come to rest — the flat seventh especially.
    const degree = event.scaleDegree ?? pool[poolIndex];
    let midi = scaleDegreeToMidi (base, scale, degree);

    // Accented, or simply long enough that a wrong note would be audible.
    const onStrongBeat = offsetEighths === 0 || offsetEighths === meterInfo (state.meter).eighths / 2;
    const exposed = (onStrongBeat && event.length >= 2) || event.length >= 3;

    // A cadence is chosen, not stumbled into. Snapping it to a chord tone is
    // exactly what would undo a modal ending on the flat seventh.
    if (chordTones && exposed && ! event.cadence) {
      midi = fitToChordTone (midi, base, scale, poolIndex, pool, chordTones);
    }

    // Velocity follows the phrase, not a dice roll: the line swells toward its
    // peak and eases into its cadence. The random component is small, and only
    // there so repeated notes are not identical.
    const shape = event.dynamic ?? 0.8;
    const velocity = Math.max (0.12, Math.min (0.85, shape * 0.42 + random (state) * 0.05));

    // Ornamentation. A player has no volume control and no sustain, so these
    // are how a note is separated from its neighbour and how a long note is
    // kept alive — articulation rather than decoration, and most of what makes
    // a tune sound Irish rather than merely modal.
    //
    // Scores written before ornaments had kinds recorded a plain true, which
    // meant a cut.
    const kind = event.ornament === true ? 'cut' : event.ornament;
    const above = scaleDegreeToMidi (base, scale, degree + 1) - scaleDegreeToMidi (base, scale, degree);
    const below = scaleDegreeToMidi (base, scale, degree) - scaleDegreeToMidi (base, scale, degree - 1);
    const note = midiToNoteName (midi);

    // A grace note is flicked in just before the beat. On the first note of a
    // bar there is no room before it, and clamping put the grace exactly on
    // top of the note — a chord rather than an ornament, on the strong beat
    // where a cut is most likely. A player solves this the other way round:
    // the beat lands on the cut and the note follows it.
    const lead_in = 0.038;
    let attack = start;
    if (kind && kind !== 'roll' && start - lead_in < time) attack = time + lead_in;

    const grace = (interval, at, length = 0.03, level = 0.7) =>
      lead.triggerAttackRelease (midiToNoteName (midi + interval), length,
        Math.max (time, at), Math.max (0.1, velocity * level));

    if (kind && chance (state, ornament)) {
      if (kind === 'roll') {
        // The note, a cut, the note, a tap, the note — one gesture filling a
        // long note, and in a jig the whole dotted crotchet. The signature
        // sound of the form, and the reason a held note does not go dead.
        const third = duration / 3;
        lead.triggerAttackRelease (note, third * 0.9, start, velocity);
        grace (above, start + third - 0.022, 0.024, 0.6);
        lead.triggerAttackRelease (note, third * 0.9, start + third, velocity * 0.92);
        grace (-below, start + 2 * third - 0.022, 0.024, 0.55);
        lead.triggerAttackRelease (note, third * 0.9, start + 2 * third, velocity * 0.96);
        continue;
      }

      // A cran is what a player uses where there is no note below to strike:
      // several cuts in quick succession instead of one.
      if (kind === 'cran') {
        grace (above, attack - 0.062, 0.022, 0.58);
        grace (above, attack - 0.03, 0.022, 0.66);
      } else {
        // A cut sits a step above and a tap a step below.
        grace (kind === 'tap' ? -below : above, attack - lead_in);
      }
    }

    lead.triggerAttackRelease (note, duration, attack, velocity);
  }
}

/** The counter line. Three textures, chosen per phrase.

    `figuration` arpeggiates the chord into the melody's rests — accompaniment.
    The other two make it an actual voice: `imitation` plays the melody's own
    material a bar late and an octave down, which is canon, and `heterophony`
    plays the same tune thinned out, which is two fiddlers on one melody rather
    than two melodies. Heterophony is the traditional Celtic texture and the one
    almost nobody implements. */
export function playCounter (state, time, barInPhrase, chordSpec, plan, phrase) {
  if (! plan || state.counter <= 0.001) return;

  if (plan.texture === 'imitation') return playImitation (state, time, barInPhrase, chordSpec, phrase);
  if (plan.texture === 'heterophony') return playHeterophony (state, time, barInPhrase, chordSpec, phrase);

  playFiguration (state, time, barInPhrase, chordSpec, plan);
}

function playFiguration (state, time, barInPhrase, chordSpec, plan) {
  const { pluck, rootMidi, scale, counter } = state;
  const [degree, quality] = chordSpec;

  // Sits below the melody and above the bass, so the three parts stay legible.
  const chord = buildChord (rootMidi, scale, degree, quality, 55 + (plan.octave ?? 0) * 12);
  const busy = plan.busy[barInPhrase] ?? new Array (meterInfo (state.meter).eighths).fill (false);

  const eighth = durationSeconds (state, '8n');
  const feel = plan.feel ?? 'even';

  // Where in the bar this feel places notes, and how heavy each one is. A
  // figure that always plays every quaver at the same weight is a sequencer;
  // varying the grid and the accent is what makes it an accompaniment.
  const grid = meterInfo (state.meter).eighths * (feel === 'double' ? 2 : 1);
  const stepLength = feel === 'double' ? eighth / 2 : eighth;

  let step = 0;

  for (let slot = 0; slot < grid; slot++) {
    const eighthSlot = feel === 'double' ? Math.floor (slot / 2) : slot;

    // The rest the melody leaves is where this part belongs.
    const free = ! busy[eighthSlot];

    if (feel === 'sparse' && slot % 2 === 1) continue;

    let weight = 1;
    if (feel === 'pulsed' && slot % 2 === 1) weight = 0.45;
    if (feel === 'double' && slot % 2 === 1) weight = 0.6;

    // Density rises with the knob; a few notes still sneak in under held
    // melody notes at higher settings, which keeps it from sounding like a
    // rigid alternation.
    const probability = (free ? 0.55 + counter * 0.45 : counter * 0.18)
      * (feel === 'double' ? 0.75 : 1);

    if (! chance (state, probability)) continue;

    const index = plan.pattern[step % plan.pattern.length];
    const midi = chord[index % chord.length];

    step++;

    // The figure follows the melody's own shape rather than sitting flat: it
    // leans into the middle of the bar and eases at the edges.
    const arch = 0.82 + 0.18 * Math.sin (Math.PI * (slot / grid));
    const velocity = (free ? 0.46 : 0.28) * weight * arch + random (state) * 0.04;

    pluck.triggerAttackRelease (
      midiToNoteName (midi),
      stepLength * (feel === 'sparse' ? 1.7 : 0.9),
      jitter (state, time, time + slot * stepLength, 0.012),
      Math.max (0.08, velocity));
  }
}

/** Renders melody events an octave below the tune, fitted to the chord so the
    echo stays consonant with harmony that has moved on since. */
function renderEcho (state, time, events, chordSpec, offsetSeconds, velocity) {
  const { pluck, rootMidi, scale } = state;
  const [degree, quality] = chordSpec;

  const pool = gappedPool (scale);
  const base = rootMidi;                       // an octave under the melody
  const chordTones = new Set (chordPitchClasses (rootMidi, scale, degree, quality));

  const eighth = durationSeconds (state, '8n');
  const gap = Math.min (0.08, eighth * 0.35);

  for (const event of events) {
    const poolIndex = Math.min (pool.length - 1, event.degree);
    let midi = scaleDegreeToMidi (base, scale, pool[poolIndex]);

    if (event.length >= 2) {
      midi = fitToChordTone (midi, base, scale, poolIndex, pool, chordTones);
    }

    const slot = event.at % meterInfo (state.meter).eighths;
    const start = jitter (state, time, time + slot * eighth + offsetSeconds, 0.012);

    // Carries the melody's phrasing with it — an echo that ignored the shape
    // of what it is echoing would give the game away immediately.
    const shaped = velocity * (event.dynamic ?? 0.8);

    pluck.triggerAttackRelease (
      midiToNoteName (midi),
      Math.max (0.08, event.length * eighth - (event.slur ? gap * 0.3 : gap)),
      start,
      Math.max (0.08, shaped));
  }
}

/** Canon: this bar answers with what the melody played in the previous one. */
function playImitation (state, time, barInPhrase, chordSpec, phrase) {
  if (! phrase) return;

  // Bar 0 answers bar 7, so the canon carries across the part boundary instead
  // of falling silent at the start of every part.
  const source = (barInPhrase + 7) % 8;
  const events = phrase.filter (e => Math.floor (e.at / meterInfo (state.meter).eighths) === source);

  renderEcho (state, time, events, chordSpec, 0, 0.34 + state.counter * 0.16);
}

/** Heterophony: the same tune, thinned to its longer notes and nudged fractionally
    late, the way a second player sits just behind the lead. */
function playHeterophony (state, time, barInPhrase, chordSpec, phrase) {
  if (! phrase) return;

  const events = phrase
    .filter (e => Math.floor (e.at / meterInfo (state.meter).eighths) === barInPhrase)
    .filter (e => e.length >= 2);

  renderEcho (state, time, events, chordSpec, 0.03, 0.3 + state.counter * 0.14);
}

/** The supporting line.

    Not a second melody and not the counter line, which fills the tune's rests.
    This does the opposite: it lands *on* the notes that matter and is silent
    everywhere else, the way a player adds a highlight to someone else's phrase
    rather than answering it.

    It picks the moments from the phrasing already computed — the note a
    sentence is aiming at, and the note it comes to rest on — so it never has
    to guess what is worth supporting. It doubles a third above where the chord
    allows, and the octave otherwise, which is the plainest harmony there is
    and the least likely to fight the tune. */
export function playSupport (state, time, barInPhrase, phrase, chordSpec) {
  const { support, rootMidi, scale, supportLevel } = state;
  if (! support || ! phrase || supportLevel <= 0.001) return;

  const pool = gappedPool (scale);
  const base = rootMidi + 12;
  const chordTones = new Set (chordPitchClasses (rootMidi, scale, chordSpec[0], chordSpec[1]));

  const eighth = durationSeconds (state, '8n');

  // The sentence this bar belongs to, so "the peak" means the peak of a
  // phrase rather than of the whole part.
  const sentence = phrase.filter (e => {
    const bar = Math.floor (e.at / meterInfo (state.meter).eighths);
    return barInPhrase < 4 ? bar < 4 : bar >= 4;
  });

  if (! sentence.length) return;

  const peak = Math.max (...sentence.map (e => e.degree));
  const closing = sentence[sentence.length - 1];

  for (const event of phrase) {
    if (Math.floor (event.at / meterInfo (state.meter).eighths) !== barInPhrase) continue;

    // Only the moments worth underlining, and only sometimes even then.
    const isPeak = event.degree === peak;
    const isCadence = event === closing;
    if (! isPeak && ! isCadence) continue;
    if (! chance (state, supportLevel * (isCadence ? 0.7 : 0.9))) continue;

    const poolIndex = Math.min (pool.length - 1, event.degree);
    const root = scaleDegreeToMidi (base, scale, pool[poolIndex]);

    // A third above if it belongs to the chord, otherwise the octave.
    const thirdIndex = Math.min (pool.length - 1, poolIndex + 2);
    const third = scaleDegreeToMidi (base, scale, pool[thirdIndex]);
    const midi = chordTones.has (third % 12) ? third : root + 12;

    support.triggerAttackRelease (
      midiToNoteName (midi),
      Math.max (0.3, event.length * eighth),
      jitter (state, time, time + (event.at % meterInfo (state.meter).eighths) * eighth, 0.012),
      Math.max (0.06, (event.dynamic ?? 0.8) * 0.26 * supportLevel));
  }
}

/** A sustained fifth underneath, the way pipes hold a drone. Quiet enough to
    read as atmosphere rather than a part. */
export function playDrone (state, time) {
  const { drone, rootMidi, scale, droneLevel } = state;
  if (droneLevel <= 0.001) return;

  const bar = durationSeconds (state, '1m');
  const fifth = scaleDegreeToMidi (rootMidi - 12, scale, 4);

  drone.triggerAttackRelease (midiToNoteName (fifth), bar * 0.98, time, droneLevel * 0.32);
}

/** Scatters the record surface across the bar.

    The carpet is what sells it: many ticks, each almost inaudible on its own.
    An earlier version played only a handful of sharp pops a bar, which reads
    as clicks rather than as a surface.

    Every voice here is monophonic, so each stream is sorted and spaced — an
    event landing at or before the previous one throws rather than overlapping. */
export function playVinyl (state, time) {
  const { vinyl, dust } = state;
  const bar = durationSeconds (state, '1m');
  const lastEvents = vinyl.lastEvents ??= new WeakMap();

  const scatter = (voice, count, minGap, velocity, duration) => {
    if (! voice || count <= 0) return;

    const offsets = Array.from ({ length: count }, () => random (state) * bar)
      .sort ((a, b) => a - b);

    let previous = lastEvents.get (voice) ?? -Infinity;

    for (const offset of offsets) {
      const at = time + offset;
      // A tempo increase can bring the next bar ahead of noise already
      // scheduled by this voice. Omit those ticks instead of going backwards
      // in its timeline or bunching them up after the previous event.
      if (at - previous < minGap) continue;

      voice.triggerAttackRelease (duration, at, velocity());
      previous = at;
      lastEvents.set (voice, at);
    }
  };

  // The carpet. Dense even at low dust, because a record is never silent.
  scatter (vinyl.crackle, 6 + Math.floor (random (state) * (10 + dust * 26)), 0.012,
    () => 0.12 + random (state) * 0.3, '128n');

  // Deeper damage, occasional.
  scatter (vinyl.pops, Math.floor (random (state) * (1 + dust * 5)), 0.08,
    () => 0.2 + random (state) * 0.4, '64n');

  // And rarely, the one you notice.
  if (random (state) < dust * 0.12) {
    scatter (vinyl.scuff, 1, 0.15, () => 0.3 + random (state) * 0.3, '32n');
  }
}

// Two groups of three quavers. Keep the second pulse lighter and leave room
// for the lead instead of transplanting the four-beat backing into a jig.
const JIG_COMP_PATTERNS = {
  sustain: [{ at: 0, len: 6, velocity: 0.85 }],
  stab: [{ at: 0, len: 1, velocity: 0.85 }],
  offbeat: [{ at: 2, len: 1, velocity: 0.7 }, { at: 5, len: 1, velocity: 0.6 }],
  boomChuck: [{ at: 3, len: 2, velocity: 0.8 }],
  bouzouki: [{ at: 0, len: 1, velocity: 0.9 }, { at: 2, len: 1, velocity: 0.55 },
    { at: 3, len: 1, velocity: 0.75 }, { at: 5, len: 1, velocity: 0.5 }],
  anticipate: [{ at: 0, len: 3, velocity: 0.85 }, { at: 5, len: 1, velocity: 0.55 }],
  suspension: [{ at: 0, len: 3, velocity: 0.85, quality: 'sus4' }, { at: 3, len: 3, velocity: 0.7 }]
};
const JIG_BASS_PATTERNS = {
  root: [{ at: 0, step: 0, len: 3 }], held: [{ at: 0, step: 0, len: 5 }],
  rootFifth: [{ at: 0, step: 0, len: 2 }, { at: 3, step: 4, len: 2 }],
  octave: [{ at: 0, step: 0, len: 2 }, { at: 3, step: 0, len: 2, oct: 1 }],
  walk: [{ at: 0, step: 0, len: 2 }, { at: 3, step: 4, len: 1 }, { at: 5, step: 2, len: 1 }],
  anticipate: [{ at: 0, step: 0, len: 3 }, { at: 5, step: 0, len: 1 }],
  sparse: [{ at: 3, step: 0, len: 2 }]
};
function playJigDrums (state, time, kick) {
  const { drums, density } = state;
  const eighth = durationSeconds (state, '8n');
  const at = slot => jitter (state, time, time + slot * eighth, 0.008);
  if (kick) {
    drums.kick.triggerAttackRelease ('C1', '8n', at (0), 0.8);
    if (chance (state, 0.3)) drums.kick.triggerAttackRelease ('C1', '16n', at (5), 0.5);
  }
  drums.snare.triggerAttackRelease ('8n', at (3), 0.65);
  for (let slot = 0; slot < 6; slot++) {
    if (slot % 3 === 0 || chance (state, 0.75)) {
      drums.hat.triggerAttackRelease ('32n', at (slot), slot % 3 === 0 ? 0.42 : 0.23);
    }
  }
  for (const slot of [2.5, 4.5]) {
    if (chance (state, density * 0.3)) drums.ghost.triggerAttackRelease ('32n', at (slot), 0.25);
  }
}
