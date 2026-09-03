import { test, expect } from '@playwright/test';
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
  await page.evaluate (() => window.lofi.controls.tempo (50));
  await expect (page.locator ('#tempoReadout')).toHaveText ('74.0 bpm');
  await expect (page.locator ('[aria-label="tempo"]')).toHaveAttribute ('aria-valuemin', '74');
  await page.click ('#playButton');
  await expect (page.locator ('#tempoReadout')).toHaveText ('— bpm');
  await page.evaluate (() => window.lofi.chain.input.context.close());
});
