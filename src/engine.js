import { meterInfo } from './musical-meter.js';
// Ties the pieces together: builds the audio graph, holds the live state that
// the knobs write into, and drives the bar-by-bar scheduling.

import * as Tone from 'tone';
import { KEYS_VOICES, LEAD_VOICES, BASS_VOICES, SUPPORT_VOICES, createDrums, createDrone, createPluck, createVinyl, preloadSamples } from './instruments.js';

const LEAD_VOICE_NAMES = Object.keys (LEAD_VOICES);
const KEYS_VOICE_NAMES = Object.keys (KEYS_VOICES);
const BASS_VOICE_NAMES = Object.keys (BASS_VOICES);
const SUPPORT_VOICE_NAMES = Object.keys (SUPPORT_VOICES);
import { createChain } from './effects.js';
import { createTrackNamer } from './track-names.js';
import { createTrackMaterialPicker } from './track-material.js';
import { createStructurePicker } from './track-structure.js';
import { DEFAULT_TRADITION, TRADITION_NAMES, modesFor, progressionsFor, traditionOf, traditionName } from './tradition.js';
import { composeTrack, reviseComposition, COMPOSITION_VERSION } from './composition.js';
import { playScoreBar } from './score-player.js';
import { createPlaybackTimeline } from './playback-timeline.js';
import { PROGRESSIONS, NOTE_NAMES, noteNameToMidi, findPivot } from './theory.js';
import { gappedPool } from './melody.js';
import { playVinyl } from './parts.js';
import { chooseTempoOffset, clampTempo, DEFAULT_TEMPO } from './track-tempo.js';

export function createEngine () {
  const chain = createChain();
  const nextTrackTitle = createTrackNamer();
  const nextTrackMaterial = createTrackMaterialPicker();
  const structurePickers = new Map();
  function nextStructure (tradition) {
    const key = traditionName (tradition);
    if (! structurePickers.has (key)) structurePickers.set (key, createStructurePicker (key));
    return structurePickers.get (key)();
  }

  // Weighted towards the accent this thing is named for. Pop is the guest.
  const traditionBag = ['irish', 'irish', 'pop'];
  let previousOpeningProgression = null;
  let previousTempoOffset = null;
  let announcedTrack = null;
  const playbackTimeline = createPlaybackTimeline();
  let lastComposition = null;
  let replayPending = null;
  let scoreDirty = false;
  let scoreEdits = {};

  function setReplayPending (composition) {
    replayPending = composition;
    state.onReplayQueue?.(Boolean (composition));
  }

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
  let keys = { ...KEYS_VOICES.rhodes(), name: 'rhodes' };
  let lead = { ...LEAD_VOICES.vibraphone(), name: 'vibraphone' };

  let bass = { ...BASS_VOICES.round(), name: 'round' };
  let drums = createDrums();
  let drone = createDrone();
  let support = { ...SUPPORT_VOICES.glockenspiel(), name: 'glockenspiel' };
  let pluck = createPluck();
  let vinyl = createVinyl();

  // Instruments run through the sidechain so the kick ducks them. The vinyl
  // bed deliberately does not — a record surface does not pump.
  let instrumentBus = new Tone.Gain (1).connect (chain.input);
  function connectInstruments () {
    [keys, lead, bass, drone, pluck, support].forEach (part => part.output.connect (instrumentBus));
    drums.outputs.forEach (out => out.connect (instrumentBus));
    // Into the limiter, not past it. The surface stays outside the sidechain
    // and the tape path — a record does not pump and is not the tape — but it
    // must not be the one thing that can spike above everything else.
    vinyl.level.connect (chain.limiter);
  }
  connectInstruments();

  const state = {
    keys: keys.voice,
    lead: lead.voice,
    bass: bass.voice,
    drone: drone.voice,
    support: support.voice,
    supportVoice: 'glockenspiel',
    pluck: pluck.voice,
    drums, vinyl, chain,

    keysVoice: 'rhodes',
    leadVoice: 'vibraphone',
    bassVoice: 'round',

    // On by default. A set that plays every track on the same three
    // instruments is not what a listener expects, and pinning a voice by hand
    // is the deliberate act rather than the other way round.
    autoVoice: true,
    autoKeysVoice: true,
    autoBassVoice: true,

    // Notified when a voice swap starts and when it is ready to play.
    onVoice: null,

    // Every session opens somewhere different. Starting in C dorian every time
    // made the machine sound like it had one tune in it.
    //
    // The mode is weighted rather than uniform: dorian and minor are where
    // this music lives, so major stays the exception rather than a quarter of
    // all openings.
    rootMidi: noteNameToMidi (NOTE_NAMES[Math.floor (Math.random() * 12)] + '3'),
    scale: (modes => modes[Math.floor (Math.random() * modes.length)])
      (traditionOf (DEFAULT_TRADITION).modes),
    tradition: DEFAULT_TRADITION,
    autoTradition: true,
    tempo: DEFAULT_TEMPO,
    tempoUser: DEFAULT_TEMPO,

    // A track: one tune, held for several turns. Its motifs are its identity.
    track: null,
    trackNumber: 0,
    skipRequested: false,

    // A filter sweep aimed at the next section boundary.
    sweep: null,
    // The user's settings, and the values actually in force. The energy arc
    // scales the user's numbers rather than replacing them, so a knob still
    // means what it says — it sets the centre the arc swings around.
    density: 0.5,

    // What the knobs are set to. Every one of these is a centre that a track
    // varies around, not a fixed value — a set where every tune has identical
    // swing, dust and ornament sounds like one long tune.
    user: {
      density: 0.5, counter: 0.55, brightness: 0.29, swing: 0.28,
      ornament: 0.6, drone: 0.14, dust: 0.3, wobble: 0.27, support: 0.5,
      drive: 0.3, space: 0.28, pump: 0.35
    },

    // Where we are in a long arc, and how far it is allowed to swing things.
    energy: 0.5,
    arcDepth: 0.5,
    arcShape: 'swell',
    arcLength: 8,
    arcTurn: 0,
    pump: 0.35,
    dust: 0.3,
    ornament: 0.6,
    droneLevel: 0.25,
    counter: 0.55,

    // Four eight-bar sections; the track owns the tune and order of returns.
    form: null,
    counterPlans: null,

    // Carried between bars so each chord can voice-lead from the last.
    previousVoicing: null,

    // Which layers play in which part of the turn.
    arrangement: null,

    // Where the current turn started, so a pause between tunes does not put
    // the form out of step with the bar count.
    formOffset: 0,

    // A set ending: the tune winds down, then a few bars of nothing but
    // surface noise before the next one begins.
    endingSet: false,
    resting: 0,
    turnsSinceEnding: 0,

    // A modulation in flight: where we are going, and the chord that belongs
    // to both keys and carries us there.
    pendingKey: null,
    pivot: null,

    // Notified when the key moves on its own, so the panel can follow.
    onKey: null,

    progression: PROGRESSIONS.dorian[0],

    barIndex: 0,
    running: false,

    // Set by the UI so the display can follow what is actually playing.
    onBar: null,
    // Fired at the audible start of a track, not when its plan is prepared.
    onTrack: null,
    // Queue changes happen immediately, without disturbing playback.
    onReplayQueue: null
  };

  Tone.getTransport().bpm.value = state.tempo;
  Tone.getTransport().swing = 0.28;
  Tone.getTransport().swingSubdivision = '8n';

  let scheduledTempo = state.tempo;
  let restartTime = null;
  let barTime = null;
  let scheduledPulse = 1;

  function setTempo (value, duration) {
    const pulse = meterInfo (state.track?.structure?.meter).pulseBeats;
    value = clampTempo (value) * pulse;
    const bpm = Tone.getTransport().bpm;
    if (restartTime !== null) {
      // A skip is a cut to a new track. Finish tempo automation at the cut
      // rather than repeatedly replacing ramps while the clock is restarting.
      bpm.cancelScheduledValues (restartTime);
      bpm.setValueAtTime (value, restartTime);
    } else if (pulse !== scheduledPulse) {
      const boundary = barTime ?? Tone.now();
      bpm.cancelScheduledValues (boundary);
      bpm.setValueAtTime (value, boundary);
    } else if (value !== scheduledTempo) {
      bpm.rampTo (value, duration);
    }
    scheduledTempo = value;
    scheduledPulse = pulse;
  }


  /** Called once per bar, slightly ahead of when the audio is needed. */
  function onBar (time) {
    try {
      barTime = time;
      scheduleBar (time);
    } catch (error) {
      // One bad bar must not tear down the repeat and stop the music.
      console.error ('bar failed', error);
    } finally {
      barTime = null;
    }
  }

  /** AABB: a phrase, its variation, a second phrase, its variation. Hearing a
      shape return is what separates a tune from noodling. */
  const pickFrom = arr => arr[Math.floor (Math.random() * arr.length)];

  const RELATIVE_OF = { minor: 'major', dorian: 'mixolydian', major: 'minor', mixolydian: 'dorian' };
  const MODES = ['major', 'minor', 'dorian', 'mixolydian'];

  /** Chooses where to modulate to.

      Four moves, all defensible. The relative and the fifth share nearly every
      note with where we are. A tone up is the lift a trad set uses. Modal
      interchange keeps the tonic and changes only the mode, which is the
      subtlest of the four — nothing moves, everything recolours. */
  function chooseTargetKey () {
    let root = state.rootMidi;
    let scale = state.scale;
    const roll = Math.random();

    if (roll < 0.3) {
      // Relative: same notes, different centre.
      const goingMinor = scale === 'major' || scale === 'mixolydian';
      root += goingMinor ? -3 : 3;
      scale = RELATIVE_OF[scale] ?? scale;
    } else if (roll < 0.6) {
      // A fifth either way: one note different.
      root += Math.random() < 0.5 ? 5 : -5;
    } else if (roll < 0.8) {
      // Up a tone — the lift a set of tunes uses.
      root += 2;
    } else {
      // Modal interchange: same tonic, new mode.
      scale = pickFrom (MODES.filter (mode => mode !== scale));
    }

    // Keep the tonic in one octave so the register never drifts.
    while (root < 48) root += 12;
    while (root > 59) root -= 12;

    return { root, scale };
  }

  function applyPendingKey () {
    if (! state.pendingKey) return;

    state.rootMidi = state.pendingKey.root;
    state.scale = state.pendingKey.scale;
    state.pendingKey = null;
    state.pivot = null;

    const set = progressionsFor (state.tradition, state.scale);
    state.progression = set[Math.floor (Math.random() * set.length)];
    state.previousVoicing = null;
    state.form = null;
    if (state.track) state.track.progression = state.progression;

    if (state.onKey) {
      const name = NOTE_NAMES[state.rootMidi % 12];
      Tone.getDraw().schedule (() => state.onKey (name, state.scale), Tone.now());
    }
  }

  const clamp01 = value => Math.max (0, Math.min (1, value));

  /** Works out what each setting is actually worth right now.

      Three things combine: what the knob is set to, how this track differs
      from that, and where the energy arc has got to. The arc knob scales the
      last two, so at zero every knob means exactly what it says. */
  function applySettings () {
    const drift = state.arcDepth;
    const offsets = state.track?.variation ?? {};
    const swing = (state.energy - 0.5) * 2 * drift;

    const value = (name, arcWeight = 0) => clamp01 (
      state.user[name]
        + (offsets[name] ?? 0) * drift
        + swing * arcWeight * state.user[name]);

    // The arc drives busyness and brightness; everything else is the track's
    // own character and does not move within it.
    state.density = value ('density', 0.5);
    state.counter = value ('counter', 0.5);
    state.ornament = value ('ornament');
    state.droneLevel = value ('drone');
    state.supportLevel = value ('support');
    state.pump = value ('pump');
    state.dust = value ('dust');

    const brightness = value ('brightness', 0.4);
    const dust = state.dust;

    state.meter = state.track?.structure?.meter ?? '4/4';
    Tone.getTransport().swing = state.meter === '6/8' ? 0 : value ('swing');
    state.tempo = clampTempo (state.tempoUser + (state.track?.tempoOffset ?? 0) * drift);
    if (! state.endingSet && ! state.resting) setTempo (state.tempo, 0.4);

    chain.tone.frequency.rampTo (400 + brightness * 7600, 2);
    chain.crusherMix.fade.rampTo (dust * 0.65, 1);
    chain.crusher.bits.value = Math.round (12 - dust * 8);
    // Calibrate the voices themselves; dust controls their shared level and
    // reaches silence at zero. New banks fade in from zero after a skip.
    vinyl.level.gain.rampTo (dust * 1.1, 1.5);

    chain.wobble.depth.rampTo (value ('wobble') * 0.22, 1);
    chain.wobble.frequency.rampTo (0.4 + value ('wobble') * 1.6, 1);
    chain.reverb.wet.rampTo (value ('space'), 1);
    chain.saturation.distortion = value ('drive') * 0.6;
  }

  /** Starts a new track: new material, a new tempo, and a fresh run of turns.

      Until now the motifs were rebuilt every turn, so the tune changed every
      thirty-two bars and never settled — there was no track to recognise. A
      track holds its material for two to four turns, which is a tune played
      several times through, exactly as a set does. Everything else keeps
      moving underneath: the arrangement, the energy arc, the voices and the
      counter textures. */
  function startTrack () {
    if (replayPending) {
      const composition = replayPending;
      setReplayPending (null);
      const recipe = composition.recipe;
      previousTempoOffset = recipe.tempoOffset;
      state.trackNumber++;
      state.track = { title: recipe.title, titleEnglish: recipe.titleEnglish ?? null,
        titleLanguage: recipe.titleLanguage ?? 'en', structure: recipe.structure, motifA: recipe.motifA,
        motifB: recipe.motifB, variation: recipe.variation, tempoOffset: recipe.tempoOffset,
        size: gappedPool (recipe.scale).length, turn: 0, turnsLeft: recipe.turns,
        progression: recipe.progression, composition };
      state.rootMidi = recipe.rootMidi;
      state.scale = recipe.scale;
      state.pendingKey = null;
      state.previousVoicing = null;
      Tone.getDraw().schedule (() => state.onKey?.(NOTE_NAMES[recipe.rootMidi % 12], recipe.scale), Tone.now());
      for (const role of ['lead', 'keys', 'bass']) {
        if (state[role === 'lead' ? 'autoVoice' : role === 'keys' ? 'autoKeysVoice' : 'autoBassVoice']) {
          swapVoice (role, recipe.voices[role]);
        }
      }
      scoreDirty = false;
      scoreEdits = {};
      lastComposition = composition;
      applySettings();
      return state.track;
    }
    const size = gappedPool (state.scale).length;

    state.trackNumber++;
    // A new tune is the place a tradition changes: mid-track would mean the
    // form and the meter disagreeing with the tune already playing.
    if (state.autoTradition) {
      state.tradition = traditionBag[Math.floor (Math.random() * traditionBag.length)];
    }

    // Follow the tradition into a mode it actually uses. Without this a track
    // could switch to pop and stay in mixolydian, which is the mode it just
    // came from — the label would change and nothing else would.
    const modes = modesFor (state.tradition);
    if (! modes.includes (state.scale)) {
      state.scale = modes[Math.floor (Math.random() * modes.length)];
      state.previousVoicing = null;
      if (state.onKey) {
        const name = NOTE_NAMES[state.rootMidi % 12];
        Tone.getDraw().schedule (() => state.onKey (name, state.scale), Tone.now());
      }
    }
    state.track = {
      ...nextTrackTitle(),
      tradition: state.tradition,
      structure: nextStructure (state.tradition),
      turn: 0,
      ...nextTrackMaterial(),
      // Distinct neighbouring tempos around the knob's base value. Drift
      // controls the spread; at zero the knob remains exact.
      tempoOffset: chooseTempoOffset (previousTempoOffset, state.tempoUser, state.arcDepth),

      // How this track differs from where the knobs are set. Signed offsets,
      // scaled by the arc knob when they are applied.
      variation: {
        swing:      (Math.random() - 0.5) * 0.30,
        ornament:   (Math.random() - 0.5) * 0.55,
        drone:      (Math.random() - 0.5) * 0.20,
        dust:       (Math.random() - 0.5) * 0.45,
        wobble:     (Math.random() - 0.5) * 0.45,
        drive:      (Math.random() - 0.5) * 0.40,
        space:      (Math.random() - 0.5) * 0.40,
        pump:       (Math.random() - 0.5) * 0.40,
        brightness: (Math.random() - 0.5) * 0.30,
        density:    (Math.random() - 0.5) * 0.30,
        counter:    (Math.random() - 0.5) * 0.40
      },
      turnsLeft: 2 + Math.floor (Math.random() * 3),
      size
    };

    // Give the new tune its own harmonic opening too, even if it stays in
    // the same key. Both the outgoing harmony and last opening are avoided.
    const progressions = progressionsFor (state.tradition, state.scale);
    const choices = progressions.filter (progression =>
      progression.name !== state.progression.name && progression.name !== previousOpeningProgression);
    state.progression = pickFrom (choices.length ? choices : progressions);
    previousOpeningProgression = state.progression.name;
    state.track.progression = state.progression;
    state.previousVoicing = null;

    chooseTrackVoices();
    applySettings();
    const track = state.track;
    previousTempoOffset = track.tempoOffset;
    const recipe = {
      version: COMPOSITION_VERSION, seed: Math.floor (Math.random() * 4294967296),
      title: track.title, titleEnglish: track.titleEnglish, titleLanguage: track.titleLanguage,
      rootMidi: state.rootMidi, scale: state.scale, tradition: state.tradition,
      structure: track.structure, motifA: track.motifA, motifB: track.motifB,
      progression: state.progression, turns: track.turnsLeft,
      variation: track.variation, user: { ...state.user }, tempoUser: state.tempoUser,
      tempoOffset: track.tempoOffset, arcDepth: state.arcDepth,
      arc: { shape: state.arcShape, length: state.arcLength, turn: state.arcTurn },
      turnsSinceEnding: state.turnsSinceEnding,
      voices: Object.fromEntries (['lead', 'keys', 'bass'].map (role =>
        [role, pendingVoices[role]?.name ?? state[role + 'Voice']])),
      auto: { lead: state.autoVoice, keys: state.autoKeysVoice, bass: state.autoBassVoice },
      voiceOptions: { lead: LEAD_VOICE_NAMES, keys: KEYS_VOICE_NAMES, bass: BASS_VOICE_NAMES }
    };
    track.composition = composeTrack (recipe);
    lastComposition = track.composition;
    scoreDirty = false;
    scoreEdits = {};
    return state.track;
  }

  /** Picks the instruments a new track is played on.

      Voices previously only moved after a drop, which meant a track could
      start on whatever the last one happened to end with — and with the rows
      pinned by default, never moved at all. A new tune is the natural place
      for a new sound.

      Rows the listener has pinned by hand are left alone. */
  function chooseTrackVoices () {
    if (state.autoVoice) {
      swapVoice ('lead', pickFrom (LEAD_VOICE_NAMES.filter (n => n !== state.leadVoice)));
    }

    if (state.autoKeysVoice) {
      // Piano under piano is muddy — the chords lose their own identity and
      // the melody stops sitting on top of anything.
      const leadIsPiano = (pendingVoices.lead?.name ?? state.leadVoice) === 'piano';
      const options = KEYS_VOICE_NAMES.filter (n =>
        n !== state.keysVoice && ! (leadIsPiano && n === 'piano'));

      swapVoice ('keys', pickFrom (options));
    }

    if (state.autoBassVoice) {
      swapVoice ('bass', pickFrom (BASS_VOICE_NAMES.filter (n => n !== state.bassVoice)));
    }
  }

  /** Decides whether a sweep runs this turn, and where it lands.

      Only the boundaries worth preparing: the move into the B part halfway
      through, and the end of the turn. A sweep into an arbitrary bar is a
      filter wobbling — the gesture means something only if what it arrives at
      is a change.

      Roughly a third of turns. A build that happens every time builds nothing. */
  function planSweep () {
    state.sweep = null;
    if (Math.random() > 0.34) return;

    const lands = Math.random() < 0.5 ? 16 : 32;   // top of the B part, or the next turn
    const bars = 2 + Math.floor (Math.random() * 3);

    state.sweep = {
      startBar: lands - bars,
      bars,
      // Falling into a set ending, since that is a release rather than a
      // build; otherwise rising when there is energy to build on.
      kind: state.endingSet && lands === 32 ? 'fall'
        : state.energy > 0.55 ? 'rise' : (Math.random() < 0.6 ? 'rise' : 'fall'),
      depth: 0.5 + state.energy * 0.5
    };
  }

  function buildForm () {
    if (! state.track || state.track.turnsLeft <= 0
        || state.track.turn >= state.track.composition.turns.length) startTrack();
    const track = state.track;
    const turn = track.composition.turns[track.turn];
    track.turn++;
    track.turnsLeft--;
    state.form = turn.phrases;
    state.arrangement = turn.arrangement;
    state.counterPlans = turn.counterPlans;
    state.energy = turn.energy;
    state.arcShape = turn.arc.shape;
    state.arcLength = turn.arc.length;
    state.arcTurn = turn.arc.turn;
    state.turnsSinceEnding++;
    state.endingSet = track.composition.ending && track.turn === track.composition.turns.length;
    if (state.endingSet) state.turnsSinceEnding = 0;
    planSweep();
    applySettings();
  }

  function scheduleBar (time) {
    // Between tunes: nothing but the record surface. The bar count keeps
    // running so the transport never stops, but the form is held.
    if (state.resting > 0 && ! state.skipRequested) {
      playbackTimeline.endTrack (time);
      playVinyl ({ ...state, tempo: state.tempo * meterInfo (state.meter).pulseBeats }, time);
      state.resting--;

      if (state.resting === 0) {
        setTempo (state.tempo, 2.5);
        applyPendingKey();
        state.form = null;
        state.formOffset = state.barIndex + 1;
      }

      const restingBar = state.barIndex;
      state.barIndex++;

      if (state.onBar) {
        Tone.getDraw().schedule (() => state.onBar (restingBar, '— — —'), time);
      }

      return;
    }

    // Four eight-bar sections, ordered by this track, make a 32-bar turn.
    // A skip restarts the transport on a fresh bar with fresh voice timelines.
    if (state.skipRequested) {
      state.skipRequested = false;
      state.sweep = null;
      chain.clearSweep();
      state.resting = 0;
      state.track = null;
      state.form = null;
      state.pivot = null;
      state.pendingKey = null;
      state.endingSet = false;
      state.previousVoicing = null;

      // This bar becomes the start of a turn.
      state.formOffset = state.barIndex;

      // Half the time a fresh track is in a fresh key. No pivot — a skip is a
      // cut, and a pivot would be smoothing over a seam the listener asked for.
      if (! replayPending && Math.random() < 0.5) {
        const target = chooseTargetKey();
        state.rootMidi = target.root;
        state.scale = target.scale;

        const set = progressionsFor (state.tradition, state.scale);
        state.progression = set[Math.floor (Math.random() * set.length)];

        if (state.onKey) {
          const name = NOTE_NAMES[state.rootMidi % 12];
          Tone.getDraw().schedule (() => state.onKey (name, state.scale), Tone.now());
        }
      }
    }

    const positionInForm = (state.barIndex - state.formOffset) % 32;

    // Start a planned sweep so that it finishes exactly on the boundary.
    if (state.sweep && positionInForm === state.sweep.startBar) {
      const barSeconds = (60 / state.tempo) * meterInfo (state.meter).beats / meterInfo (state.meter).pulseBeats;
      chain.sweep (state.sweep.kind, time, state.sweep.bars * barSeconds, state.sweep.depth);
      state.sweep = null;
    }

    // Select the already-written turn before handing its notes to playback.
    if (! state.form || positionInForm === 0) buildForm();

    if (state.track !== announcedTrack) {
      announcedTrack = state.track;
      const track = { title: state.track.title, titleEnglish: state.track.titleEnglish,
        titleLanguage: state.track.titleLanguage, number: state.trackNumber };
      Tone.getDraw().schedule (() => state.onTrack?.(track), time);
    }

    const track = state.track;
    const scoreIndex = (track.turn - 1) * 32 + positionInForm;
    if (scoreDirty) {
      track.composition = reviseComposition (track.composition, scoreIndex, {
        user: { ...state.user }, arcDepth: state.arcDepth, tempoUser: state.tempoUser, ...scoreEdits
      });
      lastComposition = track.composition;
      scoreDirty = false;
    }
    const writtenBar = track.composition.bars[scoreIndex];
    state.scoreBarIndex = scoreIndex;
    const partIndex = writtenBar.part;
    const barInPart = writtenBar.barInPart;
    const plan = writtenBar.arrangement;
    if (state.rootMidi !== writtenBar.rootMidi || state.scale !== writtenBar.scale) {
      state.rootMidi = writtenBar.rootMidi;
      state.scale = writtenBar.scale;
      Tone.getDraw().schedule (() => state.onKey?.(NOTE_NAMES[writtenBar.rootMidi % 12], writtenBar.scale), time);
    }
    state.progression = { name: writtenBar.progression, chords: [writtenBar.chord] };
    if (barInPart === 0) {
      if (state.autoVoice) swapVoice ('lead', plan.leadVoice);
      if (state.autoKeysVoice) swapVoice ('keys', plan.keysVoice);
      if (state.autoBassVoice) swapVoice ('bass', plan.bassVoice);
    }
    if (writtenBar.winding && barInPart === 4) {
      setTempo (state.tempo * 0.82, (60 / state.tempo) * 4 * meterInfo (state.meter).beats / meterInfo (state.meter).pulseBeats);
    }
    const secondsPerBeat = 60 / Tone.getTransport().bpm.getValueAtTime (time);
    playScoreBar (state, writtenBar, time, secondsPerBeat);

    // The record surface is generated at playback rather than composed, so it
    // is never the same twice and never bloats a saved score.
    playVinyl ({ ...state, tempo: state.tempo * meterInfo (state.meter).pulseBeats }, time);
    playbackTimeline.schedule ({ score: track.composition, track, barIndex: scoreIndex, time, secondsPerBeat,
      voices: { lead: state.leadVoice, keys: state.keysVoice, bass: state.bassVoice } });
    if (scoreIndex === track.composition.barCount - 1) {
      state.pendingKey = track.composition.nextKey;
      if (track.composition.restBars) {
        state.resting = track.composition.restBars;
        state.endingSet = false;
      } else if (state.pendingKey) applyPendingKey();
    }

    const bar = state.barIndex;
    state.barIndex++;

    if (state.onBar) {
      const texture = state.counterPlans?.[partIndex]?.texture ?? '';
      const arc = state.arcDepth > 0
        ? ` · ${state.arcShape} ${Math.round (state.energy * 100)}%`
        : '';

      const description = writtenBar.progression + (texture ? ' · ' + texture : '') + arc;
      Tone.getDraw().schedule (
        () => state.onBar (bar, description),
        time);
    }
  }

  let scheduleId = null;
  let eighthsUntilBar = 0;
  function onEighth (time) {
    if (eighthsUntilBar > 0) { eighthsUntilBar--; return; }
    onBar (time);
    eighthsUntilBar = meterInfo (state.meter).eighths - 1;
  }

  async function start () {
    if (state.running) return;

    await Tone.start();

    // Reverb builds its impulse response asynchronously; without this the
    // first bars play dry.
    await chain.reverb.ready;

    // Decode the small sample library once. A skip can then create any voice
    // immediately, with no network requests and no old scheduled notes.
    await preloadSamples();
    await Promise.all ([keys.ready, lead.ready, ...Object.values (pendingVoices).map (part => part?.ready)].filter (Boolean));

    vinyl.hiss.start();
    eighthsUntilBar = 0;
    scheduleId = Tone.getTransport().scheduleRepeat (onEighth, '8n');

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

    state.running = false;
    setReplayPending (null);
    playbackTimeline.reset();
    Tone.getDraw().cancel (Tone.immediate());
    replaceInstruments (Tone.now());

    state.barIndex = 0;
    state.formOffset = 0;
    state.previousVoicing = null;
    state.arrangement = null;
    state.form = null;
    state.endingSet = false;
    state.resting = 0;
    state.turnsSinceEnding = 0;
    state.track = null;
    state.trackNumber = 0;
    state.skipRequested = false;
    state.pendingKey = null;
    state.pivot = null;
    state.running = false;
  }

  // Each row owns its pending swap: a bass change must not cancel a loading
  // lead. Selecting the current voice also cancels an older pending choice.
  const pendingVoices = { keys: null, lead: null, bass: null };
  const swapTokens = { keys: 0, lead: 0, bass: 0 };

  function swapVoice (kind, name) {
    const table = kind === 'keys' ? KEYS_VOICES : kind === 'bass' ? BASS_VOICES : LEAD_VOICES;
    if (! table[name] || pendingVoices[kind]?.name === name) return;
    const current = kind === 'keys' ? keys : kind === 'bass' ? bass : lead;
    const token = ++swapTokens[kind];
    pendingVoices[kind]?.dispose();
    pendingVoices[kind] = null;
    if (current.name === name) {
      state.onVoice?.(kind, name, true);
      return;
    }

    const next = { ...table[name](), name };
    pendingVoices[kind] = next;
    next.output.connect (instrumentBus);

    const commit = () => {
      if (token !== swapTokens[kind]) return;
      pendingVoices[kind] = null;
      if (kind === 'keys') keys = next;
      else if (kind === 'bass') bass = next;
      else lead = next;
      state[kind] = next.voice;
      state[kind + 'Voice'] = name;
      // Notes already scheduled on the outgoing voice may finish their bar.
      setTimeout (() => current.dispose(), 6500);
      state.onVoice?.(kind, name, true);
    };

    if (next.ready) {
      state.onVoice?.(kind, name, false);
      next.ready.then (commit).catch (error => {
        if (token !== swapTokens[kind]) return;
        pendingVoices[kind] = null;
        next.dispose();
        state.onVoice?.(kind, current.name, true);
        console.error ('could not load voice', error);
      });
    } else commit();
  }

  /** Retire every old scheduling timeline, including drum noise and crackle.
      Releasing a note or moving the transport cannot unschedule Web Audio
      events already handed to those sources. Fresh nodes can start now while
      the old bank fades out; decoded samples are shared between both. */
  function replaceInstruments (time) {
    const outgoing = [keys, lead, bass, drums, drone, pluck, support, vinyl];
    const oldBus = instrumentBus;
    const oldVinyl = vinyl;
    for (const kind of Object.keys (pendingVoices)) {
      swapTokens[kind]++;
      pendingVoices[kind]?.dispose();
      pendingVoices[kind] = null;
    }

    oldBus.gain.cancelAndHoldAtTime (time);
    oldBus.gain.linearRampToValueAtTime (0, time + 0.04);
    oldVinyl.level.gain.cancelAndHoldAtTime (time);
    oldVinyl.level.gain.linearRampToValueAtTime (0, time + 0.04);
    setTimeout (() => {
      outgoing.forEach (part => part.dispose());
      oldBus.dispose();
    }, Math.max (0, time - Tone.immediate() + 0.08) * 1000);

    keys = { ...KEYS_VOICES[state.keysVoice](), name: state.keysVoice };
    lead = { ...LEAD_VOICES[state.leadVoice](), name: state.leadVoice };
    bass = { ...BASS_VOICES[state.bassVoice](), name: state.bassVoice };
    drums = createDrums();
    drone = createDrone();
    support = { ...SUPPORT_VOICES.glockenspiel(), name: 'glockenspiel' };
    pluck = createPluck();
    vinyl = createVinyl();
    instrumentBus = new Tone.Gain (1).connect (chain.input);
    connectInstruments();
    Object.assign (state, {
      keys: keys.voice, lead: lead.voice, bass: bass.voice,
      drums, drone: drone.voice, support: support.voice, pluck: pluck.voice, vinyl
    });
    chain.sidechain.gain.cancelScheduledValues (time);
    chain.sidechain.gain.setValueAtTime (1, time + 0.04);
    applySettings();
    if (state.running) vinyl.hiss.start (time + 0.06);
  }

  const controls = {
    tempo (value) {
      state.tempoUser = clampTempo (value);
      state.tempo = clampTempo (state.tempoUser + (state.track?.tempoOffset ?? 0) * state.arcDepth);
      setTempo (state.tempo, 0.4);
    },

    swing (value) { state.user.swing = value; applySettings(); },
    density (value) { state.user.density = value; scoreDirty = true; applySettings(); },
    counter (value) { state.user.counter = value; scoreDirty = true; applySettings(); },
    ornament (value) { state.user.ornament = value; scoreDirty = true; applySettings(); },
    drone (value) { state.user.drone = value; scoreDirty = true; applySettings(); },
    support (value) { state.user.support = value; scoreDirty = true; applySettings(); },
    brightness (value) { state.user.brightness = value; applySettings(); },
    dust (value) { state.user.dust = value; scoreDirty = true; applySettings(); },
    wobble (value) { state.user.wobble = value; applySettings(); },
    space (value) { state.user.space = value; applySettings(); },
    drive (value) { state.user.drive = value; applySettings(); },
    pump (value) { state.user.pump = value; applySettings(); },

    volume (value) {
      chain.master.gain.rampTo (value, 0.2);
    },

    /** How far the machine may wander from where the knobs are set — both the
        long energy arc and each track's own character. At zero it does not. */
    arc (value) {
      state.arcDepth = value;
      scoreDirty = true;
      applySettings();
    },

    /** A short fade, then the first bar of a new track. No old queued notes
        are reused. */
    skip () {
      if (! state.running || state.skipRequested) return;
      setReplayPending (null);
      state.skipRequested = true;
      playbackTimeline.reset();
      state.resting = 0;
      state.endingSet = false;
      const time = Tone.now();
      const transport = Tone.getTransport();
      if (scheduleId !== null) transport.clear (scheduleId);
      transport.stop (time);
      Tone.getDraw().cancel (Tone.immediate());
      restartTime = time;
      try {
        replaceInstruments (time);
        // Schedule the first bar explicitly. A repeat registered while the
        // clock is stopping can miss tick zero and wait a full bar to fire.
        onBar (time + 0.06);
      } finally {
        restartTime = null;
      }
      eighthsUntilBar = meterInfo (state.meter).eighths - 1;
      scheduleId = transport.scheduleRepeat (onEighth, '8n', '8n');
      transport.start (time + 0.06, 0);
    },

    key (noteName) {
      state.rootMidi = noteNameToMidi (noteName + '3');
      scoreEdits.rootMidi = state.rootMidi;
      scoreDirty = true;
    },

    scale (name) {
      state.scale = name;

      // Each mode has its own progressions, because the chords that define a
      // mode only exist in that mode.
      const set = progressionsFor (state.tradition, name);
      state.progression = set[Math.floor (Math.random() * set.length)];
      state.previousVoicing = null;
      if (state.track) {
        state.track.progression = state.progression;
        state.track.phrases = null;
      }

      scoreEdits.scale = name;
      scoreEdits.progression = state.progression;
      scoreDirty = true;
    },

    keysVoice (name) {
      swapVoice ('keys', name);
    },

    bassVoice (name) {
      swapVoice ('bass', name);
    },

    leadVoice (name) {
      swapVoice ('lead', name);
    }
  };

  async function replay () {
    if (! lastComposition) return false;
    // One repeat at the next track boundary. A second press cancels it;
    // neither action changes the transport or any already scheduled notes.
    if (state.running) {
      setReplayPending (replayPending ? null : structuredClone (lastComposition));
    } else {
      setReplayPending (structuredClone (lastComposition));
      try { await start(); }
      catch (error) { setReplayPending (null); throw error; }
    }
    return true;
  }

  function getComposition () {
    return lastComposition ? structuredClone (lastComposition) : null;
  }

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

  return { state, controls, start, stop, chain, analyser, getLevel, getSpectrum, replay,
    isReplayQueued: () => Boolean (replayPending),
    getTrackTime: () => playbackTimeline.readClock (Tone.immediate()),
    getTempo: () => Tone.getTransport().bpm.getValueAtTime (Tone.immediate()) / meterInfo (state.meter).pulseBeats,
    getComposition, getPlayback: () => playbackTimeline.read (Tone.immediate()) };
}
