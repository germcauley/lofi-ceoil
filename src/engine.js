// Ties the pieces together: builds the audio graph, holds the live state that
// the knobs write into, and drives the bar-by-bar scheduling.

import * as Tone from 'tone';
import { KEYS_VOICES, LEAD_VOICES, createBass, createDrums, createDrone, createPluck, createVinyl } from './instruments.js';

const LEAD_VOICE_NAMES = Object.keys (LEAD_VOICES);
const KEYS_VOICE_NAMES = Object.keys (KEYS_VOICES);
import { createChain } from './effects.js';
import { PROGRESSIONS, noteNameToMidi } from './theory.js';
import { createMotif, developPhrase, gappedPool, planCounter } from './melody.js';
import { playChord, playBass, playDrums, playMelody, playCounter, playDrone, playVinyl, BASS_PATTERN_NAMES } from './parts.js';

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

  // Voices are swappable at runtime, so each one is held as { voice, output }
  // and the output is what connects onward.
  let keys = KEYS_VOICES.rhodes();
  let lead = LEAD_VOICES.whistle();

  const bass = createBass();
  const drums = createDrums();
  const drone = createDrone();
  const pluck = createPluck();
  const vinyl = createVinyl();

  // Instruments run through the sidechain so the kick ducks them. The vinyl
  // bed deliberately does not — a record surface does not pump.
  keys.output.connect (chain.input);
  lead.output.connect (chain.input);
  bass.output.connect (chain.input);
  drone.output.connect (chain.input);
  pluck.output.connect (chain.input);
  drums.outputs.forEach (out => out.connect (chain.input));
  vinyl.level.connect (chain.master);

  const state = {
    keys: keys.voice,
    lead: lead.voice,
    bass: bass.voice,
    drone: drone.voice,
    pluck: pluck.voice,
    drums, vinyl, chain,

    keysVoice: 'rhodes',
    leadVoice: 'whistle',

    // When true, the arrangement chooses these voices itself.
    autoVoice: false,
    autoKeysVoice: false,

    // Notified when a voice swap starts and when it is ready to play.
    onVoice: null,

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

    // Which layers play in which part of the turn.
    arrangement: null,

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
  const pickFrom = arr => arr[Math.floor (Math.random() * arr.length)];

  /** Decides which layers play in each of the turn's four parts.

      Everything entering at once and never stopping is what makes a generative
      piece sound like a loop rather than an arrangement. So parts get staged
      entrances: a turn often opens with the tune almost alone, drums arrive
      partway through the first part, and they pull back before the end of the
      last one. */
  function buildArrangement () {
    // Open with the melody carrying it: no drums, no bass, chords held back a
    // couple of bars so the motif is stated in the clear.
    const openBare = Math.random() < 0.45;

    return [0, 1, 2, 3].map (part => {
      const first = part === 0;
      const last = part === 3;

      return {
        bass: first && openBare ? 'none' : pickFrom (BASS_PATTERN_NAMES),
        chordsFrom: first && openBare ? 2 : 0,
        // 8 means the layer never arrives in this part.
        drumsFrom: first ? (openBare ? 8 : 4) : 0,
        // Pulling the drums before the end of the last part lets the turn
        // breathe instead of stopping dead.
        drumsUntil: last ? 6 : 8,
        counter: ! (first && openBare),

        // A bar with no harmony at all, borrowed from jacbz/Lofi, where an
        // empty chord also drops the drumbeat. The closing bar is the place
        // for it: the tune lands on its cadence with everything else out of
        // the way, which is a structural rest rather than a quiet moment.
        emptyBar: Math.random() < 0.35 ? 7 : -1
      };
    });
  }

  /** Assigns a lead voice to each part.

      Coming back from a drop is exactly where an arrangement wants a new
      colour: the accompaniment falls away, and what returns should not be
      identical to what left. So a part following one that ended empty gets a
      different voice, and otherwise the voice holds — changing it every part
      would be a gimmick rather than an arrangement. */
  function planVoices (arrangement) {
    let lead = state.leadVoice;
    let keysName = state.keysVoice;

    arrangement.forEach ((part, index) => {
      const previous = arrangement[index - 1];
      const followsADrop = previous && previous.emptyBar >= 0;

      if (followsADrop) {
        lead = pickFrom (LEAD_VOICE_NAMES.filter (name => name !== lead));
      }

      // The chord voice moves less often than the lead. Changing both at every
      // return would leave nothing recognisable across the seam — one of them
      // has to carry the thread.
      if (followsADrop && Math.random() < 0.4) {
        keysName = pickFrom (KEYS_VOICE_NAMES.filter (name => name !== keysName));
      }

      part.leadVoice = lead;
      part.keysVoice = keysName;
    });

    return arrangement;
  }

  function buildForm () {
    const size = gappedPool (state.scale).length;

    // Two motifs, each developed twice. The second development is the varied
    // repeat: same opening bar, same cadence, different middle — which is what
    // a player does on the repeat, and what makes AABB sound like a form
    // rather than four unrelated phrases.
    const motifA = createMotif();
    const motifB = createMotif();

    const partA = developPhrase (state.scale, size, motifA);

    // The B part — "the turn" — sits higher than the A part, which is how trad
    // tunes are built and the clearest signal that the form has moved on.
    //
    // A fixed shift is not enough: B has its own motif, whose shape can more
    // than cancel it out. So the shift is raised until the turn actually sits
    // above the A part, which is the thing the listener hears.
    const mean = part => part.reduce ((sum, e) => sum + e.degree, 0) / part.length;
    const target = mean (partA) + 1.5;

    let partBShift = 2;
    let partB = developPhrase (state.scale, size, motifB, 0.28, partBShift);

    while (partBShift < 6 && mean (partB) < target) {
      partBShift++;
      partB = developPhrase (state.scale, size, motifB, 0.28, partBShift);
    }

    const phrases = [
      partA,
      developPhrase (state.scale, size, motifA),
      partB,
      developPhrase (state.scale, size, motifB, 0.28, partBShift)
    ];

    // One figuration per phrase, held for its four bars. A and its variation
    // share a plan so the repeat sounds like the same music; B gets its own,
    // which is what makes the B section read as a change.
    const planA = planCounter (phrases[0]);
    const planB = planCounter (phrases[2]);

    state.form = phrases;
    state.arrangement = planVoices (buildArrangement());
    state.counterPlans = [planA, planCounter (phrases[1]), planB, planCounter (phrases[3])];
    state.counterPlans[1].pattern = planA.pattern;
    state.counterPlans[3].pattern = planB.pattern;
  }

  function scheduleBar (time) {
    const chords = state.progression.chords;
    const chordSpec = chords[state.barIndex % chords.length];

    // Four eight-bar parts: A A B B, so a full turn of the tune is 32 bars.
    if (! state.form || state.barIndex % 32 === 0) buildForm();

    const positionInForm = state.barIndex % 32;
    const phrase = state.form[Math.floor (positionInForm / 8)];

    const partIndex = Math.floor (positionInForm / 8);
    const barInPart = positionInForm % 8;
    const plan = state.arrangement?.[partIndex] ?? {};

    // Voice changes land on the part boundary, never mid-phrase.
    if (barInPart === 0) {
      if (state.autoVoice && plan.leadVoice) swapVoice ('lead', plan.leadVoice);
      if (state.autoKeysVoice && plan.keysVoice) swapVoice ('keys', plan.keysVoice);
    }

    // An empty bar drops everything but the tune, the drone and the surface
    // noise — so the melody's cadence is heard on its own.
    const empty = barInPart === plan.emptyBar;

    if (! empty && barInPart >= (plan.chordsFrom ?? 0)) playChord (state, time, chordSpec);
    if (! empty && plan.bass && plan.bass !== 'none') playBass (state, time, chordSpec, plan.bass);

    if (! empty && barInPart >= (plan.drumsFrom ?? 0) && barInPart < (plan.drumsUntil ?? 8)) {
      playDrums (state, time);
    }

    playMelody (state, time, barInPart, phrase, chordSpec);

    if (! empty && plan.counter !== false) {
      playCounter (state, time, barInPart, chordSpec, state.counterPlans?.[partIndex], phrase);
    }

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
      const texture = state.counterPlans?.[partIndex]?.texture ?? '';
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

    // A sampled voice chosen before playback started still has to load, or its
    // first notes throw. A sample that never arrives must not wedge playback,
    // so this gives up after a few seconds and starts anyway.
    const withTimeout = promise => Promise.race ([
      promise, new Promise (resolve => setTimeout (resolve, 6000))
    ]);

    await Promise.all ([keys.ready, lead.ready].filter (Boolean).map (withTimeout));

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
    state.keys.releaseAll?.();
    state.drone.triggerRelease?.();

    state.barIndex = 0;
    state.previousVoicing = null;
    state.arrangement = null;
    state.running = false;
  }

  // Each setter maps one knob to whatever parameters it actually touches. A
  // knob is a musical idea, not a single node property — "dust" moves three
  // things at once because that is what makes it sound like one control.
  /** Replaces a voice while the transport keeps running. The old chain is
      disposed after a short delay so any notes still ringing are not cut off
      mid-decay. */
  // Guards against a slow swap landing after a later one has already won.
  let swapToken = 0;

  /** Replaces a voice while the transport keeps running.

      A sampled voice has nothing to play until its files arrive, so the new
      voice is not handed to the scheduler until it is loaded — otherwise Tone
      throws "buffer is either not set or not loaded" on the next note. The old
      voice keeps playing until then, which also means the swap has no gap. */
  function swapVoice (kind, name) {
    const table = kind === 'keys' ? KEYS_VOICES : LEAD_VOICES;
    const factory = table[name];
    if (! factory) return;

    const current = kind === 'keys' ? keys : lead;
    if (current.name === name) return;

    const token = ++swapToken;
    const next = factory();
    next.name = name;
    next.output.connect (chain.input);

    const commit = () => {
      // A later swap has already been asked for; throw this one away.
      if (token !== swapToken) {
        next.output.disconnect();
        next.voice.dispose();
        if (next.output !== next.voice) next.output.dispose();
        return;
      }

      if (kind === 'keys') {
        keys = next;
        state.keys = next.voice;
        state.keysVoice = name;
      } else {
        lead = next;
        state.lead = next.voice;
        state.leadVoice = name;
      }

      // Dispose after a delay so notes still ringing are not cut off.
      setTimeout (() => {
        try {
          current.output.disconnect();
          current.voice.dispose();
          if (current.output !== current.voice) current.output.dispose();
        } catch (error) {
          // A voice already torn down is not worth reporting.
        }
      }, 3000);

      if (state.onVoice) state.onVoice (kind, name, true);
    };

    if (next.ready) {
      if (state.onVoice) state.onVoice (kind, name, false);
      next.ready.then (commit);
    } else {
      commit();
    }
  }

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
    },

    keysVoice (name) {
      swapVoice ('keys', name);
    },

    leadVoice (name) {
      swapVoice ('lead', name);
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
