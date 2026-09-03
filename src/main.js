// Builds the panel and wires it to the engine. The control tables below are
// the whole interface — add a row and the knob appears, already connected.

import { createEngine } from './engine.js';
import { createKnob } from './knob.js';
import { createMeter } from './meter.js';
import { createPianoRoll } from './piano-roll.js';
import { NOTE_NAMES } from './theory.js';

const engine = createEngine();
createPianoRoll (document.getElementById ('pianoRoll'), engine.getPlayback);

// Handy from the browser console for poking at the running graph:
// lofi.controls.dust(0.9), lofi.state.progression, and so on.
if (import.meta.env.DEV) window.lofi = engine;

const MUSIC_KNOBS = [
  { id: 'tempo', label: 'tempo', min: 55, max: 95, step: 1, value: 72,
    format: v => `${Math.round (v)} bpm` },
  { id: 'swing', label: 'swing', min: 0, max: 0.6, step: 0.01, value: 0.28 },
  { id: 'density', label: 'density', min: 0, max: 1, step: 0.01, value: 0.5 },
  { id: 'counter', label: 'counter', min: 0, max: 1, step: 0.01, value: 0.55 },
  { id: 'ornament', label: 'cuts', min: 0, max: 1, step: 0.01, value: 0.6 },
  { id: 'drone', label: 'drone', min: 0, max: 1, step: 0.01, value: 0.25 },
  { id: 'arc', label: 'arc', min: 0, max: 1, step: 0.01, value: 0.5 }
];

const TONE_KNOBS = [
  { id: 'brightness', label: 'tone', min: 0, max: 1, step: 0.01, value: 0.29 },
  { id: 'dust', label: 'dust', min: 0, max: 1, step: 0.01, value: 0.3 },
  { id: 'wobble', label: 'wobble', min: 0, max: 1, step: 0.01, value: 0.27 },
  { id: 'drive', label: 'drive', min: 0, max: 1, step: 0.01, value: 0.3 },
  { id: 'space', label: 'space', min: 0, max: 1, step: 0.01, value: 0.28 },
  { id: 'pump', label: 'pump', min: 0, max: 1, step: 0.01, value: 0.35 },
  { id: 'volume', label: 'level', min: 0, max: 1, step: 0.01, value: 0.9 }
];

// Dorian first: that raised sixth over a minor third is the sound of a great
// many Irish and Scottish tunes, so it is the right thing to hear on load.
const MODES = ['dorian', 'minor', 'mixolydian', 'major'];

function mountKnobs (definitions, container) {
  for (const definition of definitions) {
    const knob = createKnob ({
      ...definition,
      onChange: value => engine.controls[definition.id]?.(value)
    });

    container.append (knob.element);
    engine.controls[definition.id]?.(definition.value);
  }
}

mountKnobs (MUSIC_KNOBS, document.getElementById ('musicKnobs'));
mountKnobs (TONE_KNOBS, document.getElementById ('toneKnobs'));

/** A row of latching buttons behaving as one radio group. Returns a `select`
    so the panel can follow a change the engine made on its own. */
function mountChooser (container, options, initial, className, onSelect) {
  const buttons = options.map (option => {
    const button = document.createElement ('button');
    button.type = 'button';
    button.className = className;
    button.textContent = option;
    button.setAttribute ('role', 'radio');
    button.setAttribute ('aria-checked', String (option === initial));

    button.addEventListener ('click', () => {
      buttons.forEach (b => b.setAttribute ('aria-checked', String (b === button)));
      onSelect (option);
    });

    container.append (button);
    return button;
  });

  onSelect (initial);

  return {
    select (value) {
      buttons.forEach (b => b.setAttribute ('aria-checked', String (b.textContent === value)));
    }
  };
}

const keyChooser = mountChooser (document.getElementById ('keyRow'), NOTE_NAMES, 'C', 'key',
  value => engine.controls.key (value));

const scaleChooser = mountChooser (document.getElementById ('scaleRow'), MODES, 'dorian', 'seg',
  value => engine.controls.scale (value));

// Between tunes the engine can move to a related key. The panel has to follow
// it, or the buttons quietly stop describing what is playing.
engine.state.onKey = (note, scale) => {
  keyChooser.select (note);
  scaleChooser.select (scale);
};

const voiceRows = {
  lead: { id: 'leadVoiceRow', autoFlag: 'autoVoice' },
  keys: { id: 'keysVoiceRow', autoFlag: 'autoKeysVoice' },
  bass: { id: 'bassVoiceRow', autoFlag: 'autoBassVoice' }
};

function showVoice (kind) {
  const { id, autoFlag } = voiceRows[kind];
  document.getElementById (id).querySelectorAll ('.seg').forEach (button => {
    const playing = engine.state[autoFlag] && button.textContent === engine.state[kind + 'Voice'];
    button.classList.toggle ('auto-pick', playing);
    button.setAttribute ('aria-label', button.textContent + (playing ? ' (playing automatically)' : ''));
  });
}

// Auto chooses a new sound for each track and at arrangement changes.
// Picking a voice by hand pins it until the listener chooses auto again.
function mountVoiceChooser (id, names, initial, apply, autoFlag) {
  const kind = id.replace ('VoiceRow', '');
  mountChooser (document.getElementById (id), ['auto', ...names], initial, 'seg',
    value => {
      engine.state[autoFlag] = value === 'auto';
      if (value !== 'auto') apply (value);
      showVoice (kind);
    });
}

mountVoiceChooser ('leadVoiceRow',
  ['vibraphone', 'marimba', 'piano', 'harp', 'harp (synth)', 'whistle'],
  'auto', value => engine.controls.leadVoice (value), 'autoVoice');

mountVoiceChooser ('keysVoiceRow',
  ['rhodes', 'felt', 'piano', 'pad'],
  'auto', value => engine.controls.keysVoice (value), 'autoKeysVoice');

mountVoiceChooser ('bassVoiceRow',
  ['round', 'upright', 'sub', 'electric'],
  'auto', value => engine.controls.bassVoice (value), 'autoBassVoice');

const meter = createMeter();
document.getElementById ('meterSlot').append (meter.element);

// The canvas is sized from its laid-out box, so it has to be measured after
// it is in the document and again whenever the layout changes.
requestAnimationFrame (() => { meter.refresh(); meter.reset(); });
window.addEventListener ('resize', () => meter.refresh());

// ------------------------------------------------------------------ transport

const playButton = document.getElementById ('playButton');
const playText = playButton.querySelector ('.power-text');
const status = document.getElementById ('status');
const barReadout = document.getElementById ('barReadout');
const progressionReadout = document.getElementById ('progressionReadout');
const trackLabel = document.getElementById ('trackLabel');
const trackTitle = document.getElementById ('trackTitle');
const trackNumber = document.getElementById ('trackNumber');
const pageTitle = document.title;

engine.state.onTrack = ({ title, number }) => {
  trackLabel.textContent = 'now playing';
  trackTitle.textContent = title;
  trackNumber.textContent = `track ${String (number).padStart (3, '0')}`;
  document.title = `${title} · Lofi Ceoil`;
  updateScoreSummary();
};


// Several rows may load at once. Completing one must not hide the others.
const loadingVoices = new Map();
engine.state.onVoice = (kind, name, ready) => {
  if (ready) loadingVoices.delete (kind);
  else loadingVoices.set (kind, name);
  status.textContent = loadingVoices.size
    ? `loading ${[...loadingVoices.values()].join (', ')}`
    : engine.state.running ? 'running' : 'standby';
  showVoice (kind);
};

engine.state.onBar = (bar, progressionName) => {
  barReadout.textContent = String (bar + 1).padStart (3, '0');
  progressionReadout.textContent = progressionName;
  updateScoreSummary();
};

let meterFrame = null;

function driveMeter () {
  meter.update (engine.getSpectrum());
  meterFrame = requestAnimationFrame (driveMeter);
}

function stopMeter () {
  if (meterFrame !== null) cancelAnimationFrame (meterFrame);
  meterFrame = null;
  meter.reset();
}

playButton.addEventListener ('click', async () => {
  if (engine.state.running) {
    engine.stop();
    stopMeter();

    document.body.classList.remove ('running');
    playText.textContent = 'start';
    status.textContent = 'standby';
    barReadout.textContent = '000';
    progressionReadout.textContent = '—';
    trackLabel.textContent = 'on the air soon';
    trackTitle.textContent = 'press start, stay awhile';
    trackNumber.textContent = '';
    document.title = pageTitle;
    return;
  }

  playButton.disabled = true;
  replayButton.disabled = true;
  status.textContent = 'loading';

  try {
    await engine.start();

    document.body.classList.add ('running');
    playText.textContent = 'stop';
    status.textContent = 'running';
    driveMeter();
  } catch (error) {
    status.textContent = 'fault';
    console.error ('could not start', error);
  } finally {
    playButton.disabled = false;
    replayButton.disabled = ! engine.getComposition();
  }
});

const skipButton = document.getElementById ('skipButton');

skipButton.addEventListener ('click', () => {
  if (! engine.state.running) return;

  engine.controls.skip();
  status.textContent = 'new track';
  setTimeout (() => { if (engine.state.running) status.textContent = 'running'; }, 1400);
});

const replayButton = document.getElementById ('replayButton');
const saveScoreButton = document.getElementById ('saveScoreButton');
const scoreSummary = document.getElementById ('scoreSummary');

function updateScoreSummary () {
  const score = engine.state.track?.composition;
  if (! score) return;
  replayButton.disabled = false;
  saveScoreButton.disabled = false;
  const edit = score.revisions?.length ? ' · edited' : '';
  scoreSummary.textContent = `${score.barCount} bars · ${score.recipe.structure.sections.join ('')} · ${score.turns.length} turns${edit}`;
}

replayButton.addEventListener ('click', async () => {
  replayButton.disabled = true;
  playButton.disabled = true;
  try {
    if (await engine.replay()) {
      stopMeter();
      document.body.classList.add ('running');
      playText.textContent = 'stop';
      status.textContent = 'running';
      driveMeter();
    }
  } catch (error) {
    status.textContent = 'could not replay';
    console.error ('could not replay', error);
  } finally {
    replayButton.disabled = false;
    playButton.disabled = false;
  }
});

saveScoreButton.addEventListener ('click', () => {
  const score = engine.getComposition();
  if (! score) return;
  const blob = new Blob ([JSON.stringify (score)], { type: 'application/json' });
  const url = URL.createObjectURL (blob);
  const link = document.createElement ('a');
  link.href = url;
  link.download = `${score.recipe.title.replace (/[^a-z0-9]+/gi, '-').replace (/^-|-$/g, '') || 'lofi-ceoil'}-score.json`;
  link.click();
  setTimeout (() => URL.revokeObjectURL (url), 1000);
});

// Space toggles transport, the way it does on anything that plays audio.
document.addEventListener ('keydown', event => {
  if (event.code !== 'Space') return;
  if (event.target.closest ('button, select, input, [role="slider"]')) return;

  event.preventDefault();
  playButton.click();
});
