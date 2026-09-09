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
import { pathToFileURL } from 'node:url';

const OUT = new URL ('../src/data/tune-stats.js', import.meta.url);
const DEGREE = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

// Types worth deriving separately. Everything else still counts towards the
// overall table but does not get one of its own.
const TYPES = ['jig', 'reel', 'slip jig', 'polka', 'hornpipe', 'waltz'];

// Chord symbols, for the harmony table. ABC carries them in quotes; roughly
// nine per cent of settings have them, contributed by whoever typed the
// setting — so this samples what accompanists play rather than the tunes
// themselves. Enough to weight existing choices with, not to invent new ones.
const PITCH = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const CHORD = /^([A-G])([b#]?)(m|min|maj|dim|aug|sus\d?)?(\d*)(\/[A-G][b#]?)?$/;
const MODES = ['major', 'minor', 'dorian', 'mixolydian'];

/** ABC body to a list of parts, each a list of melodic events.

    Everything that is not a melody note is removed rather than approximated:
    grace notes are ornaments the generator adds itself, chord symbols and
    decorations are performance directions, and inline fields are metadata.
    A rest breaks the melodic line; a barline does not.

    Each note carries its written length as a multiple of the tune's unit note
    length, which is not known here and does not need to be: the rhythm pass
    works out what a bar is worth from the lengths themselves. Single barlines
    come through as markers, because a rhythm is a fact about a bar and there
    is no other way to tell where one ends. */
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
  // The length suffix comes after the octave marks: `A2`, `A/`, `A/4`, `A3/2`.
  // Broken rhythm — `A>B`, the dotted pair that is most of a hornpipe — is a
  // separate token, because it changes the length of the notes either side of
  // it rather than carrying one of its own.
  const token = /(\[)|(\])|([_^=]*)([A-Ga-g])([,']*)(\d*\/*\d*)|([zZx])(\d*\/*\d*)|([<>])|(:?\|[:\]]?|::)/g;
  let inChord = false, chordTaken = false;
  let broken = 0;

  /** A written length as a multiple of the unit note length. */
  const lengthOf = text => {
    if (! text) return 1;
    const [top, bottom] = text.split ('/');
    if (! text.includes ('/')) return Number (top) || 1;
    // `A//` is a quarter: each bare slash halves again.
    if (bottom === '') return (Number (top) || 1) / 2 ** (text.match (/\//g).length);
    return (Number (top) || 1) / (Number (bottom) || 2);
  };

  for (const match of cleaned.matchAll (token)) {
    const [, open, close, , letter, octave, noteLength, rest, , dot, bar] = match;
    if (open) { inChord = true; chordTaken = false; continue; }
    if (close) { inChord = false; continue; }

    // `>` lengthens the note before and shortens the one after; `<` reverses
    // it. Applied to the previous note as soon as it is seen, and remembered
    // for the next.
    if (dot) {
      const previous = current.at (-1);
      const factor = dot === '>' ? 1.5 : 0.5;
      if (previous?.length !== undefined) previous.length *= factor;
      broken = dot === '>' ? 0.5 : 1.5;
      continue;
    }

    if (letter) {
      // A chord in a melody line is a double stop; its first note carries the
      // tune, so the rest would double-count.
      if (inChord && chordTaken) continue;
      if (inChord) chordTaken = true;
      const base = DEGREE[letter.toUpperCase()] + (letter === letter.toLowerCase() ? 7 : 0);
      current.push ({
        degree: base + 7 * (octave.match (/'/g)?.length ?? 0)
                     - 7 * (octave.match (/,/g)?.length ?? 0),
        length: lengthOf (noteLength) * (broken || 1)
      });
      broken = 0;
      continue;
    }

    if (rest) { current.push (null); broken = 0; continue; }   // breaks the line
    if (bar) current.push ({ barline: true });
    // A repeat or double bar ends a part; a single barline does not.
    if (bar && bar !== '|') { if (current.length) parts.push (current); current = []; }
  }

  if (current.length) parts.push (current);
  return parts;
}

function tally () {
  return { intervals: new Map(), transitions: new Map(), cadences: new Map(),
           lengths: new Map(), lengthSteps: new Map(), bars: new Map(),
           evenBars: 0, barCount: 0, notes: 0, settings: 0 };
}

// How many quavers a bar of each meter is worth. Everything is measured in
// quavers because that is the unit the generator's own rhythms are written in.
const BAR_EIGHTHS = {
  '4/4': 8, '2/2': 8, '6/8': 6, '3/4': 6, '2/4': 4,
  '9/8': 9, '12/8': 12, '3/2': 12
};

// Written lengths land on ragged numbers when a setting divides a bar oddly —
// a triplet gives 0.857 of a quaver. Rounding to quarters keeps the common
// values exact (1, 0.5, 1.5, 2, 3) and stops a few hundred transcription
// oddities each claiming a row of their own.
const quantise = length => Math.min (8, Math.round (length * 4) / 4);

// The bar a type is actually written in, in quavers. A rhythm table pooled
// across meters describes nothing — a handful of settings filed as reels are
// written in 9/8, and their nine-quaver bars landed in a table that is
// supposed to say what a reel's eight-quaver bar looks like. Bars in any other
// meter are counted towards nothing rather than towards the wrong thing.
const TYPE_BAR = {
  jig: 6, 'slip jig': 9, reel: 8, hornpipe: 8, polka: 4, waltz: 6
};

/** What one setting's bars are made of, in quavers.

    The dump carries no unit note length, and it does not need to: how much a
    bar is worth here comes from the bars themselves. Whatever total occurs
    most often *is* a full bar in this setting, and anything else is a pickup,
    a run-in, or a transcription that does not add up. */
function recordRhythm (into, parts, meter, expected) {
  const eighths = BAR_EIGHTHS[meter];
  if (! eighths || eighths !== expected) return;

  const bars = [];
  for (const part of parts) {
    let bar = [], spoiled = false;
    for (const event of part) {
      // A rest occupies time this parser does not measure, so a bar holding
      // one has an incomplete rhythm rather than a short one.
      if (! event) { spoiled = true; continue; }
      if (event.barline) {
        if (bar.length && ! spoiled) bars.push (bar);
        bar = []; spoiled = false;
        continue;
      }
      bar.push (event.length);
    }
    if (bar.length && ! spoiled) bars.push (bar);
  }
  if (bars.length < 4) return;

  const totalOf = bar => Number (bar.reduce ((sum, n) => sum + n, 0).toFixed (3));
  const totals = new Map();
  for (const bar of bars) totals.set (totalOf (bar), (totals.get (totalOf (bar)) ?? 0) + 1);
  const [full] = [...totals].sort ((a, b) => b[1] - a[1])[0];
  if (! (full > 0)) return;

  const scale = eighths / full;
  for (const bar of bars) {
    if (totalOf (bar) !== full) continue;
    const written = bar.map (length => quantise (length * scale));
    if (written.some (length => ! (length > 0))) continue;
    // Rounding must not have changed the bar. Nine notes across a bar of eight
    // are 0.889 of a quaver each, which rounds to a whole one and gives a
    // nine-quaver bar in a table of eight-quaver bars; a slip jig divided in
    // sevens does the same thing the other way. A bar the grid cannot express
    // is not a bar to count as though it could.
    if (Number (written.reduce ((sum, length) => sum + length, 0).toFixed (3)) !== eighths) continue;

    into.barCount++;
    if (written.every (length => length === written[0])) into.evenBars++;
    const key = written.join (' ');
    into.bars.set (key, (into.bars.get (key) ?? 0) + 1);

    let previous = null;
    for (const length of written) {
      into.lengths.set (length, (into.lengths.get (length) ?? 0) + 1);
      if (previous !== null) {
        const step = previous + '>' + length;
        into.lengthSteps.set (step, (into.lengthSteps.get (step) ?? 0) + 1);
      }
      previous = length;
    }
  }
}

// Intervals rarer than this are folded into the neighbour one step smaller
// rather than given their own row, which keeps the table small and stops a
// handful of transcription oddities becoming a rule.
const KEEP = 5;
const fold = step => Math.max (-KEEP, Math.min (KEEP, step));

function record (into, parts, tonic) {
  into.settings++;
  for (const part of parts) {
    let previous = null, lastStep = null;
    for (const event of part) {
      if (! event) { previous = null; lastStep = null; continue; }   // a rest breaks it
      if (event.barline) continue;                                   // not a note
      into.notes++;
      if (previous !== null) {
        const step = event.degree - previous;
        // Beyond an octave is almost always a transcription artefact rather
        // than a melodic move.
        if (Math.abs (step) <= 7) {
          into.intervals.set (step, (into.intervals.get (step) ?? 0) + 1);
          // What a tune does next, given what it just did. This is where the
          // grammar lives: a leap is answered, a run keeps running.
          if (lastStep !== null) {
            const key = fold (lastStep) + ',' + fold (step);
            into.transitions.set (key, (into.transitions.get (key) ?? 0) + 1);
          }
          lastStep = step;
        } else lastStep = null;
      }
      previous = event.degree;
    }
    // Where the part comes to rest, as a scale degree of the tune's own key.
    const last = [...part].reverse().find (event => event && ! event.barline);
    if (last && tonic !== null) {
      const degree = ((last.degree - tonic) % 7 + 7) % 7;
      into.cadences.set (degree, (into.cadences.get (degree) ?? 0) + 1);
    }
  }
}

/** Rows of P(next | previous), each row summing to one. A row with too little
    behind it is dropped: the caller falls back to the plain distribution
    rather than trusting a handful of examples. */
function transitionRows (map, floor = 200) {
  const rows = {};
  for (const [key, count] of map) {
    const [from, to] = key.split (',');
    (rows[from] ??= {})[to] = (rows[from][to] ?? 0) + count;
  }
  const out = {};
  for (const [from, row] of Object.entries (rows)) {
    const total = Object.values (row).reduce ((sum, n) => sum + n, 0);
    if (total < floor) continue;
    out[from] = Object.fromEntries (Object.entries (row)
      .sort ((a, b) => Number (a[0]) - Number (b[0]))
      .map (([to, n]) => [to, Number ((n / total).toFixed (5))]));
  }
  return out;
}

const distribution = (map, floor = 0) => {
  const total = [...map.values()].reduce ((sum, n) => sum + n, 0);
  return Object.fromEntries ([...map.entries()].sort ((a, b) => a[0] - b[0])
    .filter (([, n]) => n / total >= floor)
    .map (([key, n]) => [key, Number ((n / total).toFixed (5))]));
};

/** The bar rhythms worth keeping: those carrying at least half a percent of
    the type's bars, commonest first, and never more than two dozen. The tail
    is enormous and almost entirely transcription noise — reels alone have over
    thirteen hundred distinct rhythms, and the top dozen cover four fifths. */
function commonestBars (map, total) {
  return [...map]
    .filter (([, n]) => n / total >= 0.005)
    .sort ((a, b) => b[1] - a[1])
    .slice (0, 24)
    .map (([pattern, n]) => [pattern.split (' ').map (Number), Number ((n / total).toFixed (5))]);
}

/** P(next length | previous length), by the same rule as the interval rows: a
    row with too little behind it is dropped rather than trusted. */
function lengthRows (map, floor = 500) {
  const rows = {};
  for (const [key, count] of map) {
    const [from, to] = key.split ('>');
    (rows[from] ??= {})[to] = (rows[from][to] ?? 0) + count;
  }
  const out = {};
  for (const [from, row] of Object.entries (rows)) {
    const total = Object.values (row).reduce ((sum, n) => sum + n, 0);
    if (total < floor) continue;
    out[from] = Object.fromEntries (Object.entries (row)
      .filter (([, n]) => n / total >= 0.005)
      .sort ((a, b) => Number (a[0]) - Number (b[0]))
      .map (([to, n]) => [to, Number ((n / total).toFixed (5))]));
  }
  return out;
}

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

/** Chord symbols in one setting, as semitones above its own tonic paired with
    whether they are minor. Absolute letters are useless across keys; a degree
    is the same fact in every one of them. */
function chordsOf (abc, tonic) {
  const found = [];
  for (const [, symbol] of abc.matchAll (/"([^"]*)"/g)) {
    const match = CHORD.exec (symbol.trim());
    if (! match) continue;
    const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
    const root = ((PITCH[match[1]] + accidental - tonic) % 12 + 12) % 12;
    const quality = match[3] ?? '';
    found.push (`${root}:${quality.startsWith ('m') && ! quality.startsWith ('maj') ? 'min' : 'maj'}`);
  }
  return found;
}

// Running the tool derives the tables; importing it hands over the parser
// alone, which is what a test wants — feeding one a whole corpus to check how
// it reads a dotted quaver would be absurd.
const path = process.argv[2];
if (path) derive (path);
else if (import.meta.url === pathToFileURL (process.argv[1] ?? '.').href) {
  console.error ('usage: node tools/derive-tune-stats.mjs <tunes.csv>');
  process.exit (1);
}

function derive (path) {

  const iterator = rows (readFileSync (path, 'utf8'));
  const header = iterator.next().value;
  const column = Object.fromEntries (header.map ((name, i) => [name, i]));

  const buckets = { overall: tally() };
  const modeCounts = {};
  const harmony = {};
  let skipped = 0;

  for (const row of iterator) {
    if (row.length < header.length) { skipped++; continue; }
    const type = row[column.type], mode = row[column.mode];
    const family = MODES.find (name => mode.toLowerCase().endsWith (name));
    const tonic = DEGREE[mode[0]?.toUpperCase()] ?? null;
    const parts = parseAbc (row[column.abc]);
    if (! parts.length) { skipped++; continue; }

    if (family && tonic !== null && PITCH[mode[0]?.toUpperCase()] !== undefined) {
      // Chords are semitone arithmetic; `tonic` above is a diatonic index, and
      // mixing the two silently produced a table where the tonic was not even
      // the commonest chord in major.
      const tonicPitch = PITCH[mode[0]?.toUpperCase()];
      for (const chord of chordsOf (row[column.abc], tonicPitch)) {
        (harmony[family] ??= {})[chord] = (harmony[family][chord] ?? 0) + 1;
      }
    }

    const meter = row[column.meter];
    record (buckets.overall, parts, tonic);
    if (TYPES.includes (type)) {
      record (buckets[type] ??= tally(), parts, tonic);
      // Rhythm is per type rather than overall, because a bar means a
      // different length in each meter and pooling them says nothing.
      recordRhythm (buckets[type], parts, meter, TYPE_BAR[type]);
      if (family) (modeCounts[type] ??= {})[family] = ((modeCounts[type] ?? {})[family] ?? 0) + 1;
    }
    if (family) (modeCounts.overall ??= {})[family] = ((modeCounts.overall ?? {})[family] ?? 0) + 1;
  }

  const share = counts => {
    const total = Object.values (counts).reduce ((sum, n) => sum + n, 0);
    return Object.fromEntries (Object.entries (counts)
      .map (([name, n]) => [name, Number ((n / total).toFixed (4))]));
  };

  const chordShare = counts => {
    const total = Object.values (counts).reduce ((sum, n) => sum + n, 0);
    return Object.fromEntries (Object.entries (counts)
      .filter (([, n]) => n / total >= 0.002)
      .sort ((a, b) => b[1] - a[1])
      .map (([chord, n]) => [chord, Number ((n / total).toFixed (5))]));
  };

  const output = {
    source: 'thesession.org via github.com/adactio/TheSession-data, ODbL',
    derived: new Date().toISOString().slice (0, 10),
    note: 'Distributions only. No tune, setting or phrase from the corpus is reproduced here.',
    types: {},
    // Semitones above the tonic, and whether the chord is minor.
    harmony: Object.fromEntries (Object.entries (harmony).map (([mode, counts]) => [mode, chordShare (counts)]))
  };

  for (const [name, bucket] of Object.entries (buckets)) {
    output.types[name] = {
      settings: bucket.settings,
      notes: bucket.notes,
      intervals: distribution (bucket.intervals),
      transitions: transitionRows (bucket.transitions),
      cadences: distribution (bucket.cadences),
      modes: modeCounts[name] ? share (modeCounts[name]) : undefined,
      rhythm: bucket.barCount ? {
        bars: bucket.barCount,
        // The share of bars in which every note is the same length. This is
        // the number that matters most and the one nobody had looked at: a
        // session tune is mostly running quavers, and the generator is not.
        even: Number ((bucket.evenBars / bucket.barCount).toFixed (4)),
        lengths: distribution (bucket.lengths, 0.001),
        // The commonest whole-bar rhythms. A rhythm is not a tune — there is
        // no pitch here and nothing that could reconstruct one — so this is a
        // distribution like the others rather than anybody's transcription.
        commonest: commonestBars (bucket.bars, bucket.barCount),
        steps: lengthRows (bucket.lengthSteps)
      } : undefined
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
      `${String (bucket.notes).padStart (8)} notes  repeat ${(bucket.intervals['0'] * 100).toFixed (1)}%` +
      (bucket.rhythm ? `  ${String (bucket.rhythm.bars).padStart (6)} bars  ` +
        `even ${(bucket.rhythm.even * 100).toFixed (1)}%  ` +
        `commonest ${bucket.rhythm.commonest[0][0].join ('\u00b7')}` : ''));
  }

}
