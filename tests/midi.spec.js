import { test, expect } from '@playwright/test';
import { scoreToMidi, midiFilename } from '../src/midi.js';
import { composeTrack } from '../src/composition.js';
import { PROGRESSIONS } from '../src/theory.js';
import { createTrackMaterialPicker } from '../src/track-material.js';
import { titleAt } from '../src/track-names.js';

function scoreFor (meter = '4/4') {
  const material = createTrackMaterialPicker ({ storage: null }) ({ seed: 7 });
  const title = titleAt (3);
  return composeTrack ({
    version: 1, seed: 99, materialSeed: material.materialSeed,
    motifA: material.motifA, motifB: material.motifB,
    title: title.title, titleEnglish: title.titleEnglish, titleLanguage: title.titleLanguage,
    rootMidi: 48, scale: 'dorian',
    structure: { style: 'traditional', opening: 'full', meter, chordHold: 2,
      sections: ['A', 'A', 'B', 'B'] },
    progression: PROGRESSIONS.dorian[0], turns: 3, turnsSinceEnding: 0,
    arc: { shape: 'swell', length: 8, turn: 0 }, arcDepth: 0.5, tempoUser: 80, tempoOffset: 0,
    user: { density: 0.5, counter: 0.55, ornament: 0.6, drone: 0.14, dust: 0.3,
      support: 0.5, swing: 0.28 },
    variation: {}, voices: { lead: 'harp', keys: 'felt', bass: 'round' },
    auto: { lead: true, keys: true, bass: true },
    voiceOptions: { lead: ['harp'], keys: ['felt'], bass: ['round'] }
  });
}

/** A reader written independently of the writer, so a shared assumption
    cannot make a broken file look correct. */
function readMidi (bytes) {
  let at = 0;
  const u32 = () => (bytes[at++] << 24) | (bytes[at++] << 16) | (bytes[at++] << 8) | bytes[at++];
  const u16 = () => (bytes[at++] << 8) | bytes[at++];
  const tag = () => String.fromCharCode (bytes[at++], bytes[at++], bytes[at++], bytes[at++]);

  expect (tag()).toBe ('MThd');
  u32();
  const format = u16(), trackCount = u16(), ppq = u16();
  const notes = [], tempos = [];
  let timeSig = null, stuck = 0;

  for (let t = 0; t < trackCount; t++) {
    expect (tag()).toBe ('MTrk');
    // Two statements deliberately: `at + u32()` reads `at` before u32 advances
    // it, so every track would end four bytes early.
    const length = u32();
    const end = at + length;
    let time = 0, running = null;
    const open = new Map();

    while (at < end) {
      let delta = 0, byte;
      do { byte = bytes[at++]; delta = (delta << 7) | (byte & 0x7F); } while (byte & 0x80);
      time += delta;

      let status = bytes[at];
      if (status & 0x80) at++; else status = running;
      running = status;

      if (status === 0xFF) {
        const meta = bytes[at++];
        let length = 0, byte2;
        do { byte2 = bytes[at++]; length = (length << 7) | (byte2 & 0x7F); } while (byte2 & 0x80);
        const data = bytes.slice (at, at + length);
        at += length;
        if (meta === 0x51) tempos.push (Math.round (60000000 / ((data[0] << 16) | (data[1] << 8) | data[2])));
        if (meta === 0x58) timeSig = { numerator: data[0], denominator: 2 ** data[1] };
      } else if ((status & 0xF0) === 0x90 || (status & 0xF0) === 0x80) {
        const pitch = bytes[at++], velocity = bytes[at++];
        const key = `${status & 0x0F}:${pitch}`;
        if ((status & 0xF0) === 0x90 && velocity > 0) open.set (key, { start: time, pitch, velocity, channel: status & 0x0F });
        else {
          const note = open.get (key);
          if (note) { notes.push ({ ...note, duration: time - note.start }); open.delete (key); }
        }
      } else if ((status & 0xF0) === 0xC0) at += 1;
      else at += 2;
    }
    stuck += open.size;
    at = end;
  }
  return { format, trackCount, ppq, notes, tempos, timeSig, stuck };
}

test ('every note in the score survives the trip to MIDI', () => {
  const score = scoreFor();
  const written = score.bars.flatMap (bar => bar.notes).filter (note => note.role !== 'vinyl');
  const file = readMidi (scoreToMidi (score));

  expect (file.notes).toHaveLength (written.length);
  expect (written.length).toBeGreaterThan (500);
  // A note left open is a stuck note, which is what a DAW shows when two of
  // the same pitch overlap on one channel.
  expect (file.stuck).toBe (0);
  expect (file.notes.every (note => note.duration > 0)).toBe (true);
});

test ('the file says what it is', () => {
  const file = readMidi (scoreToMidi (scoreFor()));
  expect (file.format).toBe (1);
  expect (file.ppq).toBe (480);
  // Format 1 means separable parts, so the voices must not all be on one track.
  expect (file.trackCount).toBeGreaterThan (3);
  expect (file.tempos[0]).toBe (80);
});

test ('a jig is written as a jig', () => {
  // The numerator is the meter's own. Using the bar's length in eighths would
  // write common time as 8/4.
  expect (readMidi (scoreToMidi (scoreFor ('4/4'))).timeSig).toEqual ({ numerator: 4, denominator: 4 });
  expect (readMidi (scoreToMidi (scoreFor ('6/8'))).timeSig).toEqual ({ numerator: 6, denominator: 8 });
});

test ('drums go where drums go, and the surface noise does not travel', () => {
  const score = scoreFor();
  const file = readMidi (scoreToMidi (score));

  // Channel 10, one-indexed, is percussion in General MIDI.
  const drums = file.notes.filter (note => note.channel === 9);
  expect (drums.length).toBeGreaterThan (50);
  // Unpitched roles have no note of their own and take the percussion map.
  expect (new Set (drums.map (note => note.pitch))).toEqual (new Set ([36, 38, 42]));

  const pitched = file.notes.filter (note => note.channel !== 9);
  expect (pitched.every (note => note.pitch >= 12 && note.pitch <= 108)).toBe (true);
});

test ('the filename is safe to save anywhere', () => {
  expect (midiFilename ('Cois farraige')).toBe ('Cois-farraige.mid');
  expect (midiFilename ("a jumper on the radiator")).toBe ('a-jumper-on-the-radiator.mid');
  // Nearly half the titles are Irish, and "Scéal" saving as Sc-al.mid is a
  // poor way to treat them.
  expect (midiFilename ('Scéal')).toBe ('Sceal.mid');
  expect (midiFilename ('Solas na gealaí')).toBe ('Solas-na-gealai.mid');
  expect (midiFilename ('Tráthnóna fada')).toBe ('Trathnona-fada.mid');
  expect (midiFilename ('')).toBe ('lofi-ceoil.mid');
  expect (midiFilename (undefined)).toBe ('lofi-ceoil.mid');
});
