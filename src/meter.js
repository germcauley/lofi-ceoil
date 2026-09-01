// A backlit VU meter driven by the real output signal.
//
// Not decoration: it is the fastest way to tell whether density, dust and
// drive have pushed the mix too hard, and it makes the panel feel alive when
// nothing else is moving.

const START = -46;   // needle angle at silence
const END = 46;      // needle angle at full scale

export function createMeter () {
  const root = document.createElement ('div');
  root.className = 'meter';
  root.setAttribute ('aria-hidden', 'true');

  root.innerHTML = `
    <svg viewBox="0 0 200 104" class="meter-face">
      <defs>
        <linearGradient id="meterGlow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(232,163,61,0.20)" />
          <stop offset="100%" stop-color="rgba(232,163,61,0.02)" />
        </linearGradient>
      </defs>

      <rect class="meter-bg" x="0" y="0" width="200" height="104" rx="4" />
      <rect x="0" y="0" width="200" height="104" rx="4" fill="url(#meterGlow)" />

      ${ticks()}

      <path class="meter-arc-hot" d="${arc (74, 12, 46)}" />

      <g class="meter-needle-group">
        <line class="meter-needle" x1="100" y1="96" x2="100" y2="26" />
        <circle class="meter-pivot" cx="100" cy="96" r="4.5" />
      </g>

      <text class="meter-caption" x="100" y="62" text-anchor="middle">VU</text>
    </svg>
  `;

  const needle = root.querySelector ('.meter-needle-group');

  let peak = 0;
  let peakHold = 0;

  return {
    element: root,

    /** Called every animation frame with a 0..1 level. */
    update (level) {
      const angle = START + Math.min (1, level) * (END - START);
      needle.style.transform = `rotate(${angle.toFixed (2)}deg)`;

      // Peak lamp latches briefly so a short overshoot is still visible.
      if (level > 0.86) {
        peak = 1;
        peakHold = 45;
      } else if (peakHold > 0) {
        peakHold--;
      } else {
        peak = 0;
      }

      root.classList.toggle ('peaking', peak === 1);
    },

    reset () {
      needle.style.transform = `rotate(${START}deg)`;
      root.classList.remove ('peaking');
    }
  };
}

function polar (radius, degrees) {
  const rad = (degrees - 90) * Math.PI / 180;
  return [100 + radius * Math.cos (rad), 96 + radius * Math.sin (rad)];
}

function arc (radius, from, to) {
  const [x1, y1] = polar (radius, from);
  const [x2, y2] = polar (radius, to);

  return `M ${x1.toFixed (2)} ${y1.toFixed (2)} A ${radius} ${radius} 0 0 1 ${x2.toFixed (2)} ${y2.toFixed (2)}`;
}

/** Scale marks, denser toward the top of the range like a real VU face. */
function ticks () {
  const marks = [-46, -34, -22, -10, 0, 10, 20, 28, 36, 42, 46];

  return marks.map (angle => {
    const hot = angle > 20;
    const [x1, y1] = polar (66, angle);
    const [x2, y2] = polar (angle % 12 === 0 ? 56 : 60, angle);

    return `<line class="meter-tick${hot ? ' hot' : ''}" x1="${x1.toFixed (2)}" y1="${y1.toFixed (2)}" x2="${x2.toFixed (2)}" y2="${y2.toFixed (2)}" />`;
  }).join ('');
}
