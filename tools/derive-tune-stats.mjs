// Derive melodic statistics from The Session's tune dump.
//
// The generator's melodic grammar was hand-tuned by ear. This measures what
// real tunes actually do instead, and writes a small table the generator can
// read. Statistics only: no tune, phrase or setting from the corpus is copied
// into the output, and none of it is redistributed. What comes out the far end
// is how often a shape occurs, which is a fact about the repertoire rather
// than anyone's transcription of it.
//
// Source: https://github.com/adactio/TheSession-data (weekly dumps of
// thesession.org), licensed ODbL. See src/data/TUNE-STATS-ATTRIBUTION.md.
//
//   node tools/derive-tune-stats.mjs <path-to-tunes.csv>

import { readFileSync, writeFileSync } from 'node:fs';

const OUT = new URL ('../src/data/tune-stats.js', import.meta.url);
const DEGREE = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

// Types worth deriving separately. Everything else still counts towards the
// overall table but does not get one of its own.
const TYPES = ['jig', 'reel', 'slip jig', 'polka', 'hornpipe', 'waltz'];
const MODES = ['major', 'minor', 'dorian', 'mixolydian'];

/** ABC body to a list of parts, each a list of melodic events.

    Everything that is not a melody note is removed rather than approximated:
    grace notes are ornaments the generator adds itself, chord symbols and
    decorations are performance directions, and inline fields are metadata.
    A rest breaks the melodic line; a barline does not. */
export function parseAbc (abc) {
  const cleaned = abc
    .replace (/%[^\n]*/g, '')            // comments
    .replace (/\[[A-Za-z]:[^\]]*\]/g, '')// inline fields, e.g. [K:Ador]
    .replace (/"[^"]*"/g, '')            // chord symbols and annotations
    .replace (/![^!]*!/g, '')            // decorations, e.g. !trill!
    .replace (/\+[^+]*\+/g, '')          // the older decoration syntax
    .replace (/\{[^}]*\}/g, '')          // grace notes
    .replace (/\[\d/g, '')               // first/second endings
    .replace (/[()\-~.HLMOPSTuv]/g, ''); // slurs, ties, single-letter decorations

  const parts = [];
  let current = [];
  const token = /(\[)|(\])|([_^=]*)([A-Ga-g])([,']*)|([zZx])|(:?\|[:\]]?|::)/g;
  let inChord = false, chordTaken = false;

  for (const match of cleaned.matchAll (token)) {
    const [, open, close, , letter, octave, rest, bar] = match;
    if (open) { inChord = true; chordTaken = false; continue; }
    if (close) { inChord = false; continue; }

    if (letter) {
      // A chord in a melody line is a double stop; its first note carries the
      // tune, so the rest would double-count.
      if (inChord && chordTaken) continue;
      if (inChord) chordTaken = true;
      const base = DEGREE[letter.toUpperCase()] + (letter === letter.toLowerCase() ? 7 : 0);
      current.push ({ degree: base + 7 * (octave.match (/'/g)?.length ?? 0)
                                   - 7 * (octave.match (/,/g)?.length ?? 0) });
      continue;
    }

    if (rest) { current.push (null); continue; }        // breaks the line
    // A repeat or double bar ends a part; a single barline does not.
    if (bar && bar !== '|') { if (current.length) parts.push (current); current = []; }
  }

  if (current.length) parts.push (current);
  return parts;
}

function tally () {
  return { intervals: new Map(), cadences: new Map(), notes: 0, settings: 0 };
}

function record (into, parts, tonic) {
  into.settings++;
  for (const part of parts) {
    let previous = null;
    for (const event of part) {
      if (! event) { previous = null; continue; }       // a rest breaks it
      into.notes++;
      if (previous !== null) {
        const step = event.degree - previous;
        // Beyond an octave is almost always a transcription artefact rather
        // than a melodic move.
        if (Math.abs (step) <= 7) into.intervals.set (step, (into.intervals.get (step) ?? 0) + 1);
      }
      previous = event.degree;
    }
    // Where the part comes to rest, as a scale degree of the tune's own key.
    const last = [...part].reverse().find (Boolean);
    if (last && tonic !== null) {
      const degree = ((last.degree - tonic) % 7 + 7) % 7;
      into.cadences.set (degree, (into.cadences.get (degree) ?? 0) + 1);
    }
  }
}

const distribution = map => {
  const total = [...map.values()].reduce ((sum, n) => sum + n, 0);
  return Object.fromEntries ([...map.entries()].sort ((a, b) => a[0] - b[0])
    .map (([key, n]) => [key, Number ((n / total).toFixed (5))]));
};

/** Minimal CSV reader: the dump quotes any field containing newlines. */
function* rows (text) {
  let field = '', row = [], quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push (field); field = ''; }
    else if (c === '\n') { row.push (field); yield row; row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push (field); yield row; }
}

const path = process.argv[2];
if (! path) { console.error ('usage: node tools/derive-tune-stats.mjs <tunes.csv>'); process.exit (1); }

const iterator = rows (readFileSync (path, 'utf8'));
const header = iterator.next().value;
const column = Object.fromEntries (header.map ((name, i) => [name, i]));

const buckets = { overall: tally() };
const modeCounts = {};
let skipped = 0;

for (const row of iterator) {
  if (row.length < header.length) { skipped++; continue; }
  const type = row[column.type], mode = row[column.mode];
  const family = MODES.find (name => mode.toLowerCase().endsWith (name));
  const tonic = DEGREE[mode[0]?.toUpperCase()] ?? null;
  const parts = parseAbc (row[column.abc]);
  if (! parts.length) { skipped++; continue; }

  record (buckets.overall, parts, tonic);
  if (TYPES.includes (type)) {
    record (buckets[type] ??= tally(), parts, tonic);
    if (family) (modeCounts[type] ??= {})[family] = ((modeCounts[type] ?? {})[family] ?? 0) + 1;
  }
  if (family) (modeCounts.overall ??= {})[family] = ((modeCounts.overall ?? {})[family] ?? 0) + 1;
}

const share = counts => {
  const total = Object.values (counts).reduce ((sum, n) => sum + n, 0);
  return Object.fromEntries (Object.entries (counts)
    .map (([name, n]) => [name, Number ((n / total).toFixed (4))]));
};

const output = {
  source: 'thesession.org via github.com/adactio/TheSession-data, ODbL',
  derived: new Date().toISOString().slice (0, 10),
  note: 'Distributions only. No tune, setting or phrase from the corpus is reproduced here.',
  types: {}
};

for (const [name, bucket] of Object.entries (buckets)) {
  output.types[name] = {
    settings: bucket.settings,
    notes: bucket.notes,
    intervals: distribution (bucket.intervals),
    cadences: distribution (bucket.cadences),
    modes: modeCounts[name] ? share (modeCounts[name]) : undefined
  };
}

// A module rather than a .json file: Vite and Node then load it the same way,
// with no import assertion to keep in step between the app and the tests.
writeFileSync (OUT, `// Generated by tools/derive-tune-stats.mjs — do not edit by hand.
// ${output.note}
// Source: ${output.source}. Derived ${output.derived}.
export const TUNE_STATS = ${JSON.stringify (output, null, 2)};

export default TUNE_STATS;
`);
console.log (`skipped ${skipped} unusable rows`);
for (const [name, bucket] of Object.entries (output.types)) {
  console.log (`${name.padEnd (10)} ${String (bucket.settings).padStart (6)} settings  ` +
    `${String (bucket.notes).padStart (8)} notes  repeat ${(bucket.intervals['0'] * 100).toFixed (1)}%`);
}
