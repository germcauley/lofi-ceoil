import { test, expect } from '@playwright/test';

/** A lofi stream is put on and then left in a background tab — that is most
    of how it gets listened to.

    A hidden tab gets no animation frames at all, and Tone.Draw delivers its
    callbacks on animation frames, silently dropping anything that arrives more
    than a quarter of a second late. The track title, the key and the mode were
    all delivered that way. So a listener who started a tune and switched tabs
    came back to the previous track's title for the whole of this one, and the
    browser tab — the one thing visible while the page is hidden — never changed
    its name at all.

    This removes animation frames before the page loads, which is exactly what
    hiding the tab does to it. */
test.beforeEach (async ({ page }) => {
  await page.addInitScript (() => {
    window.requestAnimationFrame = () => 0;
    window.cancelAnimationFrame = () => {};
  });
});

// waitForFunction polls on animation frames unless told otherwise, and there
// are none here — so it would check once and then wait forever.
const until = (page, predicate) => page.waitForFunction (predicate, undefined, { polling: 100 });

test ('a hidden tab still learns which track is playing', async ({ page }) => {
  await page.goto ('/');
  await page.click ('#playButton');
  await until (page, () => window.lofi.state.track?.title);

  const first = await page.evaluate (() => window.lofi.state.track.title);
  await expect (page.locator ('#trackTitle')).toHaveText (first);
  await expect (page.locator ('#trackNumber')).toHaveText ('track 001');
  await expect (page).toHaveTitle (`${first} · Lofi Ceoil`);

  await page.click ('#skipButton');
  await expect.poll (() => page.evaluate (() => window.lofi.state.trackNumber)).toBe (2);
  const second = await page.evaluate (() => window.lofi.state.track.title);
  expect (second).not.toBe (first);
  await expect (page.locator ('#trackTitle')).toHaveText (second);
  await expect (page).toHaveTitle (`${second} · Lofi Ceoil`);

  // The key and mode rows follow as well, or the panel describes a key the
  // music left behind a track ago.
  const key = await page.evaluate (() => {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return { note: names[window.lofi.state.rootMidi % 12], scale: window.lofi.state.scale };
  });
  await expect (page.locator ('#keyRow [aria-checked="true"]')).toHaveText (key.note);
  await expect (page.locator ('#scaleRow [aria-checked="true"]')).toHaveText (key.scale);

  await page.evaluate (async () => {
    window.lofi.stop();
    await window.lofi.chain.input.context.close();
  });
});

test ('an announcement queued for a track that was cut never lands', async ({ page }) => {
  await page.goto ('/');
  await page.click ('#playButton');
  await until (page, () => window.lofi.state.track?.title);

  // Skip and stop in the same tick: the skipped-to track has an announcement
  // on its way, and it must not overwrite the stopped panel when it arrives.
  await page.evaluate (() => {
    document.getElementById ('skipButton').click();
    document.getElementById ('playButton').click();
  });
  await page.waitForTimeout (600);
  await expect (page.locator ('#trackTitle')).toHaveText ('press start, stay awhile');
  await expect (page).toHaveTitle ('Lofi Ceoil — generative Irish lofi');

  await page.evaluate (() => window.lofi.chain.input.context.close());
});
