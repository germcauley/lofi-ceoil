// A complete, serialisable score. No audio context, wall clock, storage or
// global random state is consulted: the recipe plus version determines it.
import { createMelodyGenerator } from './melody.js';
import { openingPlan } from './track-structure.js';
import { PROGRESSIONS, noteNameToMidi, findPivot } from './theory.js';
import { playChord, playBass, playDrums, playMelody, playCounter, playSupport, playDrone, playVinyl, durationSeconds } from './parts.js';

export const COMPOSITION_VERSION = 1;
export function seededRandom (seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6D2B79F5) >>> 0;
    let n = Math.imul (value ^ value >>> 15, 1 | value);
    n ^= n + Math.imul (n ^ n >>> 7, 61 | n);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

const clamp = n => Math.max (0, Math.min (1, n));
export function compositionSettings (recipe, energy) {
  const drift = recipe.arcDepth;
  const swing = (energy - 0.5) * 2 * drift;
  // A recipe saved before a setting existed simply has no value for it. Left
  // alone that yields NaN, which JSON writes as null — so an older saved score
  // would come back subtly broken rather than merely missing a part.
  const value = (key, weight = 0) => {
    const user = recipe.user[key] ?? 0;
    return clamp (user + (recipe.variation[key] ?? 0) * drift + swing * weight * user);
  };
  return {
    density: value ('density', 0.5), counter: value ('counter', 0.5),
    ornament: value ('ornament'), droneLevel: value ('drone'), dust: value ('dust'),
    supportLevel: value ('support'),
    swing: value ('swing'),
    tempo: Math.max (50, Math.min (100, recipe.tempoUser + recipe.tempoOffset * drift))
  };
}

function arrangement (energy, random) {
  const pick = options => options[Math.floor (random() * options.length)];
  const bare = random() < 0.45 + (0.5 - energy) * 0.5;
  return [0, 1, 2, 3].map (part => ({
    bass: part === 0 && bare ? 'none' : pick (energy > 0.5
      ? ['walk', 'octave', 'anticipate', 'rootFifth'] : ['held', 'root', 'sparse']),
    chordsFrom: part === 0 && bare ? 2 : 0,
    // 8 means the drums never arrive in this part. Kept rare: a sit-out is an
    // effect, and the arc used to make it the norm at low energy — 65% of
    // parts, four parts a turn, tracks lasting several turns, so the drums
    // could be gone for minutes at a time.
    drumsFrom: (part === 0 && bare) || random() > 0.55 + energy * 0.45 ? 8 : part === 0 ? 4 : 0,
    drumsUntil: part === 3 ? 6 : 8,
    counter: ! (part === 0 && bare), emptyBar: random() < 0.35 ? 7 : -1,
    comp: pick (energy > 0.5 ? ['bouzouki', 'boomChuck', 'anticipate', 'offbeat']
      : ['sustain', 'stab', 'offbeat', 'suspension']),
    chordHold: part < 2 && random() < 0.6 ? 2 : 1
  }));
}

const shapes = {
  swell: t => t < 0.68 ? Math.sin (Math.PI * 0.5 * t / 0.68) : Math.cos (Math.PI * 0.5 * (t - 0.68) / 0.32),
  build: t => t, ebb: t => 1 - t,
  plateau: t => t < 0.3 ? t / 0.3 : t < 0.7 ? 1 : (1 - t) / 0.3
};
function nextEnergy (arc, random) {
  if (arc.turn >= arc.length) {
    arc.shape = Object.keys (shapes)[Math.floor (random() * 4)];
    arc.length = 6 + Math.floor (random() * 6);
    arc.turn = 0;
  }
  const t = arc.length > 1 ? arc.turn / (arc.length - 1) : 0.5;
  arc.turn++;
  return 0.12 + clamp ((shapes[arc.shape] ?? shapes.swell) (t)) * 0.88;
}

function targetKey (root, scale, random) {
  const relative = { minor: 'major', dorian: 'mixolydian', major: 'minor', mixolydian: 'dorian' };
  const roll = random();
  if (roll < 0.3) { root += ['major', 'mixolydian'].includes (scale) ? -3 : 3; scale = relative[scale]; }
  else if (roll < 0.6) root += random() < 0.5 ? 5 : -5;
  else if (roll < 0.8) root += 2;
  else {
    const modes = Object.keys (PROGRESSIONS).filter (name => name !== scale);
    scale = modes[Math.floor (random() * modes.length)];
  }
  return { root: 48 + ((root - 48) % 12 + 12) % 12, scale };
}

/** Record the existing musical parts as data instead of sending them to a
    synth. Both generation and live re-voicing use this same arrangement logic. */
export function writeBarNotes (bar, context, random) {
  const notes = [];
  const state = { ...context, ...bar.settings, random, rootMidi: bar.rootMidi, scale: bar.scale };
  const secondsPerBeat = 60 / state.tempo;
  const record = (role, pitched) => ({ triggerAttackRelease (...args) {
    const [pitch, length, at, velocity] = pitched ? args : [null, ...args];
    notes.push ({ role, midi: pitch === null ? null : noteNameToMidi (pitch),
      at: at / secondsPerBeat, duration: durationSeconds (state, length) / secondsPerBeat, velocity });
  } });
  for (const role of ['keys', 'bass', 'lead', 'drone', 'pluck', 'support']) state[role] = record (role, true);
  state.drums = Object.fromEntries (['kick', 'snare', 'ghost', 'hat'].map (role => [role, record (role, role === 'kick')]));
  state.vinyl = { pops: record ('vinyl', false) };
  state.chain = { duck () {} };
  const plan = bar.arrangement, b = bar.barInPart;
  const empty = b === plan.emptyBar || (bar.winding && b === 7);
  if (! empty && b >= (plan.chordsFrom ?? 0) && (bar.hold === 1 || b % bar.hold === 0)) {
    playChord (state, 0, bar.chord, plan.comp);
  }
  if (! empty && ! (bar.winding && b >= 6) && plan.bass !== 'none' && b >= (plan.bassFrom ?? 0)) {
    playBass (state, 0, bar.chord, plan.bass);
  }
  if (! empty && ! (bar.winding && b >= 5) && b >= plan.drumsFrom && b < plan.drumsUntil) {
    playDrums (state, 0, { kick: b >= (plan.kickFrom ?? 0) });
  }
  if (b >= (plan.leadFrom ?? 0)) playMelody (state, 0, b - (plan.leadFrom ?? 0), bar.phrase, bar.chord);
  if (! empty && ! (bar.winding && b >= 6) && plan.counter !== false && b >= (plan.counterFrom ?? 0)) {
    playCounter (state, 0, b, bar.chord, bar.counterPlan, bar.phrase);
  }
  // The supporting line follows the tune, so it plays wherever the lead does.
  if (! empty) playSupport (state, 0, b, bar.phrase, bar.chord);
  if (b >= (plan.droneFrom ?? 0)) playDrone (state, 0);
  playVinyl (state, 0);
  context.previousVoicing = state.previousVoicing;
  return notes.sort ((a, b) => a.at - b.at);
}

export function composeTrack (input) {
  const recipe = structuredClone (input);
  if (recipe.version !== COMPOSITION_VERSION) throw new Error ('Unsupported composition version');
  if (! Number.isInteger (recipe.turns) || recipe.turns < 2 || recipe.turns > 4) throw new Error ('A track needs two to four turns');
  const random = seededRandom (recipe.seed);
  const pick = options => options[Math.floor (random() * options.length)];
  const melody = createMelodyGenerator (random);
  const arc = { ...recipe.arc };
  const structured = recipe.structure.style !== 'drift';
  const score = { version: COMPOSITION_VERSION, recipe, beatsPerBar: 4, turns: [], bars: [] };
  const ending = recipe.turnsSinceEnding + recipe.turns >= 4 && random() < 0.4;
  let rootMidi = recipe.rootMidi, scale = recipe.scale, progression = recipe.progression;
  let saved, pendingKey = null;
  const voices = { ...recipe.voices };
  const context = { previousVoicing: null };

  for (let turnIndex = 0; turnIndex < recipe.turns; turnIndex++) {
    if (pendingKey) {
      rootMidi = pendingKey.root; scale = pendingKey.scale; pendingKey = null;
      progression = pick (PROGRESSIONS[scale]); saved = null; context.previousVoicing = null;
    } else if (! structured && turnIndex > 0 && random() < 0.1) {
      scale = pick (Object.keys (PROGRESSIONS).filter (name => name !== scale));
      progression = pick (PROGRESSIONS[scale]); context.previousVoicing = null;
    }
    const energy = nextEnergy (arc, random);
    const settings = compositionSettings (recipe, energy);
    const size = melody.gappedPool (scale).length;
    const a = saved?.A ?? (recipe.structure.style === 'riff'
      ? melody.developRiff (size, recipe.motifA) : melody.developPhrase (scale, size, recipe.motifA));
    const mean = phrase => phrase.reduce ((sum, note) => sum + note.degree, 0) / phrase.length;
    let shift = 2;
    let b = saved?.B ?? melody.developPhrase (scale, size, recipe.motifB, 0.28, shift);
    while (! saved && shift < 6 && mean (b) < mean (a) + 1.5) b = melody.developPhrase (scale, size, recipe.motifB, 0.28, ++shift);
    if (structured) saved = { A: a, B: b };
    const phrases = structured ? recipe.structure.sections.map (name => saved[name])
      : [a, melody.developPhrase (scale, size, recipe.motifA), b, melody.developPhrase (scale, size, recipe.motifB, 0.28, shift)];
    const plans = arrangement (recipe.arcDepth > 0 ? energy : 0.5, random);
    const counterBySection = {};
    const counters = phrases.map ((phrase, i) => {
      const name = recipe.structure.sections[i];
      return structured ? counterBySection[name] ??= melody.planCounter (phrase) : melody.planCounter (phrase);
    });
    plans.forEach ((plan, i) => {
      // Never two drumless parts running, and never a turn without drums at
      // all. Whatever the dice said, the beat has to come back.
      if (i && plans[i - 1].drumsFrom >= 8 && plans[i].drumsFrom >= 8) {
        plans[i].drumsFrom = 0;
      }

      if (i && plans[i - 1].emptyBar >= 0) {
        for (const [role, probability] of [['lead', 1], ['keys', 0.4], ['bass', 0.25]]) {
          if (recipe.auto[role] && ! (structured && role === 'lead') && random() < probability) {
            const options = recipe.voiceOptions[role].filter (name => name !== voices[role]);
            voices[role] = pick (options);
          }
        }
      }
      Object.assign (plan, { leadVoice: voices.lead, keysVoice: voices.keys, bassVoice: voices.bass });
      if (structured) plan.chordHold = recipe.structure.sections[i] === 'A' ? recipe.structure.chordHold : 1;
    });
    if (turnIndex === 0) Object.assign (plans[0], openingPlan (recipe.structure), {
      bass: pick (['held', 'root', 'sparse']), emptyBar: -1, counter: true
    });
    const turn = { phrases, arrangement: plans, counterPlans: counters, energy, arc: { ...arc }, rootMidi, scale };
    score.turns.push (turn);
    let pivot = null;
    for (let position = 0; position < 32; position++) {
      const part = Math.floor (position / 8), barInPart = position % 8, plan = plans[part];
      const winding = ending && turnIndex === recipe.turns - 1 && part === 3;
      if (winding && barInPart === 4) {
        pendingKey = targetKey (rootMidi, scale, random);
        const found = findPivot (rootMidi, scale, pendingKey.root, pendingKey.scale);
        pivot = found ? [found.fromDegree, found.quality] : null;
      } else if (! winding && position === 31 && recipe.turnsSinceEnding + turnIndex >= 2 && random() < 0.12) {
        const target = targetKey (rootMidi, scale, random);
        const found = findPivot (rootMidi, scale, target.root, target.scale);
        if (found) { pendingKey = target; pivot = [found.fromDegree, found.quality]; }
      }
      const hold = progression.chords.length >= 6 ? 1 : plan.chordHold;
      const chord = pivot ?? progression.chords[Math.floor (barInPart / hold) % progression.chords.length];
      const bar = { index: score.bars.length, turn: turnIndex, part, barInPart,
        section: recipe.structure.sections[part], rootMidi, scale, progression: progression.name,
        chord, hold, arrangement: plan, phrase: phrases[part], counterPlan: counters[part],
        settings, winding, noteSeed: Math.floor (random() * 4294967296),
        voicingBefore: context.previousVoicing ? [...context.previousVoicing] : null };
      bar.notes = writeBarNotes (bar, context, seededRandom (bar.noteSeed));
      score.bars.push (bar);
      if (! structured && position > 0 && position % 8 === 0 && random() < 0.35) progression = pick (PROGRESSIONS[scale]);
    }
  }
  score.barCount = score.bars.length;
  score.ending = ending;
  score.restBars = ending ? 2 + Math.floor (random() * 3) : 0;
  score.nextKey = pendingKey;
  return score;
}

/** A control change rewrites only the unsounded suffix. Keep the edits so a
    score can be reconstructed from its original recipe plus revision history. */
export function reviseComposition (source, fromBar, edits) {
  const score = structuredClone (source);
  const recipe = { ...score.recipe, ...edits };
  const context = { previousVoicing: score.bars[fromBar]?.voicingBefore ?? null };
  for (let i = fromBar; i < score.bars.length; i++) {
    const bar = score.bars[i];
    bar.settings = compositionSettings (recipe, score.turns[bar.turn].energy);
    if (edits.rootMidi !== undefined) bar.rootMidi = edits.rootMidi;
    if (edits.scale) bar.scale = edits.scale;
    if (edits.progression) {
      bar.progression = edits.progression.name;
      bar.hold = edits.progression.chords.length >= 6 ? 1 : bar.arrangement.chordHold;
      bar.chord = edits.progression.chords[Math.floor (bar.barInPart / bar.hold) % edits.progression.chords.length];
    }
    bar.voicingBefore = context.previousVoicing ? [...context.previousVoicing] : null;
    bar.notes = writeBarNotes (bar, context, seededRandom (bar.noteSeed));
  }
  score.revisions = [...(score.revisions ?? []), { fromBar, edits: structuredClone (edits) }];
  return score;
}
