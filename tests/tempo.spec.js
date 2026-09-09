import { test, expect } from '@playwright/test';
import { MIN_TEMPO, turnsFor, barSecondsAt } from '../src/track-tempo.js';
import { meterInfo } from '../src/musical-meter.js';
import { chooseTempoOffset, clampTempo } from '../src/track-tempo.js';

test ('adjacent default tempos differ by at least four BPM, including at the range edges', () => {
  for (const base of [74, 80, 95]) {
    let previous = 0;
    for (let i = 0; i < 60; i++) {
      const next = chooseTempoOffset (previous, base, 0.5, () => (i % 10) / 10);
      const bpm = offset => clampTempo (base + offset * 0.5);
      expect (Math.abs (bpm (next) - bpm (previous))).toBeGreaterThanOrEqual (4);
      previous = next;
    }
  }
});

test ('live tempo readout follows new tracks and zero drift uses the exact knob tempo', async ({ page }) => {
  await page.goto ('/');
  await page.click ('#playButton');
  await page.waitForFunction (() => window.lofi.state.track);
  await page.waitForTimeout (600);
  const first = await page.evaluate (() => window.lofi.getTempo());
  await page.click ('#skipButton');
  await page.waitForTimeout (600);
  const second = await page.evaluate (() => window.lofi.getTempo());
  expect (Math.abs (first - second)).toBeGreaterThanOrEqual (3.9);
  await expect (page.locator ('#tempoReadout')).toHaveText (`${second.toFixed (1)} bpm`);
  await page.evaluate (() => { window.lofi.controls.arc (0); window.lofi.controls.tempo (79); });
  await expect (page.locator ('#tempoReadout')).toHaveText ('79.0 bpm');
  // Below the floor clamps to it. The floor is a constant, not 74 — it was
  // lowered so a slow air is reachable.
  await page.evaluate (() => window.lofi.controls.tempo (40));
  await expect (page.locator ('#tempoReadout')).toHaveText (`${MIN_TEMPO.toFixed (1)} bpm`);
  await expect (page.locator ('[aria-label="tempo"]')).toHaveAttribute ('aria-valuemin', String (MIN_TEMPO));
  await page.click ('#playButton');
  await expect (page.locator ('#tempoReadout')).toHaveText ('— bpm');
  await page.evaluate (() => window.lofi.chain.input.context.close());
});

/** How long a track runs is the turn count times the tempo times the meter,
    and only the first of those was ever chosen. Measured, that put tracks
    anywhere between 1.3 minutes and 8.3: a fast jig played twice was over
    before it began, and a slow 4/4 played four times was eight and a quarter
    minutes on one title. Both were the same decision made blind. */
test ('a track runs somewhere between two and five minutes, whatever the tempo', () => {
  const lengths = [];
  for (const meter of ['4/4', '6/8']) {
    for (let tempo = MIN_TEMPO; tempo <= 100; tempo += 2) {
      const bar = barSecondsAt (tempo, meterInfo (meter));
      // Walk the whole range of the target rather than sampling it.
      for (let roll = 0; roll < 1; roll += 0.02) {
        const turns = turnsFor (bar, () => roll);
        expect (turns).toBeGreaterThanOrEqual (2);
        expect (turns).toBeLessThanOrEqual (4);
        lengths.push (turns * bar * 32 / 60);
      }
    }
  }

  // Never a side, never a snippet. The bounds are exact rather than
  // approached: the shortest a track can be is two minutes on the nose, a
  // 6/8 at sixty-four played twice, and the longest is a shade under five.
  expect (Math.max (...lengths)).toBeLessThanOrEqual (5);
  expect (Math.min (...lengths)).toBeGreaterThanOrEqual (2);

  // And still varied: a run of tracks is not all the same length.
  expect (new Set (lengths.map (minutes => minutes.toFixed (1))).size).toBeGreaterThan (12);
});

test ('a longer bar is played fewer times, which is the point of choosing by duration', () => {
  const always = (bar, roll) => turnsFor (bar, () => roll);
  for (const roll of [0.1, 0.5, 0.9]) {
    const slow = always (barSecondsAt (64, meterInfo ('4/4')), roll);
    const quick = always (barSecondsAt (96, meterInfo ('6/8')), roll);
    expect (quick).toBeGreaterThanOrEqual (slow);
  }
});
