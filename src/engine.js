// Ties the pieces together: builds the audio graph, holds the live state that
// the knobs write into, and drives the bar-by-bar scheduling.

import * as Tone from 'tone';
import { createKeys, createBass, createLead, createDrums, createDrone, createVinyl } from './instruments.js';
import { createChain } from './effects.js';
import { PROGRESSIONS, noteNameToMidi } from './theory.js';
import { createPhrase, varyPhrase, gappedPool } from './melody.js';
import { playChord, playBass, playDrums, playMelody, playDrone, playVinyl } from './parts.js';

export function createEngine () {
  const chain = createChain();

  // Feeds the VU meter. Tapped off the master so it reads what you actually
  // hear, including the vinyl bed.
  const analyser = new Tone.Analyser ({ type: 'waveform', size: 1024 });
  chain.master.connect (analyser);

  const keys = createKeys();
  const bass = createBass();
  const lead = createLead();
  const drums = createDrums();
  const drone = createDrone();
  const vinyl = createVinyl();

  // Instruments run through the sidechain so the kick ducks them. The vinyl
  // bed deliberately does not — a record surface does not pump.
  keys.connect (chain.input);
  bass.connect (chain.input);
  lead.connect (chain.input);
  drone.connect (chain.input);
  drums.outputs.forEach (out => out.connect (chain.input));
  vinyl.level.connect (chain.master);

  const state = {
    keys, bass, lead, drums, drone, vinyl, chain,

    rootMidi: noteNameToMidi ('C3'),
    scale: 'dorian',
    tempo: 72,
    density: 0.5,
    pump: 0.35,
    dust: 0.3,
    ornament: 0.6,
    droneLevel: 0.25,

    // Four four-bar phrases played as AABB. Rebuilt every sixteen bars.
    form: null,

    progression: PROGRESSIONS.minor[0],

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
    const a = createPhrase (state.scale, size);
    const b = createPhrase (state.scale, size);

    state.form = [a, varyPhrase (a), b, varyPhrase (b)];
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
    playMelody (state, time, positionInForm % 4, phrase);
    playDrone (state, time);
    playVinyl (state, time);

    // Occasionally move to a different progression in the same mode, so a long
    // listen does not sit on one loop forever.
    if (state.barIndex > 0 && state.barIndex % 8 === 0 && Math.random() < 0.35) {
      const set = PROGRESSIONS[state.scale === 'major' ? 'major' : 'minor'];
      state.progression = set[Math.floor (Math.random() * set.length)];
    }

    const bar = state.barIndex;
    state.barIndex++;

    if (state.onBar) {
      Tone.getDraw().schedule (() => state.onBar (bar, state.progression.name), time);
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
      const set = PROGRESSIONS[name === 'major' || name === 'mixolydian' ? 'major' : 'minor'];
      state.progression = set[Math.floor (Math.random() * set.length)];

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

  return { state, controls, start, stop, chain, analyser, getLevel };
}
