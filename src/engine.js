// Ties the pieces together: builds the audio graph, holds the live state that
// the knobs write into, and drives the bar-by-bar scheduling.

import * as Tone from 'tone';
import { createKeys, createBass, createLead, createDrums, createDrone, createPluck, createVinyl } from './instruments.js';
import { createChain } from './effects.js';
import { PROGRESSIONS, noteNameToMidi } from './theory.js';
import { createMotif, developPhrase, gappedPool, planCounter } from './melody.js';
import { playChord, playBass, playDrums, playMelody, playCounter, playDrone, playVinyl } from './parts.js';

export function createEngine () {
  const chain = createChain();

  // Feeds the VU meter. Tapped off the master so it reads what you actually
  // hear, including the vinyl bed.
  const analyser = new Tone.Analyser ({ type: 'waveform', size: 1024 });
  chain.master.connect (analyser);

  // Separate FFT for the spectrum display. Small size: the meter shows twelve
  // bands, so resolving more bins than that would be thrown away.
  const spectrum = new Tone.Analyser ({ type: 'fft', size: 256, smoothing: 0.72 });
  chain.master.connect (spectrum);

  const keys = createKeys();
  const bass = createBass();
  const lead = createLead();
  const drums = createDrums();
  const drone = createDrone();
  const pluck = createPluck();
  const vinyl = createVinyl();

  // Instruments run through the sidechain so the kick ducks them. The vinyl
  // bed deliberately does not — a record surface does not pump.
  keys.connect (chain.input);
  bass.connect (chain.input);
  lead.connect (chain.input);
  drone.connect (chain.input);
  pluck.connect (chain.input);
  drums.outputs.forEach (out => out.connect (chain.input));
  vinyl.level.connect (chain.master);

  const state = {
    keys, bass, lead, drums, drone, pluck, vinyl, chain,

    rootMidi: noteNameToMidi ('C3'),
    scale: 'dorian',
    tempo: 72,
    density: 0.5,
    pump: 0.35,
    dust: 0.3,
    ornament: 0.6,
    droneLevel: 0.25,
    counter: 0.55,

    // Four four-bar phrases played as AABB. Rebuilt every sixteen bars.
    form: null,
    counterPlans: null,

    // Carried between bars so each chord can voice-lead from the last.
    previousVoicing: null,

    progression: PROGRESSIONS.dorian[0],

    barIndex: 0,
    running: false,

    // Set by the UI so the display can follow what is actually playing.
    onBar: null
  };

  Tone.getTransport().bpm.value = state.tempo;
  Tone.getTransport().swing = 0.28;
  Tone.getTransport().swingSubdivision = '8n';

  /** Called once per bar, slightly ahead of when the audio is needed. */
  function onBar (time) {
    try {
      scheduleBar (time);
    } catch (error) {
      // One bad bar must not tear down the repeat and stop the music.
      console.error ('bar failed', error);
    }
  }

  /** AABB: a phrase, its variation, a second phrase, its variation. Hearing a
      shape return is what separates a tune from noodling. */
  function buildForm () {
    const size = gappedPool (state.scale).length;

    // Two motifs, each developed twice. The second development is the varied
    // repeat: same opening bar, same cadence, different middle — which is what
    // a player does on the repeat, and what makes AABB sound like a form
    // rather than four unrelated phrases.
    const motifA = createMotif();
    const motifB = createMotif();

    const phrases = [
      developPhrase (state.scale, size, motifA),
      developPhrase (state.scale, size, motifA),
      developPhrase (state.scale, size, motifB),
      developPhrase (state.scale, size, motifB)
    ];

    // One figuration per phrase, held for its four bars. A and its variation
    // share a plan so the repeat sounds like the same music; B gets its own,
    // which is what makes the B section read as a change.
    const planA = planCounter (phrases[0]);
    const planB = planCounter (phrases[2]);

    state.form = phrases;
    state.counterPlans = [planA, planCounter (phrases[1]), planB, planCounter (phrases[3])];
    state.counterPlans[1].pattern = planA.pattern;
    state.counterPlans[3].pattern = planB.pattern;
  }

  function scheduleBar (time) {
    const chords = state.progression.chords;
    const chordSpec = chords[state.barIndex % chords.length];

    if (! state.form || state.barIndex % 16 === 0) buildForm();

    const positionInForm = state.barIndex % 16;
    const phrase = state.form[Math.floor (positionInForm / 4)];

    playChord (state, time, chordSpec);
    playBass (state, time, chordSpec);
    playDrums (state, time);
    playMelody (state, time, positionInForm % 4, phrase, chordSpec);
    playCounter (state, time, positionInForm % 4, chordSpec,
                 state.counterPlans?.[Math.floor (positionInForm / 4)], phrase);
    playDrone (state, time);
    playVinyl (state, time);

    // Occasionally move to a different progression in the same mode, so a long
    // listen does not sit on one loop forever.
    if (state.barIndex > 0 && state.barIndex % 8 === 0 && Math.random() < 0.35) {
      const set = PROGRESSIONS[state.scale] ?? PROGRESSIONS.minor;
      state.progression = set[Math.floor (Math.random() * set.length)];
    }

    const bar = state.barIndex;
    state.barIndex++;

    if (state.onBar) {
      const texture = state.counterPlans?.[Math.floor (positionInForm / 4)]?.texture ?? '';
      Tone.getDraw().schedule (
        () => state.onBar (bar, state.progression.name + (texture ? ' · ' + texture : '')), time);
    }
  }

  let scheduleId = null;

  async function start () {
    if (state.running) return;

    await Tone.start();

    // Reverb builds its impulse response asynchronously; without this the
    // first bars play dry.
    await chain.reverb.ready;

    vinyl.hiss.start();
    scheduleId = Tone.getTransport().scheduleRepeat (onBar, '1m');

    // Start a fraction ahead so the first bar is scheduled into the future
    // rather than at the exact current time.
    Tone.getTransport().start ('+0.1');

    state.running = true;
  }

  function stop () {
    if (! state.running) return;

    Tone.getTransport().stop();
    if (scheduleId !== null) Tone.getTransport().clear (scheduleId);
    scheduleId = null;

    vinyl.hiss.stop();
    keys.releaseAll();
    drone.triggerRelease();

    state.barIndex = 0;
    state.previousVoicing = null;
    state.running = false;
  }

  // Each setter maps one knob to whatever parameters it actually touches. A
  // knob is a musical idea, not a single node property — "dust" moves three
  // things at once because that is what makes it sound like one control.
  const controls = {
    tempo (value) {
      state.tempo = value;
      Tone.getTransport().bpm.rampTo (value, 0.4);
    },

    swing (value) {
      Tone.getTransport().swing = value;
    },

    density (value) {
      state.density = value;
    },

    brightness (value) {
      // 400 Hz is muffled to the point of underwater, 8 kHz is nearly open.
      chain.tone.frequency.rampTo (400 + value * 7600, 0.25);
    },

    dust (value) {
      state.dust = value;
      chain.crusherMix.fade.rampTo (value * 0.65, 0.25);
      chain.crusher.bits.value = Math.round (12 - value * 8);
      vinyl.level.gain.rampTo (value * 1.1, 0.3);
    },

    wobble (value) {
      chain.wobble.depth.rampTo (value * 0.22, 0.3);
      chain.wobble.frequency.rampTo (0.4 + value * 1.6, 0.3);
    },

    space (value) {
      chain.reverb.wet.rampTo (value, 0.3);
    },

    pump (value) {
      state.pump = value;
    },

    drive (value) {
      chain.saturation.distortion = value * 0.6;
    },

    volume (value) {
      chain.master.gain.rampTo (value, 0.2);
    },

    key (noteName) {
      state.rootMidi = noteNameToMidi (noteName + '3');
    },

    scale (name) {
      state.scale = name;

      // Each mode has its own progressions, because the chords that define a
      // mode only exist in that mode.
      const set = PROGRESSIONS[name] ?? PROGRESSIONS.minor;
      state.progression = set[Math.floor (Math.random() * set.length)];
      state.previousVoicing = null;

      // The note pool changed, so the current phrase no longer belongs to this
      // mode. Build a new one rather than transposing a tune into a scale it
      // was not written for.
      state.form = null;
    },

    ornament (value) {
      state.ornament = value;
    },

    drone (value) {
      state.droneLevel = value;
    },

    counter (value) {
      state.counter = value;
    }
  };

  // Smoothed so the needle swings like a real meter instead of twitching on
  // every frame. Rise is quicker than fall, the way VU ballistics behave.
  let level = 0;

  function getLevel () {
    const frame = analyser.getValue();
    let sum = 0;

    for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];

    const rms = Math.sqrt (sum / frame.length);
    const target = Math.min (1, rms * 3.2);

    level += (target - level) * (target > level ? 0.32 : 0.06);

    return level;
  }

  const BANDS = 12;
  const bands = new Array (BANDS).fill (0);

  // FFT bins are evenly spaced in frequency, but music is not: with linear
  // bands nearly all the energy lands in the first two columns and the rest of
  // the meter never moves. These edges are spaced logarithmically from 80 Hz to
  // 10 kHz, which is how the ear divides the range and how a spectrum display
  // has to divide it to look alive.
  const bandEdges = (() => {
    const low = 80;
    const high = 10000;
    const binCount = 256;
    const nyquist = Tone.getContext().sampleRate / 2;
    const edges = [];

    for (let i = 0; i <= BANDS; i++) {
      const frequency = low * Math.pow (high / low, i / BANDS);
      edges.push (Math.min (binCount - 1, Math.round (frequency / nyquist * binCount)));
    }

    return edges;
  })();

  /** Twelve normalised band levels for the meter. The analyser reports
      decibels, so this maps a musically useful window onto 0..1 and lets the
      columns fall slower than they rise. */
  function getSpectrum () {
    const frame = spectrum.getValue();

    for (let band = 0; band < BANDS; band++) {
      const from = bandEdges[band];
      const to = Math.max (from + 1, bandEdges[band + 1]);

      let peak = -Infinity;

      for (let i = from; i < to && i < frame.length; i++) {
        peak = Math.max (peak, frame[i]);
      }

      // -80 dB reads as silence, -22 dB as full scale. The top bands carry far
      // less energy than the bottom, so they get a lift to stay visible.
      const tilt = band * 1.6;
      const target = Math.max (0, Math.min (1, (peak + tilt + 80) / 58));

      bands[band] += (target - bands[band]) * (target > bands[band] ? 0.55 : 0.12);
    }

    return bands;
  }

  return { state, controls, start, stop, chain, analyser, getLevel, getSpectrum };
}
