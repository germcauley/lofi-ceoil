// The voices. Everything here is synthesised so the project makes sound with
// no downloads and no asset pipeline.
//
// Each factory returns a Tone source exposing triggerAttackRelease, which is
// also the Sampler interface — so swapping any of these for a real sampled
// instrument (VCSL and friends) is a one-function change, not a refactor.

import * as Tone from 'tone';

/** Electric-piano-ish. FM with a low modulation index gets most of the way to
    a Rhodes: a bell-like attack over a sine body. */
export function createKeys () {
  return new Tone.PolySynth (Tone.FMSynth, {
    maxPolyphony: 12,
    harmonicity: 2,
    modulationIndex: 3.5,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.012, decay: 1.6, sustain: 0.25, release: 2.4 },
    modulation: { type: 'sine' },
    modulationEnvelope: { attack: 0.004, decay: 0.35, sustain: 0.1, release: 0.6 },
    volume: -14
  });
}

/** Soft round bass. Triangle through its own filter so it stays under the
    keys instead of fighting them. */
export function createBass () {
  return new Tone.MonoSynth ({
    oscillator: { type: 'triangle' },
    filter: { Q: 1, type: 'lowpass', rolloff: -24 },
    envelope: { attack: 0.02, decay: 0.3, sustain: 0.7, release: 0.9 },
    filterEnvelope: {
      attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.8,
      baseFrequency: 90, octaves: 2.2
    },
    volume: -12
  });
}

/** Sparse lead. Deliberately quiet — in lofi the melody sits behind the
    chords, not on top of them. */
export function createLead () {
  return new Tone.Synth ({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.03, decay: 0.4, sustain: 0.2, release: 1.4 },
    volume: -20
  });
}

export function createDrums () {
  const kick = new Tone.MembraneSynth ({
    pitchDecay: 0.05,
    octaves: 4,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.42, sustain: 0.01, release: 1.2 },
    volume: -6
  });

  // Noise plus a short tonal body reads as a snare without a sample.
  const snare = new Tone.NoiseSynth ({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
    volume: -16
  });

  const snareFilter = new Tone.Filter ({ type: 'bandpass', frequency: 1900, Q: 0.8 });
  snare.connect (snareFilter);

  // Ghost notes get their own voice. NoiseSynth wraps a single noise source,
  // so sharing one with the backbeat means a ghost landing next to a snare
  // hit fights it for the voice. A separate, duller voice also sounds more
  // like the real thing.
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
  return new Tone.MonoSynth ({
    oscillator: { type: 'sawtooth' },
    filter: { type: 'lowpass', rolloff: -24, Q: 2 },
    envelope: { attack: 0.9, decay: 0.4, sustain: 0.85, release: 1.8 },
    filterEnvelope: {
      attack: 1.2, decay: 0.6, sustain: 0.5, release: 1.5,
      baseFrequency: 160, octaves: 1.8
    },
    volume: -26
  });
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
