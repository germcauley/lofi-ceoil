// A score as a MIDI file.
//
// This is the cheapest useful thing the composition layer can produce, because
// a score is already what MIDI wants: a note is `{ role, midi, at, duration,
// velocity }` with times in quarter-note beats, and that is very nearly the
// format itself. No library — the file is a few hundred bytes of header and a
// run of events, and writing it by hand avoids a dependency for something this
// small.
//
// MIDI is the more useful export of the two. A WAV is a recording of one
// performance on these samples; a MIDI file is the tune, and it can be opened,
// re-voiced, edited and finished somewhere else.

import { meterInfo } from './musical-meter.js';

const TICKS = 480;                       // per quarter note, the usual choice
const DRUM_CHANNEL = 9;                  // channel 10, one-indexed

// Which channel each voice plays on, and roughly what it should sound like
// when the file is opened somewhere that knows nothing about this project.
const PARTS = {
  lead:    { channel: 0, name: 'lead' },
  support: { channel: 1, name: 'support' },
  keys:    { channel: 2, name: 'keys' },
  bass:    { channel: 3, name: 'bass' },
  drone:   { channel: 4, name: 'drone' },
  pluck:   { channel: 5, name: 'counter' }
};

// General MIDI programs for the voices this project actually has. A rhodes is
// not a harp, and a file that opens sounding roughly right is worth the table.
const PROGRAMS = {
  vibraphone: 11, marimba: 12, kalimba: 108, glockenspiel: 9,
  piano: 0, harp: 46, 'harp (synth)': 46, guitar: 24,
  rhodes: 4, felt: 0, pad: 89,
  round: 33, upright: 32, sub: 38, electric: 33
};

// Unpitched roles have no note number of their own, so they take the General
// MIDI percussion map.
const DRUMS = { kick: 36, snare: 38, ghost: 38, hat: 42 };

const bytes = value => Array.isArray (value) ? value : [value];

/** MIDI's variable-length quantity: seven bits at a time, high bit set on
    every byte but the last. */
function varLength (value) {
  const out = [value & 0x7F];
  value >>= 7;
  while (value > 0) {
    out.unshift ((value & 0x7F) | 0x80);
    value >>= 7;
  }
  return out;
}

const u16 = value => [(value >> 8) & 0xFF, value & 0xFF];
const u32 = value => [(value >> 24) & 0xFF, (value >> 16) & 0xFF, (value >> 8) & 0xFF, value & 0xFF];

const chunk = (tag, data) => [...tag.split ('').map (c => c.charCodeAt (0)), ...u32 (data.length), ...data];

/** Absolute-time events to a track chunk. */
function track (events) {
  events.sort ((a, b) => a.at - b.at || a.order - b.order);
  const data = [];
  let previous = 0;
  for (const event of events) {
    data.push (...varLength (Math.max (0, Math.round (event.at) - previous)), ...bytes (event.data));
    previous = Math.round (event.at);
  }
  data.push (...varLength (0), 0xFF, 0x2F, 0x00);       // end of track
  return chunk ('MTrk', data);
}

const text = (type, value) => {
  const encoded = [...new TextEncoder().encode (value)].slice (0, 127);
  return [0xFF, type, encoded.length, ...encoded];
};

/** A composed score as a standard MIDI file.

    Format 1: a tempo track, then one track per voice, which is what a DAW
    expects and what lets the parts be separated once they arrive. */
export function scoreToMidi (score) {
  const beatsPerBar = score.beatsPerBar ?? 4;
  const meter = score.recipe?.structure?.meter ?? '4/4';
  const { eighths } = meterInfo (meter);

  // The conductor track: what it is called, what time it is in, how fast.
  const conductor = [];
  conductor.push ({ at: 0, order: 0, data: text (0x03, score.recipe?.title ?? 'Lofi Ceoil') });
  // The numerator is the meter's own, not the bar's length in eighths — a 4/4
  // bar holds eight of those and would be written as 8/4.
  const [numerator, denominator] = meter.split ('/').map (Number);
  conductor.push ({ at: 0, order: 1,
    // The denominator is a power of two written as its exponent: 8 is 3, 4 is 2.
    data: [0xFF, 0x58, 0x04, numerator, Math.log2 (denominator), 24, 8] });

  // Tempo can move between turns, so the map follows it rather than being
  // written once from the recipe.
  let lastTempo = null;
  for (const bar of score.bars) {
    const tempo = bar.settings?.tempo;
    if (! tempo || tempo === lastTempo) continue;
    const microseconds = Math.round (60000000 / tempo);
    conductor.push ({ at: bar.index * beatsPerBar * TICKS, order: 2,
      data: [0xFF, 0x51, 0x03, (microseconds >> 16) & 0xFF, (microseconds >> 8) & 0xFF, microseconds & 0xFF] });
    lastTempo = tempo;
  }

  const tracks = new Map();
  const trackFor = role => {
    const part = PARTS[role];
    const key = part ? role : 'drums';
    if (! tracks.has (key)) {
      const events = [];
      const channel = part ? part.channel : DRUM_CHANNEL;
      events.push ({ at: 0, order: 0, data: text (0x03, part ? part.name : 'drums') });
      if (part) {
        const voice = score.recipe?.voices?.[role === 'pluck' ? 'lead' : role];
        events.push ({ at: 0, order: 1, data: [0xC0 | channel, PROGRAMS[voice] ?? 0] });
      }
      tracks.set (key, { channel, events });
    }
    return tracks.get (key);
  };

  // Gathered first rather than written straight out, because two notes of the
  // same pitch overlapping on one channel is ambiguous in MIDI: the note-off
  // closes whichever the reader thinks is open, and the other hangs. Editors
  // show that as a stuck note. Collecting them lets the earlier one be clipped.
  const pending = new Map();
  for (const bar of score.bars) {
    const barAt = bar.index * beatsPerBar * TICKS;
    for (const note of bar.notes) {
      // Surface noise is not music and has no place in a score anyone edits.
      if (note.role === 'vinyl') continue;

      // The percussion map wins for drum roles. The kick is played here by a
      // pitched synth and carries a note of its own — 24, well below General
      // MIDI's percussion range — which would land on channel 10 as silence.
      // That pitch is a synthesis detail, not a note anybody wrote.
      const pitch = DRUMS[note.role] ?? note.midi;
      if (pitch === undefined || pitch === null) continue;

      const part = trackFor (note.role);
      const key = note.role in PARTS ? note.role : 'drums';
      const start = Math.round (barAt + note.at * TICKS);
      const list = pending.get (key) ?? [];
      list.push ({
        pitch: pitch & 0x7F,
        start,
        // At least one tick: a zero-length note is inaudible, and some editors
        // treat it as never having ended.
        end: Math.max (start + 1, Math.round (barAt + (note.at + note.duration) * TICKS)),
        velocity: Math.max (1, Math.min (127, Math.round ((note.velocity ?? 0.6) * 127))),
        channel: part.channel
      });
      pending.set (key, list);
    }
  }

  for (const [key, notes] of pending) {
    const { events } = tracks.get (key);
    const byPitch = new Map();
    for (const note of notes) {
      const list = byPitch.get (note.pitch) ?? [];
      list.push (note);
      byPitch.set (note.pitch, list);
    }

    for (const list of byPitch.values()) {
      list.sort ((a, b) => a.start - b.start);
      for (let i = 0; i < list.length - 1; i++) {
        // End the earlier note just before the next begins, so the pair is
        // never open at once. A note left with no room at all is dropped.
        if (list[i].end > list[i + 1].start) list[i].end = list[i + 1].start - 1;
      }
      for (const note of list) {
        if (note.end <= note.start) continue;
        events.push ({ at: note.start, order: 1,
          data: [0x90 | note.channel, note.pitch, note.velocity] });
        events.push ({ at: note.end, order: 0,
          data: [0x80 | note.channel, note.pitch, 0x40] });
      }
    }
  }

  const chunks = [track (conductor), ...[...tracks.values()].map (part => track (part.events))];
  const header = chunk ('MThd', [...u16 (1), ...u16 (chunks.length), ...u16 (TICKS)]);

  return Uint8Array.from ([...header, ...chunks.flat()]);
}

/** A filename that survives being saved on any system.

    Accents are folded rather than replaced, because nearly half the titles are
    in Irish and "Scéal" saving itself as `Sc-al.mid` is a poor way to treat
    them. Decomposing first turns é into e plus a combining mark, and dropping
    the marks leaves the letter. */
export const midiFilename = title => {
  const folded = (title ?? '')
    .normalize ('NFD')
    .replace (/[\u0300-\u036f]/g, '')
    .replace (/[^a-z0-9]+/gi, '-')
    .replace (/^-|-$/g, '');
  return `${folded || 'lofi-ceoil'}.mid`;
};
