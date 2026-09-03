// Synthesised and sampled voices, each with explicit ownership of its nodes.

import * as Tone from 'tone';

function instrument (voice, ...effects) {
  return {
    voice,
    output: effects.at (-1) ?? voice,
    dispose () { [voice, ...effects].forEach (node => node.dispose()); }
  };
}

const SAMPLE_MAPS = {
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
  }
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

// The complete library is about 1 MB. Warm it before playback so any voice
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

export const KEYS_VOICES = { rhodes, felt, piano: pianoKeys, pad };

// ------------------------------------------------------------------- lead

/** Tin whistle. Nearly a pure sine with a breath transient and a little
    vibrato — the vibrato is what stops it reading as a test tone. */
function whistle () {
  const voice = new Tone.Synth ({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.045, decay: 0.3, sustain: 0.55, release: 0.7 },
    volume: -16
  });

  const breath = new Tone.Vibrato ({ frequency: 5.2, depth: 0.06, type: 'sine' });
  const tone = new Tone.Filter ({ type: 'lowpass', frequency: 3400, rolloff: -12 });

  voice.connect (breath);
  breath.connect (tone);

  return instrument (voice, breath, tone);
}

/** Fiddle. A filtered saw with a slower, bowed attack and heavier vibrato. */
function fiddle () {
  const voice = new Tone.Synth ({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.08, decay: 0.35, sustain: 0.6, release: 0.9 },
    volume: -22
  });

  const vibrato = new Tone.Vibrato ({ frequency: 5.8, depth: 0.1, type: 'sine' });
  const tone = new Tone.Filter ({ type: 'lowpass', frequency: 2200, rolloff: -24, Q: 1.6 });

  voice.connect (vibrato);
  vibrato.connect (tone);

  return instrument (voice, vibrato, tone);
}

/** Baroque soprano recorder, standing in for a tin whistle — the nearest thing
    in a CC0 library, and the same family of edge-blown pipe.

    A recorder sounds an octave above where the tune is written, and VCSL names
    an octave low; the two cancel, so each file is filed under the note it is
    named after and the voice transposes up for free. */
function whistleSampled () {
  return sampled ('recorder', { volume: -14, release: 0.6, cutoff: 5200 });
}

/** A real folk harp — the instrument this music actually belongs to. */
function harpSampled () {
  return sampled ('harp', { volume: -8, release: 1.4, cutoff: 6500 });
}

/** Plucked, like a harp or a nylon-strung guitar. Karplus-Strong, so the decay
    is a physical model rather than an envelope.

    Kept alongside the sampled harp rather than replaced by it: its retro
    character is a different instrument, not a worse one. */
function harpSynth () {
  const voice = new Tone.PluckSynth ({
    attackNoise: 0.6,
    dampening: 3200,
    resonance: 0.94,
    release: 1.1,
    volume: -12
  });

  return instrument (voice);
}

/** Real piano, from the Salamander Grand Piano set that Tone.js itself uses.
    Nine samples across three octaves, pitch-shifted between — synthesis got as
    close to a piano as FM usefully can, and a struck string with its own
    resonance and release noise is not something an oscillator reaches.

    The samples are vendored rather than fetched from someone else's host, and
    cached before playback so a new track can use them immediately. */
function piano () {
  return sampled ('piano', { volume: -9, release: 1.2, cutoff: 5200 });
}

export const LEAD_VOICES = {
  whistle: whistleSampled,
  'whistle (synth)': whistle,
  fiddle,
  piano,
  harp: harpSampled,
  'harp (synth)': harpSynth
};

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
    volume: -11
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
    volume: -9
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
    volume: -7
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
    volume: -13
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
  const voice = new Tone.PluckSynth ({
    attackNoise: 0.7,
    dampening: 2600,
    resonance: 0.93,
    release: 0.9,
    volume: -17
  });

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
    volume: -26
  });

  return instrument (voice);
}

/** The crackle bed: continuous surface noise plus occasional pops, the way a
    worn record behaves. Runs outside the sidechain so it never pumps. */
export function createVinyl () {
  const hiss = new Tone.Noise ({ type: 'pink', volume: -34 });
  const hissFilter = new Tone.Filter ({ type: 'highpass', frequency: 1400 });
  hiss.connect (hissFilter);

  const pops = new Tone.NoiseSynth ({
    noise: { type: 'white' },
    envelope: { attack: 0.0005, decay: 0.02, sustain: 0 },
    volume: -22
  });

  const popFilter = new Tone.Filter ({ type: 'bandpass', frequency: 2600, Q: 1.4 });
  pops.connect (popFilter);

  const level = new Tone.Gain (0.6);
  hissFilter.connect (level);
  popFilter.connect (level);

  return {
    hiss, pops, level,
    dispose () { [hiss, pops, hissFilter, popFilter, level].forEach (node => node.dispose()); }
  };
}
