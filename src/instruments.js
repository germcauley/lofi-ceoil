// Synthesised and sampled voices, each with explicit ownership of its nodes.

import * as Tone from 'tone';

/** PluckSynth is Karplus-Strong: a single noise burst into a delay line. That
    noise source keeps a state timeline, and it throws outright if a trigger
    lands at or before the previous one — "The time must be greater than or
    equal to the last scheduled time".

    Two notes an instant apart is not exotic here: the counter line, a grace
    note, or a voice swap mid-bar can all produce it, which is why this
    surfaced as an intermittent failure that would not reproduce on demand.

    So every trigger is nudged to sit strictly after the last one. A note moved
    by a millisecond is inaudible; a bar that throws is not. */
function monotonic (voice) {
  const original = voice.triggerAttackRelease.bind (voice);
  let last = -Infinity;

  voice.triggerAttackRelease = (note, duration, time, velocity) => {
    const requested = time ?? Tone.now();
    const safe = requested > last ? requested : last + 0.001;

    last = safe;
    return original (note, duration, safe, velocity);
  };

  return voice;
}

function instrument (voice, ...effects) {
  return {
    voice,
    output: effects.at (-1) ?? voice,
    dispose () { [voice, ...effects].forEach (node => node.dispose()); }
  };
}

const SAMPLE_MAPS = {
  guitar: {
    A2: 'A2.mp3', E3: 'E3.mp3', A3: 'A3.mp3', 'C#4': 'Cs4.mp3', E4: 'E4.mp3',
    'G#4': 'Gs4.mp3', B4: 'B4.mp3', D5: 'D5.mp3', 'F#5': 'Fs5.mp3', A5: 'A5.mp3'
  },
  piano: {
    C3: 'C3.mp3', 'F#3': 'Fs3.mp3',
    C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3', A4: 'A4.mp3',
    C5: 'C5.mp3', 'F#5': 'Fs5.mp3', C6: 'C6.mp3'
  },
  recorder: {
    C4: 'C4.mp3', E4: 'E4.mp3', 'G#4': 'Gs4.mp3',
    C5: 'C5.mp3', E5: 'E5.mp3', C6: 'C6.mp3'
  },
  harp: {
    C4: 'C4.mp3', E4: 'E4.mp3', 'G#4': 'Gs4.mp3',
    C5: 'C5.mp3', E5: 'E5.mp3', 'G#5': 'Gs5.mp3', C6: 'C6.mp3'
  },
  vibraphone: { A5: 'A5.mp3', B4: 'B4.mp3', C4: 'C4.mp3', C6: 'C6.mp3', D5: 'D5.mp3', E4: 'E4.mp3', F5: 'F5.mp3', G4: 'G4.mp3' },
  kalimba: { 'A#4': 'As4.mp3', 'A#5': 'As5.mp3', 'C#4': 'Cs4.mp3', 'C#5': 'Cs5.mp3', 'C#6': 'Cs6.mp3', F4: 'F4.mp3', F5: 'F5.mp3' },
  glockenspiel: { C6: 'C6.mp3', C7: 'C7.mp3', C8: 'C8.mp3', G5: 'G5.mp3', G6: 'G6.mp3', G7: 'G7.mp3' },
  marimba: { B5: 'B5.mp3', C5: 'C5.mp3', F4: 'F4.mp3', F6: 'F6.mp3', G3: 'G3.mp3', G5: 'G5.mp3' }
};

// Cache decoded AudioBuffers, not voices: a skip needs fresh scheduling
// timelines, but should never download or decode the same sample again.
const sampleBuffers = new Map();
const sampleLoads = new Map();
function loadSamples (folder) {
  if (! sampleLoads.has (folder)) {
    const loading = Promise.all (Object.entries (SAMPLE_MAPS[folder]).map (async ([note, file]) => {
      const buffer = await Tone.ToneAudioBuffer.fromUrl (`${import.meta.env.BASE_URL}samples/${folder}/${file}`);
      const audio = buffer.get();
      buffer.dispose();
      return [note, audio];
    })).then (entries => {
      const buffers = Object.fromEntries (entries);
      sampleBuffers.set (folder, buffers);
      return buffers;
    }).catch (error => {
      sampleLoads.delete (folder);
      throw error;
    });
    sampleLoads.set (folder, loading);
  }
  return sampleLoads.get (folder);
}

// Warm the local library before playback so any voice
// can be chosen for the next track without delaying a skip.
export function preloadSamples () {
  return Promise.all (Object.keys (SAMPLE_MAPS).map (loadSamples));
}

/** Builds a sampled voice from a folder under public/samples.

    VCSL names its files an octave below scientific pitch — their C4 measures
    522 Hz, which is MIDI 72 — so the mapping here is always written in the
    Tone note each sample actually sounds, not the name it shipped with.

    Filenames use `s` rather than `#` for sharps. In a URL a `#` begins the
    fragment, so `G#4.mp3` requests `G` and the sample never arrives — silently,
    because the sampler simply has no buffer for that note. */
function sampled (folder, { volume = -10, release = 1.2, cutoff = 6000 } = {}) {
  const cached = sampleBuffers.get (folder);
  const voice = new Tone.Sampler ({ urls: cached ?? {}, release, volume });
  const tone = new Tone.Filter ({ type: 'lowpass', frequency: cutoff, rolloff: -12 });
  voice.connect (tone);
  const result = instrument (voice, tone);
  if (! cached) {
    result.ready = loadSamples (folder).then (buffers => {
      if (! voice.disposed) {
        Object.entries (buffers).forEach (([note, buffer]) => voice.add (note, buffer));
      }
    });
    // The engine reports errors when a requested voice/start awaits readiness.
    result.ready.catch (() => {});
  }
  return result;
}

// ------------------------------------------------------------------- keys

/** Electric-piano-ish. FM with a low modulation index gets close to a Rhodes:
    a bell-like attack over a sine body. Chorus keeps it from sitting perfectly
    still, which is most of what separates it from a plain FM patch. */
function rhodes () {
  const voice = new Tone.PolySynth (Tone.FMSynth, {
    maxPolyphony: 12,
    harmonicity: 2,
    modulationIndex: 2.6,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.018, decay: 1.8, sustain: 0.22, release: 2.8 },
    modulation: { type: 'sine' },
    modulationEnvelope: { attack: 0.006, decay: 0.4, sustain: 0.06, release: 0.8 },
    volume: -15
  });

  const chorus = new Tone.Chorus ({ frequency: 0.6, delayTime: 3.5, depth: 0.5, wet: 0.35 }).start();
  const tone = new Tone.Filter ({ type: 'lowpass', frequency: 3200, rolloff: -12 });

  voice.connect (chorus);
  chorus.connect (tone);

  return instrument (voice, chorus, tone);
}

/** Felt piano: hammers muted with cloth. A soft triangle body under a short
    filtered noise thump for the hammer, heavily rolled off. */
function felt () {
  const voice = new Tone.PolySynth (Tone.Synth, {
    maxPolyphony: 12,
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.03, decay: 2.4, sustain: 0.08, release: 2.6 },
    volume: -13
  });

  const tone = new Tone.Filter ({ type: 'lowpass', frequency: 1500, rolloff: -24 });
  const chorus = new Tone.Chorus ({ frequency: 0.35, delayTime: 5, depth: 0.35, wet: 0.25 }).start();

  voice.connect (tone);
  tone.connect (chorus);

  return instrument (voice, tone, chorus);
}

/** Slow strings. Detuned saws with a long swell — barely an attack at all, so
    it sits behind everything as harmony rather than as a part. */
function pad () {
  const voice = new Tone.PolySynth (Tone.Synth, {
    maxPolyphony: 12,
    oscillator: { type: 'fatsawtooth', count: 3, spread: 22 },
    envelope: { attack: 0.7, decay: 1.4, sustain: 0.5, release: 2.6 },
    volume: -22
  });

  const tone = new Tone.Filter ({ type: 'lowpass', frequency: 1100, rolloff: -24 });
  voice.connect (tone);

  return instrument (voice, tone);
}

/** The same Salamander piano the lead can use, voiced for chords: quieter, and
    rolled off further so a four-note voicing does not crowd the melody. */
function pianoKeys () {
  return sampled ('piano', { volume: -16, release: 1.4, cutoff: 3400 });
}

/** Nylon guitar, voiced lower in the mix for chords and arpeggios. */
function guitarKeys () {
  return sampled ('guitar', { volume: -16, release: 0.65, cutoff: 4200 });
}

function guitar () {
  return sampled ('guitar', { volume: -10, release: 0.8, cutoff: 5600 });
}

export const KEYS_VOICES = { rhodes, felt, piano: pianoKeys, guitar: guitarKeys, pad };

// ------------------------------------------------------------------- lead



/** Baroque soprano recorder, standing in for a tin whistle — the nearest thing
    in a CC0 library, and the same family of edge-blown pipe.

    A recorder sounds an octave above where the tune is written, and VCSL names
    an octave low; the two cancel, so each file is filed under the note it is
    named after and the voice transposes up for free. */
function whistleSampled () {
  return sampled ('recorder', { volume: -12, release: 0.6, cutoff: 5200 });
}

/** Vibraphone, soft mallets. The signature lofi mallet sound, and the reason
    to reach for samples rather than synthesis: the metal bar's shimmer and the
    long unforced decay are not things an oscillator arrives at. */
function vibraphone () {
  return sampled ('vibraphone', { volume: -10, release: 1.6, cutoff: 6200 });
}

/** Marimba. Wooden and dry where the vibraphone is metallic and ringing, so
    the two do not compete for the same job. */
function marimba () {
  return sampled ('marimba', { volume: -10, release: 0.9, cutoff: 5400 });
}

/** Kalimba. A thumb piano: plucked metal tines, warm and slightly detuned by
    nature. One of the most recognisable lofi timbres, and it replaces the
    recorder, which was only ever a stand-in for a whistle nobody sampled. */
function kalimba () {
  return sampled ('kalimba', { volume: -10, release: 1.1, cutoff: 6000 });
}

/** Glockenspiel, soft mallets — the supporting voice.

    Its lowest sample already sounds well above where the tune sits, so it can
    only ever decorate. That is the point: it is not a second melody, it is a
    highlight on the first. */
function glockenspiel () {
  return sampled ('glockenspiel', { volume: -14, release: 1.8, cutoff: 8000 });
}

/** A real folk harp — the instrument this music actually belongs to. */
function harpSampled () {
  return sampled ('harp', { volume: -10, release: 1.4, cutoff: 6500 });
}

/** Plucked, like a harp or a nylon-strung guitar. Karplus-Strong, so the decay
    is a physical model rather than an envelope.

    Kept alongside the sampled harp rather than replaced by it: its retro
    character is a different instrument, not a worse one. */
function harpSynth () {
  const voice = monotonic (new Tone.PluckSynth ({
    attackNoise: 0.6,
    dampening: 3200,
    resonance: 0.94,
    release: 1.1,
    volume: -5
  }));

  return instrument (voice);
}

/** Real piano, from the Salamander Grand Piano set that Tone.js itself uses.
    Nine samples across three octaves, pitch-shifted between — synthesis got as
    close to a piano as FM usefully can, and a struck string with its own
    resonance and release noise is not something an oscillator reaches.

    The samples are vendored rather than fetched from someone else's host, and
    cached before playback so a new track can use them immediately. */
function piano () {
  return sampled ('piano', { volume: -10, release: 1.2, cutoff: 5200 });
}

// The two synthesised acoustic imitations — a sawtooth fiddle and a sine
// whistle — are gone. Both were the wrong side of the line samples drew: an
// oscillator can suggest a struck or plucked string, but a bowed or blown one
// gives itself away immediately.
export const LEAD_VOICES = {
  guitar,
  vibraphone,
  marimba,
  kalimba,
  piano,
  harp: harpSampled,
  'harp (synth)': harpSynth
};

/** Voices for the supporting line. Anything that can decorate without
    competing — bright, short, and happy to sit above the tune. */
export const SUPPORT_VOICES = { glockenspiel, vibraphone, kalimba, marimba };

// ------------------------------------------------------------------ others

// ------------------------------------------------------------------- bass
//
// The low end had seven patterns and one timbre. The patterns changed how it
// moves; these change what it is, and the bass is doing more work than any
// other single part.

/** Soft round bass. Triangle plus a touch of sub, through its own filter so it
    stays under the keys instead of fighting them. */
function bassRound () {
  const voice = new Tone.MonoSynth ({
    oscillator: { type: 'triangle' },
    filter: { Q: 1, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.028, decay: 0.35, sustain: 0.72, release: 1.1 },
    filterEnvelope: {
      attack: 0.02, decay: 0.25, sustain: 0.35, release: 0.9,
      baseFrequency: 75, octaves: 2
    },
    volume: -15
  });

  return instrument (voice);
}

/** Upright, pizzicato. The lofi default. A fast filter sweep gives the finger
    against the string, and almost no sustain gives the short woody decay of a
    plucked double bass. */
function bassUpright () {
  const voice = new Tone.MonoSynth ({
    oscillator: { type: 'triangle' },
    filter: { Q: 1.4, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.006, decay: 0.5, sustain: 0.06, release: 0.5 },
    filterEnvelope: {
      attack: 0.004, decay: 0.14, sustain: 0.08, release: 0.3,
      baseFrequency: 90, octaves: 3.2
    },
    volume: -13
  });

  return instrument (voice);
}

/** Sub. Near a pure sine, felt more than heard. Sits well under the sparse and
    held patterns, badly under the busy ones. */
function bassSub () {
  const voice = new Tone.MonoSynth ({
    oscillator: { type: 'sine' },
    filter: { Q: 0.6, type: 'lowpass', rolloff: -12 },
    envelope: { attack: 0.06, decay: 0.3, sustain: 0.85, release: 1.4 },
    filterEnvelope: {
      attack: 0.05, decay: 0.3, sustain: 0.6, release: 1,
      baseFrequency: 60, octaves: 1.2
    },
    // A sine in the bottom octave carries far more energy than its number
    // suggests, so the sub sits lowest of the four rather than highest.
    volume: -17
  });

  return instrument (voice);
}

/** Fingered electric. More sustain than the upright and a brighter edge, so it
    carries through a busier arrangement. */
function bassElectric () {
  const voice = new Tone.MonoSynth ({
    oscillator: { type: 'sawtooth' },
    filter: { Q: 2, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.01, decay: 0.4, sustain: 0.45, release: 0.8 },
    filterEnvelope: {
      attack: 0.008, decay: 0.22, sustain: 0.2, release: 0.6,
      baseFrequency: 110, octaves: 2.6
    },
    volume: -16
  });

  return instrument (voice);
}

export const BASS_VOICES = {
  round: bassRound,
  upright: bassUpright,
  sub: bassSub,
  electric: bassElectric
};

/** The counter line's voice: a pluck, distinct from whichever lead is chosen. */
export function createPluck () {
  const voice = monotonic (new Tone.PluckSynth ({
    attackNoise: 0.7,
    dampening: 2600,
    resonance: 0.93,
    release: 0.9,
    volume: -17
  }));

  return instrument (voice);
}

export function createDrums () {
  const kick = new Tone.MembraneSynth ({
    pitchDecay: 0.05,
    octaves: 4,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.42, sustain: 0.01, release: 1.2 },
    volume: -6
  });

  const snare = new Tone.NoiseSynth ({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
    volume: -16
  });

  const snareFilter = new Tone.Filter ({ type: 'bandpass', frequency: 1900, Q: 0.8 });
  snare.connect (snareFilter);

  // Ghost notes get their own voice. NoiseSynth wraps a single noise source,
  // so sharing one with the backbeat means a ghost landing next to a snare hit
  // fights it for the voice.
  const ghost = new Tone.NoiseSynth ({
    noise: { type: 'pink' },
    envelope: { attack: 0.001, decay: 0.09, sustain: 0 },
    volume: -26
  });

  const ghostFilter = new Tone.Filter ({ type: 'bandpass', frequency: 1400, Q: 1.2 });
  ghost.connect (ghostFilter);

  const hat = new Tone.NoiseSynth ({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.045, sustain: 0 },
    volume: -30
  });

  const hatFilter = new Tone.Filter ({ type: 'highpass', frequency: 7000 });
  hat.connect (hatFilter);

  return {
    kick, snare, ghost, hat, outputs: [kick, snareFilter, ghostFilter, hatFilter],
    dispose () {
      [kick, snare, ghost, hat, snareFilter, ghostFilter, hatFilter].forEach (node => node.dispose());
    }
  };
}

/** A pipe-like drone. Sawtooth through a low filter with a slow attack, so it
    swells rather than starts. Monophonic is right here — a drone is one note. */
export function createDrone () {
  const voice = new Tone.MonoSynth ({
    oscillator: { type: 'sawtooth' },
    filter: { type: 'lowpass', rolloff: -24, Q: 2 },
    envelope: { attack: 0.9, decay: 0.4, sustain: 0.85, release: 1.8 },
    filterEnvelope: {
      attack: 1.2, decay: 0.6, sustain: 0.5, release: 1.5,
      baseFrequency: 160, octaves: 1.8
    },
    // A sustained sawtooth is present out of all proportion to its level:
    // it never stops, so it never stops being noticed.
    volume: -34
  });

  return instrument (voice);
}

/** The record surface.

    Four parts, because real surface noise is not one sound. A continuous
    **hiss** bed; a dense carpet of small **crackle** ticks, which is what
    actually reads as vinyl; larger, duller **pops** from deeper damage; and a
    rare **scuff** — the one that makes you look at the record.

    Ticks and pops get their own voices. NoiseSynth wraps a single noise source
    and rejects a trigger at or before the last one, so sharing a voice between
    a dense carpet and occasional larger events would throw constantly. */
export function createVinyl () {
  // Wider than before. Surface noise highpassed at 1.4 kHz is a hiss; real
  // noise has body underneath it.
  const hiss = new Tone.Noise ({ type: 'pink', volume: -26 });
  const hissFilter = new Tone.Filter ({ type: 'highpass', frequency: 700 });
  hiss.connect (hissFilter);

  // The carpet: many small ticks, individually almost inaudible.
  const crackle = new Tone.NoiseSynth ({
    noise: { type: 'white' },
    envelope: { attack: 0.0004, decay: 0.008, sustain: 0 },
    volume: -12
  });

  const crackleFilter = new Tone.Filter ({ type: 'bandpass', frequency: 4200, Q: 1.1 });
  crackle.connect (crackleFilter);

  // Bigger and duller, from deeper damage.
  const pops = new Tone.NoiseSynth ({
    noise: { type: 'brown' },
    envelope: { attack: 0.0006, decay: 0.035, sustain: 0 },
    volume: -5
  });

  const popFilter = new Tone.Filter ({ type: 'bandpass', frequency: 1300, Q: 0.9 });
  pops.connect (popFilter);

  // The rare one you notice.
  const scuff = new Tone.NoiseSynth ({
    noise: { type: 'brown' },
    envelope: { attack: 0.001, decay: 0.09, sustain: 0 },
    volume: -3
  });

  const scuffFilter = new Tone.Filter ({ type: 'lowpass', frequency: 900, rolloff: -12 });
  scuff.connect (scuffFilter);

  const level = new Tone.Gain (0);
  [hissFilter, crackleFilter, popFilter, scuffFilter].forEach (node => node.connect (level));

  return {
    hiss, crackle, pops, scuff, level,
    dispose () {
      [hiss, crackle, pops, scuff, hissFilter, crackleFilter, popFilter, scuffFilter, level]
        .forEach (node => node.dispose());
    }
  };
}
