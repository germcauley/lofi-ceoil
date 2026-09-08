import { test, expect } from '@playwright/test';
import { createListeningLog, summarise } from '../src/listening.js';

const memory = () => {
  const map = new Map();
  return {
    getItem: key => map.get (key) ?? null,
    setItem: (key, value) => map.set (key, value),
    removeItem: key => map.delete (key)
  };
};

const play = (log, code, outcome, seconds, barsHeard, bars = 96) => {
  log.began ({ code, title: code, bars });
  return log.ended (outcome, { seconds, barsHeard });
};

test ('a track records how it ended and how far it got', () => {
  const log = createListeningLog ({ storage: memory() });
  play (log, 'AAA', 'skipped', 8, 4);
  play (log, 'BBB', 'finished', 240, 96);

  const [first, second] = log.entries();
  expect (first.outcome).toBe ('skipped');
  expect (first.seconds).toBe (8);
  // The difference between abandoned early and left running is the point.
  expect (first.fraction).toBeLessThan (0.1);
  expect (second.fraction).toBe (1);
  expect (second.position).toBe (2);
});

test ('a track cannot be recorded twice', () => {
  // A skip closes the track, and the next track's start runs afterwards, so
  // without a guard the same track lands as both skipped and finished.
  const log = createListeningLog ({ storage: memory() });
  log.began ({ code: 'AAA', title: 'one', bars: 96 });
  expect (log.ended ('skipped', { seconds: 5, barsHeard: 2 })).not.toBeNull();
  expect (log.ended ('finished', { seconds: 200, barsHeard: 96 })).toBeNull();
  expect (log.entries()).toHaveLength (1);
  expect (log.listening).toBe (false);
});

test ('the log survives a reload and does not grow without end', () => {
  const storage = memory();
  const log = createListeningLog ({ storage });
  for (let i = 0; i < 600; i++) play (log, 'AAA', 'skipped', 5, 2);

  expect (log.entries().length).toBeLessThanOrEqual (500);
  // What is on disk is what comes back.
  expect (createListeningLog ({ storage }).entries()).toEqual (log.entries());
});

test ('storage that refuses to work loses the log, never the music', () => {
  const hostile = {
    getItem () { throw new Error ('blocked'); },
    setItem () { throw new Error ('blocked'); },
    removeItem () { throw new Error ('blocked'); }
  };
  const log = createListeningLog ({ storage: hostile });
  expect (() => play (log, 'AAA', 'skipped', 5, 2)).not.toThrow();
  expect (() => log.clear()).not.toThrow();
  expect (createListeningLog ({ storage: null }).entries()).toEqual ([]);
});

test ('the summary reports rates, because counts only measure exposure', () => {
  const log = createListeningLog ({ storage: memory() });
  // A tune played often collects more of everything, so totals rank the
  // popular rather than the good.
  for (let i = 0; i < 8; i++) play (log, 'JIG', 'skipped', 6, 3);
  for (let i = 0; i < 2; i++) play (log, 'JIG', 'finished', 240, 96);
  for (let i = 0; i < 6; i++) play (log, 'REEL', 'finished', 240, 96);

  const attributes = code => ({ meter: code === 'JIG' ? '6/8' : '4/4' });
  const summary = summarise (log.entries(), attributes);

  expect (summary.plays).toBe (16);
  expect (summary.keep).toBeCloseTo (0.5, 2);

  const jig = summary.by.find (group => group.value === '6/8');
  const reel = summary.by.find (group => group.value === '4/4');
  expect (jig.plays).toBe (10);
  expect (jig.keep).toBeCloseTo (0.2, 2);
  expect (reel.keep).toBe (1);
  // Ranked by rate, so the reel leads despite being played less.
  expect (summary.by[0].value).toBe ('4/4');
});

test ('a group with too little behind it is left out', () => {
  const log = createListeningLog ({ storage: memory() });
  for (let i = 0; i < 3; i++) play (log, 'RARE', 'finished', 240, 96);
  const summary = summarise (log.entries(), code => ({ meter: '9/8' }));
  // Ranking on three plays is how you confidently learn noise.
  expect (summary.by).toHaveLength (0);
});

test ('the engine records a real session, with the time actually listened', async ({ page }) => {
  await page.goto ('/');
  await page.click ('#playButton');
  await page.waitForFunction (() => window.lofi.state.track);

  // Clearing drops whatever is open with it, so start a fresh track after —
  // and wait for it to be audible rather than for a clock, because `began`
  // fires on the first audible bar and that is however long the samples take.
  await page.evaluate (() => { window.lofi.listening.clear(); window.lofi.controls.skip(); });
  await page.waitForFunction (() => window.lofi.listening.listening);
  await page.waitForTimeout (2500);

  await page.evaluate (() => window.lofi.controls.skip());
  await page.waitForFunction (() => window.lofi.listening.entries().length >= 1);
  // And wait for the *next* track to be audible before stopping it.
  await page.waitForFunction (() => window.lofi.listening.listening);
  await page.waitForTimeout (1500);

  const entries = await page.evaluate (async () => {
    window.lofi.stop();
    await new Promise (resolve => setTimeout (resolve, 400));
    return window.lofi.listening.entries();
  });

  expect (entries.length).toBeGreaterThanOrEqual (2);
  expect (entries[0].outcome).toBe ('skipped');
  expect (entries.at (-1).outcome).toBe ('stopped');

  // Reading the clock wrongly records every track as zero seconds long, which
  // looks like data rather than like a bug.
  expect (entries[0].seconds).toBeGreaterThan (1);
  for (const entry of entries) {
    // A shape, not an exact length: the link format grows when a knob is
    // added, and this test is about the log rather than the codec.
    expect (entry.code).toMatch (/^[A-Za-z0-9_-]{40,120}$/);
    expect (entry.fraction).toBeGreaterThanOrEqual (0);
    expect (entry.fraction).toBeLessThanOrEqual (1);
    expect (entry.hour).toBeGreaterThanOrEqual (0);
    expect (entry.hour).toBeLessThan (24);
  }
  await page.evaluate (() => window.lofi.chain.input.context.close());
});

test ('the readout appears only once it has something to say', async ({ page }) => {
  await page.goto ('/');
  const bay = page.locator ('#listeningBay');
  const detail = page.locator ('#listeningDetail');

  // Nothing behind it yet: a rate off three tracks would be invented.
  await expect (bay).toBeHidden();

  // The readout refreshes as tracks come and go, so playback has to be under
  // way for the skip button to do anything at all.
  await page.click ('#playButton');
  await page.waitForFunction (() => window.lofi.state.track);
  await page.evaluate (() => window.lofi.listening.clear());

  const write = (outcome, seconds, barsHeard, times) => page.evaluate (
    ({ outcome, seconds, barsHeard, times }) => {
      const log = window.lofi.listening;
      // A real code, so the readout can decode a tune's attributes from it.
      const code = window.lofi.linkForCurrentTrack()
        ?? 'AQSfjc29DADHNgADAwACCQQBAAgBgFCIgIyZJE2AR0pFTUdZAJtZrni1gIYDAwICbw';
      for (let i = 0; i < times; i++) {
        log.began ({ code, title: 'x', bars: 96 });
        log.ended (outcome, { seconds, barsHeard });
      }
    }, { outcome, seconds, barsHeard, times });

  await write ('skipped', 6, 3, 8);
  await page.evaluate (() => document.getElementById ('skipButton').click());
  await expect (bay).toBeVisible();

  // Before anything has played out, ranking by that would read "played out
  // most — reels 0%", which is worse than saying nothing.
  await expect (detail).toContainText ('nothing has played out yet');
  await expect (detail).toContainText ('sent nowhere');

  await write ('finished', 240, 96, 6);
  await page.evaluate (() => document.getElementById ('skipButton').click());
  await expect (detail).toContainText ('play out most');

  // And it can be deleted, since it is the listener's own listening.
  await page.click ('#forgetListeningButton');
  await expect (bay).toBeHidden();
  expect (await page.evaluate (() => window.lofi.listening.entries().length)).toBe (0);
  await page.evaluate (() => window.lofi.chain.input.context.close());
});
