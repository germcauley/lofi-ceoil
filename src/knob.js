// A rotary knob you drag, because a generative instrument should not feel like
// a settings form.
//
// Vertical drag changes the value; the pointer is captured so the gesture keeps
// working once the cursor leaves the knob. Keyboard and screen readers are
// handled through the standard slider role rather than being an afterthought.

const SWEEP = 280;      // degrees of travel, leaving a gap at the bottom
const START = -140;     // angle at minimum

export function createKnob ({ min, max, step, value, label, unit, format, onChange }) {
  const root = document.createElement ('div');
  root.className = 'knob';

  const dial = document.createElement ('div');
  dial.className = 'knob-dial';
  dial.tabIndex = 0;
  dial.setAttribute ('role', 'slider');
  dial.setAttribute ('aria-label', label);
  dial.setAttribute ('aria-valuemin', String (min));
  dial.setAttribute ('aria-valuemax', String (max));

  // The tick arc is drawn behind the cap and filled up to the current value,
  // so the knob reads at a glance without a separate meter.
  dial.innerHTML = `
    <svg class="knob-arc" viewBox="0 0 100 100" aria-hidden="true">
      <path class="knob-track" d="${arcPath (100)}" />
      <path class="knob-fill" d="${arcPath (100)}" />
    </svg>
    <div class="knob-cap"><span class="knob-pointer"></span></div>
  `;

  const labelEl = document.createElement ('span');
  labelEl.className = 'knob-label';
  labelEl.textContent = label;

  const valueEl = document.createElement ('span');
  valueEl.className = 'knob-value';

  root.append (dial, labelEl, valueEl);

  const fill = dial.querySelector ('.knob-fill');
  const cap = dial.querySelector ('.knob-cap');

  let current = value;

  const clamp = v => Math.min (max, Math.max (min, v));
  const quantise = v => Math.round (v / step) * step;
  const ratio = () => (current - min) / (max - min);

  function render () {
    const t = ratio();

    cap.style.transform = `rotate(${START + t * SWEEP}deg)`;
    fill.style.strokeDasharray = `${t * ARC_LENGTH} ${ARC_LENGTH}`;

    valueEl.textContent = format ? format (current) : current.toFixed (2) + (unit ?? '');
    dial.setAttribute ('aria-valuenow', String (current));
    dial.setAttribute ('aria-valuetext', valueEl.textContent);
  }

  function set (next, notify = true) {
    const clamped = clamp (quantise (next));
    if (clamped === current) return;

    current = clamped;
    render();
    if (notify) onChange (current);
  }

  // --- dragging -----------------------------------------------------------

  let dragOrigin = null;

  dial.addEventListener ('pointerdown', event => {
    dial.setPointerCapture (event.pointerId);
    dragOrigin = { y: event.clientY, value: current };
    root.classList.add ('dragging');
    event.preventDefault();
  });

  dial.addEventListener ('pointermove', event => {
    if (! dragOrigin) return;

    // 180px of travel covers the full range; holding shift slows it down for
    // fine adjustment.
    const scale = event.shiftKey ? 0.25 : 1;
    const delta = (dragOrigin.y - event.clientY) / 180 * (max - min) * scale;

    set (dragOrigin.value + delta);
  });

  const endDrag = event => {
    if (! dragOrigin) return;
    dragOrigin = null;
    root.classList.remove ('dragging');
    if (event.pointerId !== undefined) dial.releasePointerCapture?.(event.pointerId);
  };

  dial.addEventListener ('pointerup', endDrag);
  dial.addEventListener ('pointercancel', endDrag);

  dial.addEventListener ('dblclick', () => set (value));

  dial.addEventListener ('wheel', event => {
    event.preventDefault();
    set (current - Math.sign (event.deltaY) * step * 4);
  }, { passive: false });

  dial.addEventListener ('keydown', event => {
    const big = (max - min) / 10;

    const moves = {
      ArrowUp: step, ArrowRight: step,
      ArrowDown: -step, ArrowLeft: -step,
      PageUp: big, PageDown: -big,
      Home: min - current, End: max - current
    };

    if (! (event.key in moves)) return;

    event.preventDefault();
    set (current + moves[event.key]);
  });

  render();

  return { element: root, set, get value () { return current; } };
}

// --- arc geometry ---------------------------------------------------------
// Drawn once as a path string so every knob shares the same geometry.

function polar (cx, cy, radius, degrees) {
  const rad = (degrees - 90) * Math.PI / 180;
  return [cx + radius * Math.cos (rad), cy + radius * Math.sin (rad)];
}

function arcPath (size) {
  const r = 40;
  const [x1, y1] = polar (50, 50, r, START);
  const [x2, y2] = polar (50, 50, r, START + SWEEP);

  return `M ${x1.toFixed (2)} ${y1.toFixed (2)} A ${r} ${r} 0 ${SWEEP > 180 ? 1 : 0} 1 ${x2.toFixed (2)} ${y2.toFixed (2)}`;
}

// Arc length for the dash calculation: radius times the swept angle in radians.
const ARC_LENGTH = 40 * (SWEEP * Math.PI / 180);
