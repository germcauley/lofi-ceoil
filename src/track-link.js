// A tune, as a link.
//
// A score is a recipe plus a seed, so a tune is already reproducible from a
// few hundred bytes — but a few hundred bytes is a URL nobody would paste into
// a message. This packs a recipe into roughly forty, which is a link that
// looks like a link.
//
// The saving comes from spending bytes on identity rather than on JSON. A
// motif pair costs four bytes as the seed that produced it instead of a
// hundred as notes; a progression costs one byte as its position in the mode's
// table instead of seventy-six as its chords; a knob costs one byte at 1/255
// resolution, which is far finer than anyone can hear on a control that spans
// nought to one.
//
// Everything the codec indexes into is imported rather than restated, so a
// list cannot drift out of step with the encoding by being edited elsewhere.
// The order of those lists is now part of the link format: appending is safe,
// reordering or removing silently changes what an existing link means, which
// is what LIST_FINGERPRINT in the tests is there to catch.

import { PROGRESSIONS } from './theory.js';
import { LEAD_VOICES, KEYS_VOICES, BASS_VOICES, COUNTER_VOICES } from './instruments.js';

const COUNTER_NAMES = Object.keys (COUNTER_VOICES);
import { titleAt, titleIndexOf } from './track-names.js';
import { sectionsFor } from './track-structure.js';
import { createTrackMaterialPicker } from './track-material.js';
import { COMPOSITION_VERSION } from './composition.js';

// Replaying a known seed needs no history, and must not write any: opening
// somebody else's link should not change what your own next track avoids.
const motifsFor = (materialSeed, material) =>
  createTrackMaterialPicker ({ storage: null }) ({ materialSeed, material });

export const LINK_VERSION = 1;

const SCALES = ['major', 'minor', 'dorian', 'mixolydian'];
const STYLES = ['tune', 'riff', 'traditional', 'drift'];
const OPENINGS = ['melody', 'chords', 'layered', 'rhythm', 'full'];
const METERS = ['4/4', '6/8'];
const ARCS = ['swell', 'build', 'ebb', 'plateau'];

// Only these reach the notes; the rest of the panel is the tape path, which
// changes the sound rather than the tune. Both are carried, in that order.
const SCORE_KNOBS = ['density', 'counter', 'ornament', 'drone', 'dust', 'support', 'swing'];
const TONE_KNOBS = ['brightness', 'wobble', 'drive', 'space', 'pump', 'volume'];

const SCORINGS = ['full', 'duo', 'bare', 'driving'];
const KNOBS = [...SCORE_KNOBS, ...TONE_KNOBS];

// The tail. Everything added after links were already being shared lives here,
// in the order it was added, and nothing anywhere else moves.
//
// Appending to a list in the middle of the layout — TONE_KNOBS, say — looks
// harmless and is not: everything written after it shifts by a byte, so an
// existing link still decodes and quietly describes a different tune, which is
// worse than failing outright.
//
// There is one tail rather than a tail and then a straggler. `scoring` used to
// be written after the late knobs instead of being one of them, so adding
// `width` to that list pushed `scoring` along by a byte — the same fault a
// byte further down, and this format's third go at setting the same trap. One
// list, one append point, and a test that walks the tail backwards.
//
// Each field says what its absence means, because a missing byte reads as
// nought and nought is not always the right answer. No echo is right for a
// tune written before the echo existed; no drums is not, because that link had
// drums, and silence would be a wrong reading rather than a missing one.
const TAIL = [
  { name: 'echo', whenAbsent: 0, write: user => byte (user.echo), read: value => unbyte (value) },
  { name: 'drums', whenAbsent: 1, write: user => byte (user.drums), read: value => unbyte (value) },
  // Not a knob: index nought is `full`, which is what every track written
  // before scorings existed was. It lives on the recipe's structure rather
  // than in `user`, which is why it carries its own reach.
  { name: 'scoring', whenAbsent: 'full', knob: false,
    write: (user, recipe) => index (SCORINGS, recipe.structure?.scoring),
    read: value => SCORINGS[value] ?? 'full' },
  // Absent means mono, because a track written before the panners existed was
  // mono — there was not a single panner in the graph.
  { name: 'width', whenAbsent: 0, write: user => byte (user.width), read: value => unbyte (value) },
  // Which set of rhythmic cells the tune was written from. Not a knob and not
  // a setting: a link is a seed, and the seed only means something alongside
  // the table it was drawn against. Absent is one, because that is the table
  // every link written before the running line existed was drawn from — and
  // getting this wrong would not break a link, it would silently hand back a
  // different tune under the same name, which is worse.
  { name: 'material', whenAbsent: 1, knob: false,
    write: (user, recipe) => recipe.material ?? 1,
    read: value => value || 1 },
  // The counter line's voice. Index nought is the pluck, which is what every
  // track written before this table existed played — it was the only one.
  { name: 'counterVoice', whenAbsent: COUNTER_NAMES[0], knob: false,
    write: (user, recipe) => index (COUNTER_NAMES, recipe.counterVoice),
    read: value => COUNTER_NAMES[value] ?? COUNTER_NAMES[0] }
];

// The knob-shaped tail fields, which are the ones quantising applies to.
const TAIL_KNOBS = TAIL.filter (field => field.knob !== false).map (field => field.name);

const VOICES = {
  lead: Object.keys (LEAD_VOICES),
  keys: Object.keys (KEYS_VOICES),
  bass: Object.keys (BASS_VOICES)
};

const index = (list, value, fallback = 0) => {
  const at = list.indexOf (value);
  return at < 0 ? fallback : at;
};

// A knob spans 0..1, so a byte gives 1/255 — finer than the ear on any of
// them. A variation is a signed offset within about half that range.
const byte = value => Math.max (0, Math.min (255, Math.round ((value ?? 0) * 255)));
const unbyte = value => value / 255;
const signed = value => Math.max (0, Math.min (255, Math.round ((value ?? 0) * 255 + 128)));
const unsigned = value => (value - 128) / 255;

/** A recipe with every value moved onto the lattice the link can express.

    Without this a shared tune is merely similar. A knob rounded to 1/255 is
    inaudibly different, but `compositionSettings` compares those values
    against seeded randoms, so a difference of a thousandth flips one
    comparison and the divergence cascades through the rest of the score.

    Applying it when a recipe is *made* rather than when it is encoded is what
    makes the round trip exact: the tune that plays is already the tune the
    link describes. */
export function quantiseRecipe (recipe) {
  const user = { ...recipe.user };
  for (const knob of [...KNOBS, ...TAIL_KNOBS]) {
    if (user[knob] !== undefined) user[knob] = unbyte (byte (user[knob]));
  }

  const variation = { ...recipe.variation };
  for (const knob of SCORE_KNOBS) {
    if (variation[knob] !== undefined) variation[knob] = unsigned (signed (variation[knob]));
  }

  return { ...recipe, user, variation, arcDepth: unbyte (byte (recipe.arcDepth)) };
}

class Writer {
  constructor () { this.bytes = []; }
  u8 (value) { this.bytes.push (value & 0xFF); return this; }
  u16 (value) { return this.u8 (value >> 8).u8 (value); }
  u32 (value) { return this.u16 (value >>> 16).u16 (value & 0xFFFF); }
}

class Reader {
  constructor (bytes) { this.bytes = bytes; this.at = 0; }
  u8 () { return this.bytes[this.at++] ?? 0; }
  get spent () { return this.at > this.bytes.length; }
  has (count = 1) { return this.at + count <= this.bytes.length; }
  u16 () { return (this.u8() << 8) | this.u8(); }
  u32 () { return ((this.u16() * 65536) + this.u16()) >>> 0; }
}

/** A recipe as bytes. */
export function packRecipe (recipe) {
  const w = new Writer();
  const scale = index (SCALES, recipe.scale, 2);
  const table = PROGRESSIONS[recipe.scale] ?? PROGRESSIONS.minor;

  w.u8 (LINK_VERSION);
  w.u32 (recipe.seed >>> 0);
  w.u32 (recipe.materialSeed >>> 0);
  w.u8 (recipe.rootMidi ?? 48);
  w.u8 (scale);
  w.u8 (index (STYLES, recipe.structure?.style));
  w.u8 (index (OPENINGS, recipe.structure?.opening));
  w.u8 (index (METERS, recipe.structure?.meter));
  w.u8 (recipe.structure?.chordHold ?? 2);
  w.u8 (Math.max (0, table.findIndex (entry => entry.name === recipe.progression?.name)));
  w.u8 (recipe.turns ?? 3);
  w.u8 (recipe.turnsSinceEnding ?? 0);
  w.u8 (index (ARCS, recipe.arc?.shape));
  w.u8 (recipe.arc?.length ?? 8);
  w.u8 (recipe.arc?.turn ?? 0);
  w.u8 (byte (recipe.arcDepth));
  w.u8 (Math.round (recipe.tempoUser ?? 80));
  w.u8 (signed ((recipe.tempoOffset ?? 0) / 255));
  for (const knob of KNOBS) w.u8 (byte (recipe.user?.[knob]));
  for (const knob of SCORE_KNOBS) w.u8 (signed (recipe.variation?.[knob]));
  for (const role of ['lead', 'keys', 'bass']) w.u8 (index (VOICES[role], recipe.voices?.[role]));
  w.u16 (Math.max (0, titleIndexOf (recipe.title)));
  for (const field of TAIL) w.u8 (field.write (recipe.user ?? {}, recipe));

  return Uint8Array.from (w.bytes);
}

/** Bytes back to a recipe, complete enough to compose from. */
export function unpackRecipe (bytes, { voiceOptions } = {}) {
  const r = new Reader (bytes);
  const version = r.u8();
  if (version !== LINK_VERSION) throw new Error (`Unsupported link version ${version}`);

  const seed = r.u32();
  const materialSeed = r.u32();
  const rootMidi = r.u8();
  const scale = SCALES[r.u8()] ?? 'dorian';
  const style = STYLES[r.u8()] ?? 'tune';
  const opening = OPENINGS[r.u8()] ?? 'melody';
  const meter = METERS[r.u8()] ?? '4/4';
  const chordHold = r.u8();
  const progressionAt = r.u8();
  const turns = r.u8();
  const turnsSinceEnding = r.u8();
  const arcShape = ARCS[r.u8()] ?? 'swell';
  const arcLength = r.u8();
  const arcTurn = r.u8();
  const arcDepth = unbyte (r.u8());
  const tempoUser = r.u8();
  const tempoOffset = Math.round (unsigned (r.u8()) * 255);

  const user = {};
  for (const knob of KNOBS) user[knob] = unbyte (r.u8());
  const variation = {};
  for (const knob of SCORE_KNOBS) variation[knob] = unsigned (r.u8());
  const voices = {};
  for (const role of ['lead', 'keys', 'bass']) voices[role] = VOICES[role][r.u8()] ?? VOICES[role][0];
  const title = titleAt (r.u16());
  const tail = {};
  for (const field of TAIL) tail[field.name] = r.has() ? field.read (r.u8()) : field.whenAbsent;
  for (const name of TAIL_KNOBS) user[name] = tail[name];
  const scoring = tail.scoring;

  const table = PROGRESSIONS[scale] ?? PROGRESSIONS.minor;

  return {
    version: COMPOSITION_VERSION, seed, materialSeed,
    title: title.title, titleEnglish: title.titleEnglish, titleLanguage: title.titleLanguage,
    rootMidi, scale,
    structure: { style, opening, meter, chordHold, scoring, sections: sectionsFor (style) },
    ...motifsFor (materialSeed, tail.material),
    progression: table[progressionAt] ?? table[0],
    turns, turnsSinceEnding,
    arc: { shape: arcShape, length: arcLength, turn: arcTurn },
    arcDepth, tempoUser, tempoOffset,
    user, variation, voices, counterVoice: tail.counterVoice,
    auto: { lead: true, keys: true, bass: true },
    voiceOptions: voiceOptions ?? VOICES
  };
}

const toBase64Url = bytes => btoa (String.fromCharCode (...bytes))
  .replace (/\+/g, '-').replace (/\//g, '_').replace (/=+$/, '');

const fromBase64Url = text => Uint8Array.from (
  atob (text.replace (/-/g, '+').replace (/_/g, '/')), character => character.charCodeAt (0));

/** The share code for a tune. */
export const encodeTrack = recipe => toBase64Url (packRecipe (recipe));

/** A share code back to a recipe. Returns null rather than throwing, because
    this is reading something a stranger pasted into a URL bar. */
export function decodeTrack (code, options) {
  try {
    return unpackRecipe (fromBase64Url (code), options);
  } catch {
    return null;
  }
}
