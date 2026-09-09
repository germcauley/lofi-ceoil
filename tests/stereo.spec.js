import { test, expect } from '@playwright/test';
import { PLACEMENT, placementAt, DEFAULT_WIDTH, PLACED_ROLES } from '../src/stereo.js';

test ('the low end stays centred and answering parts go opposite ways', () => {
  // The anchor. Moving weight off centre unbalances the mix and costs
  // headroom on one side for nothing.
  expect (PLACEMENT.kick).toBe (0);
  expect (PLACEMENT.bass).toBe (0);
  expect (Math.abs (PLACEMENT.snare)).toBeLessThan (0.1);

  // The counter line and the support answer the tune, and a reply is easier
  // to follow from the other side of the room.
  expect (Math.sign (PLACEMENT.pluck)).toBe (-Math.sign (PLACEMENT.lead));
  expect (Math.sign (PLACEMENT.keys)).toBe (-Math.sign (PLACEMENT.lead));
  expect (Math.sign (PLACEMENT.hat)).toBe (-Math.sign (PLACEMENT.ghost));

  // Offsets, not novelties.
  for (const role of PLACED_ROLES) expect (Math.abs (PLACEMENT[role])).toBeLessThan (0.5);

  // Width nought is the mono mix this had before, and has to keep working.
  // Negative zero for the parts on the left, which is numerically nought.
  for (const role of PLACED_ROLES) expect (placementAt (role, 0)).toBeCloseTo (0);
  for (const role of PLACED_ROLES) expect (placementAt (role, 1)).toBe (PLACEMENT[role]);
  expect (placementAt ('lead', 0.5)).toBeCloseTo (PLACEMENT.lead / 2);
  expect (placementAt ('nothing in the table', 1)).toBe (0);
  expect (DEFAULT_WIDTH).toBeGreaterThan (0);
  expect (DEFAULT_WIDTH).toBeLessThanOrEqual (1);
});

/** The placement has to survive the tape path. Saturation, bitcrush, wobble
    and the filters all sit between the panners and the speakers, and any one
    of them summing to mono would undo the lot silently — the mix would still
    play, it would just be flat again. */
test ('the image reaches the output, and the width knob collapses it', async ({ page }) => {
  await page.goto ('/');
  const measured = await page.evaluate (async () => {
    const e = window.lofi;
    const context = e.chain.master.context;
    await context.resume();
    const raw = context.rawContext;

    // One analyser per channel, so left and right can be compared rather than
    // summed. A single analyser on a stereo node reads the downmix and would
    // report a perfectly centred mix as wide.
    const split = raw.createChannelSplitter (2);
    e.chain.master.connect (split);
    const sides = [0, 1].map (channel => {
      const analyser = raw.createAnalyser();
      analyser.fftSize = 2048;
      split.connect (analyser, channel);
      return analyser;
    });

    async function energies (fire, seconds = 1.6) {
      await new Promise (resolve => setTimeout (resolve, 500));
      fire (raw.currentTime + 0.15);
      const totals = [0, 0];
      let samples = 0;
      const until = Date.now() + seconds * 1000;
      const buffer = new Float32Array (2048);
      while (Date.now() < until) {
        sides.forEach ((analyser, side) => {
          analyser.getFloatTimeDomainData (buffer);
          for (const value of buffer) totals[side] += value * value;
        });
        samples += 2048;
        await new Promise (resolve => setTimeout (resolve, 8));
      }
      return totals.map (total => Math.sqrt (total / samples));
    }

    // A hat run, which sits well off centre, against the kick, which does not.
    const hats = t => {
      for (let i = 0; i < 8; i++) e.state.drums.hat.triggerAttackRelease (0.08, t + i * 0.15, 0.5);
    };
    const kicks = t => {
      for (let i = 0; i < 4; i++) e.state.drums.kick.triggerAttackRelease ('C1', 0.25, t + i * 0.3, 0.9);
    };

    const wide = await energies (hats);
    const centred = await energies (kicks);
    e.controls.width (0);
    await new Promise (resolve => setTimeout (resolve, 800));
    const mono = await energies (hats);

    await context.close();
    const ratio = ([left, right]) => left > 0 && right > 0
      ? Math.max (left, right) / Math.min (left, right) : 1;
    return { wide: ratio (wide), centred: ratio (centred), mono: ratio (mono) };
  });

  console.log (`hats ${measured.wide.toFixed (2)}:1, kick ${measured.centred.toFixed (2)}:1, `
    + `hats at width nought ${measured.mono.toFixed (2)}:1`);

  // The hats are clearly to one side.
  expect (measured.wide).toBeGreaterThan (1.3);
  // The kick is not.
  expect (measured.centred).toBeLessThan (1.15);
  // And nought really is the mono mix, not merely a narrower one.
  expect (measured.mono).toBeLessThan (1.15);
});
