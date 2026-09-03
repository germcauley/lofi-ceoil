import { test, expect } from '@playwright/test';

let failures;
test.beforeEach (async ({ page }) => {
  failures = [];
  page.on ('pageerror', error => failures.push (error.message));
  page.on ('console', message => {
    if (/bar failed|could not replay/.test (message.text())) failures.push (message.text());
  });
  await page.goto ('/');
  await page.click ('#playButton');
  await page.waitForFunction (() => window.lofi.state.track?.composition);
});

test.afterEach (async ({ page }) => {
  await page.evaluate (async () => {
    window.lofi.stop();
    await window.lofi.chain.input.context.close();
  });
  expect (failures).toEqual ([]);
});

// Move the form cursor to a boundary without changing the transport clock or
// scheduling audio in the past. Playback still crosses it on the next bar.
async function nextBoundary (page, finishTrack = true) {
  return page.evaluate (finish => {
    const s = window.lofi.state;
    if (finish) s.track.turnsLeft = 0;
    s.formOffset = s.barIndex;
    return s.barIndex;
  }, finishTrack);
}

test ('replay waits through turns, repeats the saved score once, then resumes new tracks', async ({ page }) => {
  const original = await page.evaluate (() => window.lofi.getComposition());
  await page.click ('#replayButton');
  await expect (page.locator ('#replayButton')).toHaveAttribute ('aria-pressed', 'true');
  await expect (page.locator ('#replayButton')).toHaveAccessibleName ('Repeat queued — click to cancel');
  expect (await page.evaluate (() => window.lofi.state.trackNumber)).toBe (1);

  const bar = await nextBoundary (page, false);
  await expect.poll (() => page.evaluate (() => window.lofi.state.barIndex), { timeout: 6000 }).toBeGreaterThan (bar);
  expect (await page.evaluate (() => window.lofi.state.trackNumber)).toBe (1);
  expect (await page.evaluate (() => window.lofi.isReplayQueued())).toBe (true);

  await nextBoundary (page);
  await expect.poll (() => page.evaluate (() => window.lofi.state.trackNumber), { timeout: 6000 }).toBe (2);
  expect (await page.evaluate (() => window.lofi.getComposition())).toEqual (original);
  expect (await page.evaluate (() => window.lofi.state.scoreBarIndex)).toBe (0);
  await expect (page.locator ('#replayButton')).toHaveAttribute ('aria-pressed', 'false');
  await expect (page.locator ('#trackTitle')).toHaveText (original.recipe.title);

  await nextBoundary (page);
  await expect.poll (() => page.evaluate (() => window.lofi.state.trackNumber), { timeout: 6000 }).toBe (3);
  expect (await page.evaluate (() => window.lofi.getComposition())).not.toEqual (original);
});

test ('a second press cancels and new track overrides the queue', async ({ page }) => {
  await page.click ('#replayButton');
  await page.click ('#replayButton');
  await expect (page.locator ('#replayButton')).toHaveAttribute ('aria-pressed', 'false');
  expect (await page.evaluate (() => window.lofi.state.trackNumber)).toBe (1);
  const original = await page.evaluate (() => window.lofi.getComposition());
  await nextBoundary (page);
  await expect.poll (() => page.evaluate (() => window.lofi.state.trackNumber), { timeout: 6000 }).toBe (2);
  expect (await page.evaluate (() => window.lofi.getComposition())).not.toEqual (original);

  const second = await page.evaluate (() => window.lofi.getComposition());
  await page.click ('#replayButton');
  await page.click ('#skipButton');
  expect (await page.evaluate (() => window.lofi.getComposition())).not.toEqual (second);
  await expect (page.locator ('#replayButton')).toHaveAttribute ('aria-pressed', 'false');
});

test ('stop clears the queue, while replay from stopped starts the saved tune', async ({ page }) => {
  await page.click ('#replayButton');
  await page.click ('#playButton');
  await expect (page.locator ('#replayButton')).toHaveAttribute ('aria-pressed', 'false');
  const saved = await page.evaluate (() => window.lofi.getComposition());
  await page.click ('#replayButton');
  await page.waitForFunction (() => window.lofi.state.track?.composition);
  expect (await page.evaluate (() => window.lofi.getComposition())).toEqual (saved);
  await expect (page.locator ('#replayButton')).toHaveAttribute ('aria-pressed', 'false');

  await page.click ('#replayButton');
  await page.click ('#playButton');
  await page.click ('#playButton');
  await page.waitForFunction (() => window.lofi.state.track?.composition);
  expect (await page.evaluate (() => window.lofi.getComposition())).not.toEqual (saved);
});

test ('replay queued during a set rest waits for the rest to finish', async ({ page }) => {
  const saved = await page.evaluate (() => window.lofi.getComposition());
  await page.evaluate (() => {
    const s = window.lofi.state;
    s.track.turnsLeft = 0;
    s.resting = 1;
  });
  await page.click ('#replayButton');
  expect (await page.evaluate (() => window.lofi.state.resting)).toBe (1);
  expect (await page.evaluate (() => window.lofi.state.trackNumber)).toBe (1);
  await expect.poll (() => page.evaluate (() => window.lofi.state.resting), { timeout: 6000 }).toBe (0);
  expect (await page.evaluate (() => window.lofi.isReplayQueued())).toBe (true);
  await expect.poll (() => page.evaluate (() => window.lofi.state.trackNumber), { timeout: 6000 }).toBe (2);
  expect (await page.evaluate (() => window.lofi.getComposition())).toEqual (saved);
});
