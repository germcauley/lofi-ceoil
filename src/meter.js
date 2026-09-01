// A segmented LED spectrum display, driven by a real FFT of the output.
//
// Drawn on a canvas rather than in the DOM: it repaints every frame, and
// pushing 120 element styles per frame is a waste when a single fill loop does
// it. Colours are read from CSS custom properties on mount, so the palette
// still lives in one place with the rest of the design tokens.

const COLUMNS = 12;
const ROWS = 12;

export function createMeter () {
  const root = document.createElement ('div');
  root.className = 'meter';
  root.setAttribute ('aria-hidden', 'true');

  const canvas = document.createElement ('canvas');
  canvas.className = 'meter-canvas';
  root.append (canvas);

  const context = canvas.getContext ('2d');

  let palette = null;
  let width = 0;
  let height = 0;

  function readPalette () {
    const styles = getComputedStyle (root);

    palette = {
      low: styles.getPropertyValue ('--led-low').trim() || '#ffa53d',
      high: styles.getPropertyValue ('--led-high').trim() || '#ff3d8e',
      off: styles.getPropertyValue ('--led-off').trim() || 'rgba(255,255,255,0.06)'
    };
  }

  /** Canvas needs its backing store sized in device pixels, or the segments
      come out soft on a retina display. */
  function resize () {
    const ratio = window.devicePixelRatio || 1;
    const rect = root.getBoundingClientRect();

    if (! rect.width) return false;

    width = rect.width;
    height = rect.height;

    canvas.width = Math.round (width * ratio);
    canvas.height = Math.round (height * ratio);
    context.setTransform (ratio, 0, 0, ratio, 0, 0);

    return true;
  }

  function draw (levels) {
    if (! palette) readPalette();
    if (! width && ! resize()) return;

    context.clearRect (0, 0, width, height);

    const gapX = width * 0.02;
    const gapY = height * 0.055;
    const columnWidth = (width - gapX * (COLUMNS - 1)) / COLUMNS;
    const rowHeight = (height - gapY * (ROWS - 1)) / ROWS;
    const radius = Math.min (2.5, rowHeight * 0.4);

    for (let column = 0; column < COLUMNS; column++) {
      const level = levels[column] ?? 0;
      const lit = Math.round (level * ROWS);
      const x = column * (columnWidth + gapX);

      for (let row = 0; row < ROWS; row++) {
        // Row 0 is the bottom of the column.
        const y = height - (row + 1) * rowHeight - row * gapY;
        const isLit = row < lit;

        if (isLit) {
          // Warm at the bottom, hot at the top, so loud reads as colour rather
          // than only as height.
          const t = row / (ROWS - 1);
          context.fillStyle = mix (palette.low, palette.high, t);
        } else {
          context.fillStyle = palette.off;
        }

        roundedRect (context, x, y, columnWidth, rowHeight, radius);
        context.fill();
      }
    }
  }

  let lastLevels = new Array (COLUMNS).fill (0);

  // The canvas has no size until it has been laid out, and at standby nothing
  // is repainting it — so without this the unlit grid never appears until you
  // press start.
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver (() => {
      if (resize()) draw (lastLevels);
    }).observe (root);
  }

  return {
    element: root,

    update (levels) {
      lastLevels = levels;
      draw (levels);
    },

    reset () {
      lastLevels = new Array (COLUMNS).fill (0);
      draw (lastLevels);
    },

    /** Called if the layout changes under it. */
    refresh () {
      resize();
      readPalette();
      draw (lastLevels);
    }
  };
}

function roundedRect (context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo (x + r, y);
  context.arcTo (x + w, y, x + w, y + h, r);
  context.arcTo (x + w, y + h, x, y + h, r);
  context.arcTo (x, y + h, x, y, r);
  context.arcTo (x, y, x + w, y, r);
  context.closePath();
}

/** Blends two CSS colours. Only handles hex, which is all the tokens use. */
function mix (a, b, t) {
  const parse = hex => {
    const value = hex.replace ('#', '');
    const full = value.length === 3 ? value.split ('').map (c => c + c).join ('') : value;

    return [
      parseInt (full.slice (0, 2), 16),
      parseInt (full.slice (2, 4), 16),
      parseInt (full.slice (4, 6), 16)
    ];
  };

  const [r1, g1, b1] = parse (a);
  const [r2, g2, b2] = parse (b);

  const channel = (x, y) => Math.round (x + (y - x) * t);

  return `rgb(${channel (r1, r2)}, ${channel (g1, g2)}, ${channel (b1, b2)})`;
}
