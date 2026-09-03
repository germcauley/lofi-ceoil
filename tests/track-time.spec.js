import { test, expect } from '@playwright/test';
import { createPlaybackTimeline } from '../src/playback-timeline.js';

test ('track time follows audible anchors through tempo changes, rests and repeats', () => {
  const timeline = createPlaybackTimeline ();
  const track = {};
  expect (timeline.readClock (99)).toBeNull ();
  // Unequal intervals model tempo changes; the rolling history must retain
  // the original start even after its first bar anchor has been discarded.
  for (const time of [100, 104, 107, 109.5, 112, 116]) timeline.schedule ({ track, time });
  expect (timeline.readClock (118)).toEqual ({ elapsedSeconds: 18, resting: false });
  timeline.endTrack (120);
  expect (timeline.readClock (119)).toEqual ({ elapsedSeconds: 19, resting: false });
  timeline.endTrack (124);
  expect (timeline.readClock (125)).toEqual ({ elapsedSeconds: 20, resting: true });
  // A repeated score still belongs to a new track instance. Scheduling it
  // ahead of time must not reset the currently audible track early.
  timeline.schedule ({ track: {}, time: 128 });
  expect (timeline.readClock (127)).toEqual ({ elapsedSeconds: 20, resting: true });
  expect (timeline.readClock (128)).toEqual ({ elapsedSeconds: 0, resting: false });
  expect (timeline.readClock (130)).toEqual ({ elapsedSeconds: 2, resting: false });
  timeline.reset ();
  expect (timeline.readClock (131)).toBeNull ();
});

test ('the player shows elapsed time and resets it on skip, repeat and stop', async ({ page }) => {
  const failures = [];
  page.on ('pageerror', error => failures.push (error.message));
  await page.goto ('/');
  const timer = page.locator ('#trackTime');
  await expect (timer).toHaveText ('—:—');
  await page.click ('#playButton');
  await expect (timer).toHaveText ('0:02', { timeout: 7000 });
  await page.evaluate (() => window.lofi.controls.tempo (100));
  await expect (timer).toHaveText ('0:03', { timeout: 3000 });
  await page.click ('#skipButton');
  await expect (timer).toHaveText ('0:00');
  await expect (timer).toHaveText ('0:01');
  await page.click ('#replayButton');
  const before = await page.evaluate (() => {
    const s = window.lofi.state;
    s.track.turnsLeft = 0;
    s.formOffset = s.barIndex;
    return s.trackNumber;
  });
  await expect.poll (() => page.evaluate (() => window.lofi.state.trackNumber), { timeout: 6000 }).toBe (before + 1);
  await expect (timer).toHaveText ('0:00');
  await page.click ('#playButton');
  await expect (timer).toHaveText ('—:—');
  expect (failures).toEqual ([]);
  await page.evaluate (async () => { await window.lofi.chain.input.context.close(); });
});

test ('the timer freezes and labels the gap between tunes', async ({ page }) => {
  await page.goto ('/');
  await page.click ('#playButton');
  await page.waitForFunction (() => window.lofi.getTrackTime()?.elapsedSeconds > 0.5);
  await page.evaluate (() => { window.lofi.state.resting = 2; });
  const timer = page.locator ('#trackTime');
  await expect (timer).toHaveText (/\d+:\d{2} · rest/, { timeout: 6000 });
  const frozen = await timer.textContent ();
  await page.waitForTimeout (1200);
  await expect (timer).toHaveText (frozen);
  await page.click ('#playButton');
  await expect (timer).toHaveText ('—:—');
  await page.evaluate (async () => { await window.lofi.chain.input.context.close(); });
});
