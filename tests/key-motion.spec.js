import { test, expect } from '@playwright/test';

test ('pressing new track moves the key, and the mode cannot sit still', async ({ page }) => {
  await page.goto ('/');
  await page.click ('#playButton');
  await page.waitForFunction (() => window.lofi.state.running);

  const motion = await page.evaluate (async () => {
    const engine = window.lofi;
    const key = () => ({ scale: engine.state.scale, root: engine.state.rootMidi % 12 });
    let held = 1, longestHeld = 1, modeChanges = 0, keyHolds = 0;
    let previous = key();

    for (let i = 0; i < 16; i++) {
      engine.controls.skip();
      await new Promise (resolve => setTimeout (resolve, 420));
      const now = key();
      if (now.scale === previous.scale && now.root === previous.root) keyHolds++;
      if (now.scale === previous.scale) longestHeld = Math.max (longestHeld, ++held);
      else { modeChanges++; held = 1; }
      previous = now;
    }
    return { longestHeld, modeChanges, keyHolds, skips: 16 };
  });

  // A skip is an explicit request for something else, so the key always moves.
  expect (motion.keyHolds).toBe (0);

  // Only two of the four moves change the mode, so before this was guaranteed
  // the mode survived three skips in four and could run for many tracks.
  expect (motion.longestHeld).toBeLessThanOrEqual (3);
  expect (motion.modeChanges).toBeGreaterThan (motion.skips / 4);
});
