// Ties the pieces together: builds the audio graph, holds the live state that
// the knobs write into, and drives the bar-by-bar scheduling.

import * as Tone from 'tone';
import { KEYS_VOICES, LEAD_VOICES, BASS_VOICES, createDrums, createDrone, createPluck, createVinyl } from './instruments.js';

const LEAD_VOICE_NAMES = Object.keys (LEAD_VOICES);
const KEYS_VOICE_NAMES = Object.keys (KEYS_VOICES);
const BASS_VOICE_NAMES = Object.keys (BASS_VOICES);
import { createChain } from './effects.js';
import { PROGRESSIONS, NOTE_NAMES, noteNameToMidi, findPivot } from './theory.js';
import { createMotif, developPhrase, gappedPool, planCounter } from './melody.js';
import { playChord, playBass, playDrums, playMelody, playCounter, playDrone, playVinyl, BASS_PATTERN_NAMES, COMP_PATTERN_NAMES } from './parts.js';

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

  let bass = BASS_VOICES.round();
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
    bassVoice: 'round',

    // When true, the arrangement chooses these voices itself.
    autoVoice: false,
    autoKeysVoice: false,
    autoBassVoice: false,

    // Notified when a voice swap starts and when it is ready to play.
    onVoice: null,

    rootMidi: noteNameToMidi ('C3'),
    scale: 'dorian',
    tempo: 72,
    tempoUser: 72,

    // A track: one tune, held for several turns. Its motifs are its identity.
    track: null,
    trackNumber: 0,
    // The user's settings, and the values actually in force. The energy arc
    // scales the user's numbers rather than replacing them, so a knob still
    // means what it says — it sets the centre the arc swings around.
    density: 0.5,
    densityUser: 0.5,
    counterUser: 0.55,
    brightnessUser: 0.29,

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

    // Four four-bar phrases played as AABB. Rebuilt every sixteen bars.
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
  // Backings sorted by how much they drive, so the arc can reach for a quiet
  // one low down and a busy one at the peak.
  const CALM_COMPS = ['sustain', 'stab', 'offbeat', 'suspension'];
  const DRIVING_COMPS = ['bouzouki', 'boomChuck', 'anticipate', 'offbeat'];
  const CALM_BASS = ['held', 'root', 'sparse'];
  const DRIVING_BASS = ['walk', 'octave', 'anticipate', 'rootFifth'];

  function buildArrangement () {
    // The arc reaches the arrangement, not only the knobs. A quiet stretch is
    // quiet because parts are absent, not merely because they are turned down.
    const energy = state.arcDepth > 0 ? state.energy : 0.5;

    // Low down, a turn is much likelier to open with the tune alone.
    const openBare = Math.random() < 0.45 + (0.5 - energy) * 0.5;

    return [0, 1, 2, 3].map (part => {
      const first = part === 0;
      const last = part === 3;

      // At the bottom of an arc the drums can sit out a part entirely; at the
      // top they are always there.
      const drumsSitOut = Math.random() > 0.25 + energy * 0.8;

      const bassPool = energy > 0.5 ? DRIVING_BASS : CALM_BASS;
      const compPool = energy > 0.5 ? DRIVING_COMPS : CALM_COMPS;

      return {
        bass: first && openBare ? 'none' : pickFrom (bassPool),
        chordsFrom: first && openBare ? 2 : 0,
        // 8 means the layer never arrives in this part.
        drumsFrom: (first && openBare) || drumsSitOut ? 8 : (first ? 4 : 0),
        // Pulling the drums before the end of the last part lets the turn
        // breathe instead of stopping dead.
        drumsUntil: last ? 6 : 8,
        counter: ! (first && openBare),

        // A bar with no harmony at all, borrowed from jacbz/Lofi, where an
        // empty chord also drops the drumbeat. The closing bar is the place
        // for it: the tune lands on its cadence with everything else out of
        // the way, which is a structural rest rather than a quiet moment.
        emptyBar: Math.random() < 0.35 ? 7 : -1,

        comp: pickFrom (compPool),

        // Harmonic rhythm. The A part often holds each chord for two bars and
        // the B part moves every bar, so the turn speeds up as it goes.
        // Changing the *rate* of harmonic change is a structural device, and
        // one the piece had none of.
        chordHold: part < 2 ? (Math.random() < 0.6 ? 2 : 1) : 1
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
    let bassName = state.bassVoice;

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

      // The bass moves least often of the three. It is the foundation, and a
      // foundation that keeps changing is not one.
      if (followsADrop && Math.random() < 0.25) {
        bassName = pickFrom (BASS_VOICE_NAMES.filter (name => name !== bassName));
      }

      part.leadVoice = lead;
      part.keysVoice = keysName;
      part.bassVoice = bassName;
    });

    return arrangement;
  }

  /** Occasionally the tune should stop rather than roll on forever — a DJ
      finishing a set rather than beat-matching another record.

      Kept rare and never back to back: the effect only works if it is not
      expected, and a generative piece that keeps pausing is worse than one
      that never does. */
  function planSetEnding () {
    state.turnsSinceEnding++;

    // Only ever at the end of a track. A set ending mid-tune would cut the
    // tune off rather than finish it.
    const trackEnding = state.track && state.track.turnsLeft <= 0;

    if (trackEnding && state.turnsSinceEnding >= 4 && Math.random() < 0.4) {
      state.endingSet = true;
      state.turnsSinceEnding = 0;
    }
  }

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

  /** Sets up a modulation, finding a chord that belongs to both keys.

      With a pivot the change happens inside the music: the ear hears the chord
      in the old key and then finds it has been in the new one all along.
      Without one — the keys share nothing — it falls back to a plain change,
      which is why the pivot is optional rather than required. */
  function beginModulation () {
    const target = chooseTargetKey();
    const pivot = findPivot (state.rootMidi, state.scale, target.root, target.scale);

    state.pendingKey = target;
    state.pivot = pivot ? [pivot.fromDegree, pivot.quality] : null;

    return pivot;
  }

  function applyPendingKey () {
    if (! state.pendingKey) return;

    state.rootMidi = state.pendingKey.root;
    state.scale = state.pendingKey.scale;
    state.pendingKey = null;
    state.pivot = null;

    const set = PROGRESSIONS[state.scale] ?? PROGRESSIONS.minor;
    state.progression = set[Math.floor (Math.random() * set.length)];
    state.previousVoicing = null;
    state.form = null;

    if (state.onKey) {
      const name = NOTE_NAMES[state.rootMidi % 12];
      Tone.getDraw().schedule (() => state.onKey (name, state.scale), Tone.now());
    }
  }

  // Shapes an arc can take across several turns. A generative piece that holds
  // one intensity forever is the long-form version of the random walk problem:
  // nothing is being stated, so nothing develops. These are stated shapes.
  const ARC_SHAPES = {
    // Rise to a peak about two thirds through, then fall away. Written as two
    // quarter-waves rather than one sine, so the tail descends across the last
    // third instead of flattening to nothing early and staying there.
    swell:   t => t < 0.68
      ? Math.sin (Math.PI * 0.5 * (t / 0.68))
      : Math.cos (Math.PI * 0.5 * ((t - 0.68) / 0.32)),
    // Climb the whole way and end at the top.
    build:   t => t,
    // Begin high and recede.
    ebb:     t => 1 - t,
    // Rise, hold, release.
    plateau: t => t < 0.3 ? t / 0.3 : t < 0.7 ? 1 : (1 - t) / 0.3
  };

  // Energy never reaches zero. At the very bottom the drums would sit out
  // three parts in four and the density multiplier would collapse — a trough
  // should be sparse, not absent.
  const ENERGY_FLOOR = 0.12;

  const ARC_SHAPE_NAMES = Object.keys (ARC_SHAPES);

  function planArc () {
    state.arcShape = pickFrom (ARC_SHAPE_NAMES);
    // Six to eleven turns is roughly ten to twenty minutes, which is the scale
    // at which a listener notices a piece going somewhere.
    state.arcLength = 6 + Math.floor (Math.random() * 6);
    state.arcTurn = 0;
  }

  /** Advances the arc by a turn and applies its energy.

      Energy scales what the knobs are set to rather than overriding them: a
      density of 0.5 becomes a journey between roughly 0.3 and 0.7 rather than
      sitting at 0.5 forever. At arc depth zero nothing moves and the knobs mean
      exactly what they say. */
  function advanceArc () {
    if (state.arcTurn >= state.arcLength) planArc();

    const through = state.arcLength > 1 ? state.arcTurn / (state.arcLength - 1) : 0.5;
    const shape = ARC_SHAPES[state.arcShape] ?? ARC_SHAPES.swell;

    const raw = Math.max (0, Math.min (1, shape (Math.min (1, through))));
    state.energy = ENERGY_FLOOR + raw * (1 - ENERGY_FLOOR);
    state.arcTurn++;

    const swing = (state.energy - 0.5) * 2 * state.arcDepth;

    state.density = clamp01 (state.densityUser * (1 + swing * 0.5));
    state.counter = clamp01 (state.counterUser * (1 + swing * 0.5));

    // Brightness opens as the arc rises, which is most of why a build feels
    // like a build.
    const brightness = clamp01 (state.brightnessUser + swing * 0.22);
    chain.tone.frequency.rampTo (400 + brightness * 7600, 2);
  }

  const clamp01 = value => Math.max (0, Math.min (1, value));

  /** Starts a new track: new material, a new tempo, and a fresh run of turns.

      Until now the motifs were rebuilt every turn, so the tune changed every
      thirty-two bars and never settled — there was no track to recognise. A
      track holds its material for two to four turns, which is a tune played
      several times through, exactly as a set does. Everything else keeps
      moving underneath: the arrangement, the energy arc, the voices and the
      counter textures. */
  function startTrack () {
    const size = gappedPool (state.scale).length;

    state.trackNumber++;
    state.track = {
      motifA: createMotif(),
      motifB: createMotif(),
      // Each track sits a few beats either side of where the tempo knob is
      // set, so a set does not run at one speed all night.
      tempoOffset: Math.round ((Math.random() - 0.5) * 8),
      turnsLeft: 2 + Math.floor (Math.random() * 3),
      size
    };

    const tempo = Math.max (50, Math.min (100, state.tempoUser + state.track.tempoOffset));
    state.tempo = tempo;
    Tone.getTransport().bpm.rampTo (tempo, 4);

    return state.track;
  }

  function buildForm () {
    // A track keeps its material until its turns run out. Rebuilding the
    // motifs every turn is what stopped the tune ever settling.
    if (! state.track || state.track.turnsLeft <= 0
        || state.track.size !== gappedPool (state.scale).length) {
      startTrack();
    }

    state.track.turnsLeft--;

    const size = state.track.size;
    const motifA = state.track.motifA;
    const motifB = state.track.motifB;

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
    planSetEnding();
    advanceArc();

    // A modal shift keeps the tonic and changes only the mode. Nothing moves
    // and everything recolours, which makes it the least disruptive way to
    // change the light on a piece — and the only structural move available
    // without ending the tune.
    if (! state.endingSet && ! state.pendingKey && state.barIndex > 0 && Math.random() < 0.1) {
      const others = MODES.filter (mode => mode !== state.scale);
      state.scale = pickFrom (others);

      const set = PROGRESSIONS[state.scale] ?? PROGRESSIONS.minor;
      state.progression = set[Math.floor (Math.random() * set.length)];
      state.previousVoicing = null;

      if (state.onKey) {
        const name = NOTE_NAMES[state.rootMidi % 12];
        Tone.getDraw().schedule (() => state.onKey (name, state.scale), Tone.now());
      }
    }
    state.counterPlans = [planA, planCounter (phrases[1]), planB, planCounter (phrases[3])];
    state.counterPlans[1].pattern = planA.pattern;
    state.counterPlans[3].pattern = planB.pattern;
  }

  function scheduleBar (time) {
    // Between tunes: nothing but the record surface. The bar count keeps
    // running so the transport never stops, but the form is held.
    if (state.resting > 0) {
      playVinyl (state, time);
      state.resting--;

      if (state.resting === 0) {
        Tone.getTransport().bpm.rampTo (state.tempo, 2.5);
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

    // Four eight-bar parts: A A B B, so a full turn of the tune is 32 bars.
    const positionInForm = (state.barIndex - state.formOffset) % 32;

    // A mid-flight modulation lands at the top of a turn, and must be applied
    // before the form is built — otherwise the phrases are written for the key
    // we are leaving and then played in the one we arrived at.
    if (positionInForm === 0 && state.pendingKey && ! state.endingSet) applyPendingKey();

    if (! state.form || positionInForm === 0) buildForm();

    const phrase = state.form[Math.floor (positionInForm / 8)];

    const partIndex = Math.floor (positionInForm / 8);
    const barInPart = positionInForm % 8;
    const plan = state.arrangement?.[partIndex] ?? {};

    // The chord cycle is indexed against position in the part, not the absolute
    // bar count. Counting bars meant the harmony drifted out of step with the
    // form — a pause between tunes advanced the count but not the music, so a
    // tune could resume on its subdominant rather than at home. Every part now
    // begins on the progression's first chord.
    const chords = state.progression.chords;

    // A long progression has to move every bar or it would never finish inside
    // a part — the canon is eight chords across eight bars.
    const hold = chords.length >= 6 ? 1 : (plan.chordHold ?? 1);
    const chordIndex = Math.floor (barInPart / hold) % chords.length;

    // A pivot chord replaces the progression for the bars that carry a
    // modulation. It belongs to both keys, so it is the seam.
    const chordSpec = state.pivot ?? chords[chordIndex];

    // Voice changes land on the part boundary, never mid-phrase.
    if (barInPart === 0) {
      if (state.autoVoice && plan.leadVoice) swapVoice ('lead', plan.leadVoice);
      if (state.autoKeysVoice && plan.keysVoice) swapVoice ('keys', plan.keysVoice);
      if (state.autoBassVoice && plan.bassVoice) swapVoice ('bass', plan.bassVoice);
    }

    // Winding down to end the set: the last part sheds its layers a bar at a
    // time and the tempo eases off, so the tune arrives at a stop rather than
    // being cut off at one.
    const winding = state.endingSet && partIndex === 3;

    if (winding && barInPart === 4) {
      const barSeconds = (60 / state.tempo) * 4;
      Tone.getTransport().bpm.rampTo (state.tempo * 0.82, barSeconds * 4);

      // Decide where the next tune is going now, so the last bars can lean on
      // a chord shared with it.
      beginModulation();
    }

    // Occasionally a tune modulates without stopping — the pivot lands on the
    // turn's last bar and the new key begins on the next one. Rarer than a set
    // ending, because a modulation nobody was expecting should be a surprise
    // rather than a habit.
    if (! winding && ! state.pendingKey && positionInForm === 31
        && state.turnsSinceEnding >= 2 && Math.random() < 0.12) {
      if (! beginModulation()) {
        // No shared chord, so there is no seam to hide the change in. Leave it.
        state.pendingKey = null;
        state.pivot = null;
      }
    }


    if (winding && barInPart === 7) {
      // Two to four bars of nothing but crackle before the next tune.
      state.resting = 2 + Math.floor (Math.random() * 3);
      state.endingSet = false;
    }

    // An empty bar drops everything but the tune, the drone and the surface
    // noise — so the melody's cadence is heard on its own.
    const empty = barInPart === plan.emptyBar
      || (winding && barInPart === 7);

    if (! empty && barInPart >= (plan.chordsFrom ?? 0)) {
      // A chord being held across bars is struck once, at its start — striking
      // it again each bar would undo the point of holding it.
      const struckThisBar = hold === 1 || barInPart % hold === 0;
      if (struckThisBar) playChord (state, time, chordSpec, plan.comp);
    }
    const bassWound = winding && barInPart >= 6;

    if (! empty && ! bassWound && plan.bass && plan.bass !== 'none') {
      playBass (state, time, chordSpec, plan.bass);
    }

    const drumsWound = winding && barInPart >= 5;

    if (! empty && ! drumsWound
        && barInPart >= (plan.drumsFrom ?? 0) && barInPart < (plan.drumsUntil ?? 8)) {
      playDrums (state, time);
    }

    playMelody (state, time, barInPart, phrase, chordSpec);

    if (! empty && ! (winding && barInPart >= 6) && plan.counter !== false) {
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
      const arc = state.arcDepth > 0
        ? ` · ${state.arcShape} ${Math.round (state.energy * 100)}%`
        : '';

      Tone.getDraw().schedule (
        () => state.onBar (bar, state.progression.name + (texture ? ' · ' + texture : '') + arc),
        time);
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
    state.formOffset = 0;
    state.previousVoicing = null;
    state.arrangement = null;
    state.endingSet = false;
    state.resting = 0;
    state.turnsSinceEnding = 0;
    state.track = null;
    state.trackNumber = 0;
    state.pendingKey = null;
    state.pivot = null;
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
    const table = kind === 'keys' ? KEYS_VOICES : kind === 'bass' ? BASS_VOICES : LEAD_VOICES;
    const factory = table[name];
    if (! factory) return;

    const current = kind === 'keys' ? keys : kind === 'bass' ? bass : lead;
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
      } else if (kind === 'bass') {
        bass = next;
        state.bass = next.voice;
        state.bassVoice = name;
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
      state.tempoUser = value;
      state.tempo = Math.max (50, Math.min (100, value + (state.track?.tempoOffset ?? 0)));
      Tone.getTransport().bpm.rampTo (state.tempo, 0.4);
    },

    swing (value) {
      Tone.getTransport().swing = value;
    },

    density (value) {
      state.densityUser = value;
      state.density = value;
    },

    brightness (value) {
      // 400 Hz is muffled to the point of underwater, 8 kHz is nearly open.
      state.brightnessUser = value;
      chain.tone.frequency.rampTo (400 + value * 7600, 0.25);
    },

    arc (value) {
      state.arcDepth = value;
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
      state.counterUser = value;
      state.counter = value;
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
