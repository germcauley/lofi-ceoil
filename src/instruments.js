// The voices.
//
// Everything is synthesised, so there is nothing to download and no asset
// pipeline — but raw synth tones read as "synthy" very quickly. Three things
// fix most of that without samples:
//
//   * a soft attack with a noise transient, so notes start rather than appear
//   * slight detune or chorus, so a note is never one perfectly static pitch
//   * a lowpass sitting below the brightness of the raw oscillator
//
// Each factory returns { voice, output }. `voice` is what gets triggered and
// exposes triggerAttackRelease — which is also the Tone.Sampler interface, so
// swapping any of these for real samples stays a one-function change. `output`
// is what connects onward, which may be the end of a small effect chain.

import * as Tone from 'tone';

/** Builds a sampled voice from a folder under public/samples.

    VCSL names its files an octave below scientific pitch — their C4 measures
    522 Hz, which is MIDI 72 — so the mapping here is always written in the
    Tone note each sample actually sounds, not the name it shipped with.

    Filenames use `s` rather than `#` for sharps. In a URL a `#` begins the
    fragment, so `G#4.mp3` requests `G` and the sample never arrives — silently,
    because the sampler simply has no buffer for that note. */
function sampled (folder, urls, { volume = -10, release = 1.2, cutoff = 6000 } = {}) {
  // Tone.loaded() is global and can resolve before a sampler built moments ago
  // has its buffers, so each one carries its own signal instead.
  let markReady;
  const ready = new Promise (resolve => { markReady = resolve; });

  const voice = new Tone.Sampler ({
    urls,
    baseUrl: `${import.meta.env.BASE_URL}samples/${folder}/`,
    release,
    volume,
    onload: () => markReady()
  });

  // Rolled off so a sampled voice sits inside the tape path rather than on
  // top of it — real recordings are brighter than the synths they replace.
  const tone = new Tone.Filter ({ type: 'lowpass', frequency: cutoff, rolloff: -12 });
  voice.connect (tone);

  return { voice, output: tone, loading: true, ready };
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

  return { voice, output: tone };
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

  return { voice, output: chorus };
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

  return { voice, output: tone };
}

/** The same Salamander piano the lead can use, voiced for chords: quieter, and
    rolled off further so a four-note voicing does not crowd the melody. */
function pianoKeys () {
  return sampled ('piano', {
    C3: 'C3.mp3', 'F#3': 'Fs3.mp3',
    C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3', A4: 'A4.mp3',
    C5: 'C5.mp3', 'F#5': 'Fs5.mp3',
    C6: 'C6.mp3'
  }, { volume: -16, release: 1.4, cutoff: 3400 });
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

  return { voice, output: tone };
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

  return { voice, output: tone };
}

/** Baroque soprano recorder, standing in for a tin whistle — the nearest thing
    in a CC0 library, and the same family of edge-blown pipe.

    A recorder sounds an octave above where the tune is written, and VCSL names
    an octave low; the two cancel, so each file is filed under the note it is
    named after and the voice transposes up for free. */
function whistleSampled () {
  return sampled ('recorder', {
    C4: 'C4.mp3', E4: 'E4.mp3', 'G#4': 'Gs4.mp3',
    C5: 'C5.mp3', E5: 'E5.mp3',
    C6: 'C6.mp3'
  }, { volume: -14, release: 0.6, cutoff: 5200 });
}

/** A real folk harp — the instrument this music actually belongs to. */
function harpSampled () {
  return sampled ('harp', {
    C4: 'C4.mp3', E4: 'E4.mp3', 'G#4': 'Gs4.mp3',
    C5: 'C5.mp3', E5: 'E5.mp3', 'G#5': 'Gs5.mp3',
    C6: 'C6.mp3'
  }, { volume: -8, release: 1.4, cutoff: 6500 });
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

  return { voice, output: voice };
}

/** Real piano, from the Salamander Grand Piano set that Tone.js itself uses.
    Nine samples across three octaves, pitch-shifted between — synthesis got as
    close to a piano as FM usefully can, and a struck string with its own
    resonance and release noise is not something an oscillator reaches.

    The samples are vendored rather than fetched from someone else's host, and
    loaded only when this voice is chosen, so nobody pays for them unless they
    ask for a piano. */
function piano () {
  const base = `${import.meta.env.BASE_URL}samples/piano/`;

  const voice = new Tone.Sampler ({
    urls: {
      C3: 'C3.mp3', 'F#3': 'Fs3.mp3',
      C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3', A4: 'A4.mp3',
      C5: 'C5.mp3', 'F#5': 'Fs5.mp3',
      C6: 'C6.mp3'
    },
    baseUrl: base,
    release: 1.2,
    volume: -9
  });

  // Rolled off a little so it sits in the tape path rather than on top of it.
  const tone = new Tone.Filter ({ type: 'lowpass', frequency: 5200, rolloff: -12 });
  voice.connect (tone);

  return { voice, output: tone, loading: true };
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

/** Soft round bass. Triangle plus a touch of sub, through its own filter so it
    stays under the keys instead of fighting them. */
export function createBass () {
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

  return { voice, output: voice };
}

/** The counter line's voice: a pluck, distinct from whichever lead is chosen. */
export function createPluck () {
  const voice = new Tone.PluckSynth ({
    attackNoise: 0.7,
    dampening: 2600,
    resonance: 0.93,
    release: 0.9,
    volume: -17
  });

  return { voice, output: voice };
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

  return { kick, snare, ghost, hat, outputs: [kick, snareFilter, ghostFilter, hatFilter] };
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

  return { voice, output: voice };
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

  return { hiss, pops, level };
}
