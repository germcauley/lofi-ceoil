// Pixel rendering is deliberately separate from audio and composition.
// It reads a score and the scheduler's clock; it never schedules a note.
const FAMILIES = {
  lead: { label: 'lead', colour: '#ffdc87', symbol: '♪' },
  keys: { label: 'keys', colour: '#78ddd0', symbol: '▥' },
  bass: { label: 'bass', colour: '#bda0ff', symbol: '▰' },
  pluck: { label: 'counter', colour: '#ff9fc4', symbol: '◇' },
  drone: { label: 'drone', colour: '#8facf9', symbol: '≋' },
  drums: { label: 'drums', colour: '#ecad83', symbol: '▪' }
};
const DRUMS = ['kick', 'snare', 'ghost', 'hat'];
const familyOf = role => DRUMS.includes (role) ? 'drums' : role;
const laneOf = role => role === 'kick' ? 0 : role === 'hat' ? 2 : 1;
const PREF_KEY = 'lofi-ceoil.piano-roll.v1';

export function rollWindow (beat, scrolling) {
  const start = scrolling ? beat - 8 : Math.floor (beat / 32) * 32;
  return { start, end: start + 32 };
}

export function createPianoRoll (element, getPlayback) {
  const canvas = element.querySelector ('canvas');
  const ctx = canvas.getContext ('2d');
  const directionButtons = [...element.querySelectorAll ('[data-direction]')];
  const motionButton = element.querySelector ('#rollMotion');
  const legend = element.querySelector ('#rollLegend');
  const sections = element.querySelector ('#rollSections');
  const readout = element.querySelector ('#rollReadout');
  const reducedMotion = matchMedia ('(prefers-reduced-motion: reduce)');
  let preferences = {};
  try { preferences = JSON.parse (localStorage.getItem (PREF_KEY) ?? '{}') ?? {}; } catch {}
  let direction = preferences.direction === 'vertical' ? 'vertical' : 'horizontal';
  let scrolling = typeof preferences.scrolling === 'boolean' ? preferences.scrolling : ! reducedMotion.matches;
  const hidden = new Set();
  let score = null, pitchLow = 36, pitchHigh = 96;
  let frame = null, lastFrame = 0, lastStaticBar = -1, lastReadout = '';
  let width = 1, height = 1;
  const legendButtons = new Map();

  function savePreferences () {
    try { localStorage.setItem (PREF_KEY, JSON.stringify ({ direction, scrolling })); } catch {}
  }
  function updateControls () {
    element.dataset.direction = direction;
    for (const button of directionButtons) button.setAttribute ('aria-pressed', String (button.dataset.direction === direction));
    motionButton.setAttribute ('aria-pressed', String (scrolling));
    motionButton.textContent = scrolling ? 'scroll on' : 'still view';
    canvas.setAttribute ('aria-label', `Piano roll. ${direction === 'horizontal' ? 'Time runs left to right; pitch rises upward.' : 'Notes fall toward the playhead; pitch rises from left to right.'}`);
    lastStaticBar = -1;
  }
  function resize () {
    // One logical pixel occupies two CSS pixels, with no smoothing or blur.
    width = Math.max (1, Math.floor (canvas.clientWidth / 2));
    height = Math.max (1, Math.floor (canvas.clientHeight / 2));
    canvas.width = width;
    canvas.height = height;
    ctx.imageSmoothingEnabled = false;
    draw (getPlayback());
  }
  for (const button of directionButtons) button.addEventListener ('click', () => {
    direction = button.dataset.direction;
    updateControls(); savePreferences(); resize();
  });
  motionButton.addEventListener ('click', () => {
    scrolling = ! scrolling;
    updateControls(); savePreferences(); draw (getPlayback());
  });
  reducedMotion.addEventListener ('change', () => {
    scrolling = ! reducedMotion.matches;
    updateControls(); savePreferences(); draw (getPlayback());
  });
  for (const [role, family] of Object.entries (FAMILIES)) {
    const button = document.createElement ('button');
    button.type = 'button';
    button.className = 'roll-instrument';
    button.dataset.instrument = role;
    button.style.setProperty ('--voice-colour', family.colour);
    button.setAttribute ('aria-pressed', 'true');
    button.title = `Show or hide ${family.label} notes. This does not mute the sound.`;
    const icon = document.createElement ('span');
    icon.className = 'roll-icon'; icon.textContent = family.symbol; icon.setAttribute ('aria-hidden', 'true');
    const label = document.createElement ('span'); label.textContent = family.label;
    const voice = document.createElement ('small');
    button.append (icon, label, voice);
    button.addEventListener ('click', () => {
      if (hidden.has (role)) hidden.delete (role); else hidden.add (role);
      button.setAttribute ('aria-pressed', String (! hidden.has (role)));
      draw (getPlayback());
    });
    legend.append (button);
    legendButtons.set (role, { button, voice });
  }

  function prepareScore (next) {
    score = next;
    sections.replaceChildren();
    lastStaticBar = -1; lastReadout = '';
    if (! score) return;
    let low = 127, high = 0;
    for (const bar of score.bars) {
      for (const note of bar.notes) {
        if (FAMILIES[note.role] && note.midi !== null) {
          low = Math.min (low, note.midi); high = Math.max (high, note.midi);
        }
      }
      if (bar.barInPart === 0) {
        const block = document.createElement ('span');
        block.textContent = bar.section;
        block.dataset.startBar = bar.index;
        block.dataset.section = bar.section;
        block.title = `Turn ${bar.turn + 1}, section ${bar.section}, bars ${bar.index + 1}–${bar.index + 8}`;
        block.setAttribute ('aria-hidden', 'true');
        sections.append (block);
      }
    }
    pitchLow = high >= low ? Math.floor (low / 12) * 12 : 36;
    pitchHigh = high >= low ? Math.max (pitchLow + 24, Math.ceil (high / 12) * 12) : 96;
    sections.setAttribute ('aria-label', `Complete track form: ${[...sections.children].map (block => block.textContent).join (' ')}.`);
  }

  function fill (colour, x, y, w, h) {
    ctx.fillStyle = colour;
    ctx.fillRect (Math.round (x), Math.round (y), Math.max (1, Math.round (w)), Math.max (1, Math.round (h)));
  }
  function text (value, x, y, colour = '#897e9b') {
    ctx.fillStyle = colour;
    ctx.font = '6px monospace';
    ctx.fillText (value, Math.round (x), Math.round (y));
  }

  function draw (playback) {
    if (playback?.score !== score) prepareScore (playback?.score ?? null);
    ctx.globalAlpha = 1;
    fill ('#110d20', 0, 0, width, height);
    const horizontal = direction === 'horizontal';
    const left = horizontal ? 19 : 5, top = 13;
    const bottom = height - 12, right = width - 5;
    const pitchCount = pitchHigh - pitchLow + 1;
    const pitchSpan = horizontal ? bottom - top - 26 : right - left - 28;
    const timeSpan = horizontal ? right - left : bottom - top;
    const pitchStep = pitchSpan / pitchCount;
    const beat = playback?.beat ?? 0;
    const window = rollWindow (beat, scrolling);
    const timeAt = value => horizontal
      ? left + (value - window.start) / 32 * timeSpan
      : top + (window.end - value) / 32 * timeSpan;
    const pitchAt = midi => horizontal
      ? top + (pitchHigh - midi) * pitchStep
      : left + (midi - pitchLow) * pitchStep;
    const drumStart = (horizontal ? top : left) + pitchSpan + 5;

    for (let midi = pitchLow; midi <= pitchHigh; midi++) {
      const pos = pitchAt (midi);
      const blackKey = [1, 3, 6, 8, 10].includes (midi % 12);
      const colour = midi % 12 === 0 ? '#30243e' : blackKey ? '#161126' : '#1b152d';
      if (horizontal) fill (colour, left, pos, timeSpan, pitchStep);
      else fill (colour, pos, top, pitchStep, timeSpan);
      if (midi % 12 === 0) {
        const label = `C${midi / 12 - 1}`;
        if (horizontal) text (label, 2, pos + 3);
        else text (label, pos, height - 3);
      }
    }
    for (let lane = 0; lane < 3; lane++) {
      const pos = drumStart + lane * 7;
      if (horizontal) { fill ('#241b2b', left, pos, timeSpan, 6); text (['K', 'S', 'H'][lane], 5, pos + 5); }
      else { fill ('#241b2b', pos, top, 6, timeSpan); text (['K', 'S', 'H'][lane], pos, height - 3); }
    }
    for (let bar = Math.max (0, Math.ceil (window.start / 4)); bar * 4 <= window.end; bar++) {
      if (score && bar > score.barCount) break;
      const pos = timeAt (bar * 4), major = bar % 8 === 0;
      if (horizontal) { fill (major ? '#59405b' : '#33263f', pos, top, 1, bottom - top); text (String (bar + 1).padStart (2, '0'), pos + 2, 8); }
      else { fill (major ? '#59405b' : '#33263f', left, pos, right - left, 1); text (String (bar + 1).padStart (2, '0'), left + 2, pos - 2); }
    }

    if (playback) {
      ctx.save();
      ctx.beginPath(); ctx.rect (left, top, right - left, bottom - top); ctx.clip();
      const first = Math.max (0, Math.floor (window.start / 4) - 2);
      const last = Math.min (score.barCount - 1, Math.floor (window.end / 4));
      let visibleNotes = 0;
      for (let i = first; i <= last; i++) {
        score.bars[i].notes.forEach ((note, index) => {
          const family = familyOf (note.role);
          if (! FAMILIES[family] || hidden.has (family)) return;
          const at = i * 4 + note.at, end = at + note.duration;
          if (end < window.start || at > window.end) return;
          const active = scrolling && playback.activeNotes.has (`${i}:${index}`);
          const percussion = family === 'drums';
          const pitch = percussion ? drumStart + laneOf (note.role) * 7 : pitchAt (note.midi);
          const size = percussion ? 5 : Math.max (1, pitchStep - 0.3);
          const start = timeAt (at), finish = timeAt (end);
          const x = horizontal ? start : pitch;
          const y = horizontal ? pitch : finish;
          const w = horizontal ? Math.max (1, finish - start) : size;
          const h = horizontal ? size : Math.max (1, start - finish);
          ctx.globalAlpha = active ? 1 : (at > beat ? 0.56 : 0.72) * (0.65 + note.velocity * 0.35);
          fill (FAMILIES[family].colour, x, y, w, h);
          if (active) { ctx.globalAlpha = 1; fill ('#fff5df', x, y, horizontal ? 1 : w, horizontal ? h : 1); }
          visibleNotes++;
        });
      }
      ctx.restore();
      canvas.dataset.visibleNotes = visibleNotes;
      ctx.globalAlpha = 1;
      const cursor = timeAt (scrolling ? beat : playback.barIndex * 4);
      if (horizontal) { fill ('#ffecbd', cursor, top, 1, bottom - top); fill ('#ffecbd', cursor - 2, top - 4, 5, 3); }
      else { fill ('#ffecbd', left, cursor, right - left, 1); fill ('#ffecbd', right, cursor - 2, 3, 5); }
      const summary = playback.ended ? 'between tunes' : `section ${playback.bar.section} · bar ${playback.barIndex + 1} / ${score.barCount}`;
      if (summary !== lastReadout) {
        readout.textContent = summary;
        lastReadout = summary;
        for (const block of sections.children) {
          block.classList.toggle ('current', Math.floor (Number (block.dataset.startBar) / 8) === Math.floor (playback.barIndex / 8));
        }
      }
      for (const [role, { voice }] of legendButtons) {
        const name = playback.voices[role] ?? (role === 'pluck' ? 'plucked' : role === 'drone' ? 'sustained' : 'kick · snare · hats');
        if (voice.textContent !== name) voice.textContent = name;
      }
      canvas.dataset.bar = playback.barIndex;
      canvas.dataset.beat = beat.toFixed (3);
    } else {
      canvas.dataset.visibleNotes = '0';
      delete canvas.dataset.bar; delete canvas.dataset.beat;
      readout.textContent = 'press start to see the tune';
      lastReadout = '';
      for (const { voice } of legendButtons.values()) voice.textContent = '';
      ctx.textAlign = 'center';
      text ('a little world of notes', width / 2, height / 2 - 3, '#d2bccd');
      text ('waiting for the first bar', width / 2, height / 2 + 8);
      ctx.textAlign = 'left';
    }
    lastStaticBar = playback?.barIndex ?? -1;
  }

  function tick (now) {
    if (now - lastFrame >= 32) {
      const playback = getPlayback();
      if (scrolling || playback?.score !== score || (playback?.barIndex ?? -1) !== lastStaticBar) draw (playback);
      lastFrame = now;
    }
    frame = requestAnimationFrame (tick);
  }
  function visibility () {
    if (frame !== null) cancelAnimationFrame (frame);
    frame = null;
    if (! document.hidden) { draw (getPlayback()); frame = requestAnimationFrame (tick); }
  }
  document.addEventListener ('visibilitychange', visibility);
  updateControls();
  const observer = new ResizeObserver (resize);
  observer.observe (canvas);
  resize(); visibility();
  return { redraw: () => draw (getPlayback()) };
}
