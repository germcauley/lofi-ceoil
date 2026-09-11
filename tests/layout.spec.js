import { test, expect } from '@playwright/test';

// The panel was reorganised around how often each thing gets touched: the deck
// first, the readout, then the console. These hold the flows that came out of
// that, rather than any particular measurement of how it looks.

test.afterEach (async ({ page }) => {
  await page.evaluate (async () => {
    window.lofi.stop();
    await window.lofi.chain.input.context.close();
  }).catch (() => {});
});

test ('the tools for a tune appear once there is a tune, and stay', async ({ page }) => {
  await page.goto ('/');
  const tools = page.locator ('#tuneTools');

  // Before anything had played these were three greyed-out buttons in the most
  // prominent row on the page, all saying "not yet".
  await expect (tools).toBeHidden();

  await page.click ('#playButton');
  await expect (tools).toBeVisible();
  await expect (page.locator ('#copyLinkButton')).toBeEnabled();

  // Stopping leaves a tune to repeat, share or keep.
  await page.click ('#playButton');
  await expect (page.locator ('#trackTitle')).toHaveText ('press start, stay awhile');
  await expect (tools).toBeVisible();
});

test ('the readout names what the music is doing, one thing to a line', async ({ page }) => {
  await page.goto ('/');
  await page.click ('#playButton');
  // Chords, the counter line's texture and the energy arc used to share one
  // line under a label, "figure", that explained none of them.
  await expect (page.locator ('#progressionReadout')).not.toHaveText ('—', { timeout: 8000 });
  await expect (page.locator ('#energyReadout')).toHaveText (/^(swell|build|ebb|plateau) · \d+%$|^steady$/);
  expect (await page.locator ('#progressionReadout').textContent()).not.toContain (' · ');

  await page.click ('#playButton');
  await expect (page.locator ('#progressionReadout')).toHaveText ('—');
  await expect (page.locator ('#textureReadout')).toHaveText ('—');
  await expect (page.locator ('#energyReadout')).toHaveText ('—');
});

test ('space plays and stops, and N moves to a new tune', async ({ page }) => {
  await page.goto ('/');
  // Somewhere on the page that is not a control, so the key is the page's.
  await page.mouse.click (4, 4);

  await page.keyboard.press ('n');
  expect (await page.evaluate (() => window.lofi.state.running)).toBe (false);

  await page.keyboard.press ('Space');
  await page.waitForFunction (() => window.lofi.state.running && window.lofi.state.trackNumber === 1);

  await page.keyboard.press ('n');
  await expect.poll (() => page.evaluate (() => window.lofi.state.trackNumber)).toBe (2);

  // A held key repeats. That used to strobe play and stop on space, and on N
  // would run through a string of tunes nobody chose.
  await page.keyboard.down ('n');
  await page.keyboard.down ('n');
  await page.keyboard.down ('n');
  await page.keyboard.up ('n');
  await expect.poll (() => page.evaluate (() => window.lofi.state.trackNumber)).toBe (3);
  await page.waitForTimeout (400);
  expect (await page.evaluate (() => window.lofi.state.trackNumber)).toBe (3);

  await page.keyboard.press ('Space');
  await expect.poll (() => page.evaluate (() => window.lofi.state.running)).toBe (false);
});

test ('every panel is on the page on a wide screen', async ({ page }) => {
  await page.setViewportSize ({ width: 1280, height: 800 });
  await page.goto ('/');
  await expect (page.locator ('.panel-tabs')).toBeHidden();
  for (const id of ['#panelComposition', '#panelVoices', '#panelTape']) {
    await expect (page.locator (id)).toBeVisible();
  }
});

test.describe ('on a phone', () => {
  test.use ({ viewport: { width: 375, height: 812 }, hasTouch: true });

  test ('the console is one panel at a time, and remembers which', async ({ page }) => {
    await page.goto ('/');
    const tabs = page.locator ('.panel-tabs');
    await expect (tabs).toBeVisible();
    await expect (page.locator ('#panelComposition')).toBeVisible();
    await expect (page.locator ('#panelVoices')).toBeHidden();

    const voices = tabs.getByRole ('button', { name: 'voices' });
    await voices.click();
    await expect (voices).toHaveAttribute ('aria-pressed', 'true');
    await expect (page.locator ('#panelVoices')).toBeVisible();
    await expect (page.locator ('#panelComposition')).toBeHidden();

    await page.reload();
    await expect (page.locator ('#panelVoices')).toBeVisible();
    await expect (page.locator ('#panelTape')).toBeHidden();
  });

  test ('play comes before the tools that act on what is playing', async ({ page }) => {
    await page.goto ('/');
    await page.click ('#playButton');
    await expect (page.locator ('#tuneTools')).toBeVisible();
    const play = await page.locator ('#playButton').boundingBox();
    const tools = await page.locator ('#tuneTools').boundingBox();
    expect (tools.y).toBeGreaterThan (play.y + play.height);

    // And the four of them fit on one line rather than orphaning the last.
    const rows = await page.locator ('#tuneTools .tool').evaluateAll (buttons =>
      new Set (buttons.map (button => Math.round (button.getBoundingClientRect().top))).size);
    expect (rows).toBe (1);
  });

  test ('the page is a fraction of the height it was', async ({ page }) => {
    await page.goto ('/');
    // Every control stacked, it was nearly three thousand pixels.
    const height = await page.evaluate (() => document.documentElement.scrollHeight);
    expect (height).toBeLessThan (1900);
  });
});
