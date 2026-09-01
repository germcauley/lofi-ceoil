// Builds the panel and wires it to the engine. The control tables below are
// the whole interface — add a row and the knob appears, already connected.

import { createEngine } from './engine.js';
import { createKnob } from './knob.js';
import { createMeter } from './meter.js';
import { NOTE_NAMES } from './theory.js';

const engine = createEngine();

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
  { id: 'drone', label: 'drone', min: 0, max: 1, step: 0.01, value: 0.25 }
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

/** A row of latching buttons behaving as one radio group. */
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
}

mountChooser (document.getElementById ('keyRow'), NOTE_NAMES, 'C', 'key',
  value => engine.controls.key (value));

mountChooser (document.getElementById ('scaleRow'), MODES, 'dorian', 'seg',
  value => engine.controls.scale (value));

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

engine.state.onBar = (bar, progressionName) => {
  barReadout.textContent = String (bar + 1).padStart (3, '0');
  progressionReadout.textContent = progressionName;
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
    return;
  }

  playButton.disabled = true;
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
  }
});

// Space toggles transport, the way it does on anything that plays audio.
document.addEventListener ('keydown', event => {
  if (event.code !== 'Space') return;
  if (event.target.closest ('button, select, input, [role="slider"]')) return;

  event.preventDefault();
  playButton.click();
});
