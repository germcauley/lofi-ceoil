import { test, expect } from '@playwright/test';
import { playVinyl } from '../src/parts.js';

test ('vinyl events remain ordered when a faster bar catches scheduled noise', () => {
  const streams = {};
  const vinyl = Object.fromEntries (['crackle', 'pops', 'scuff'].map (role => [role, {
    triggerAttackRelease (duration, time) { (streams[role] ??= []).push (time); }
  }]));
  const state = { vinyl, dust: 1, tempo: 50, random: () => 0.9 };
  playVinyl (state, 0);
  state.tempo = 100;
  state.random = () => 0.1;
  playVinyl (state, 2.4);
  playVinyl (state, 4.8);
  expect (streams.crackle.length).toBeGreaterThan (1);
  for (const times of Object.values (streams)) {
    expect (times.every ((time, i) => i === 0 || time > times[i - 1])).toBe (true);
  }
});

test ('the vinyl bed is quiet at default dust and silent at zero', async ({ page }) => {
  await page.goto ('/');
  const levels = await page.evaluate (async () => {
    const e = window.lofi, context = e.chain.master.context;
    await context.resume();
    const { playVinyl } = await import ('/src/parts.js');
    const analyser = context.rawContext.createAnalyser();
    analyser.fftSize = 2048;
    e.state.vinyl.level.connect (analyser);
    e.controls.arc (0);
    e.controls.dust (0.3);
    e.state.vinyl.hiss.start();
    await new Promise (resolve => setTimeout (resolve, 1600));
    let seed = 77;
    e.state.random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    playVinyl (e.state, context.rawContext.currentTime + 0.1);
    const measure = async frames => {
      const buffer = new Float32Array (analyser.fftSize);
      let energy = 0, samples = 0, peak = 0;
      for (let i = 0; i < frames; i++) {
        analyser.getFloatTimeDomainData (buffer);
        for (const value of buffer) {
          energy += value * value; samples++;
          peak = Math.max (peak, Math.abs (value));
        }
        await new Promise (resolve => setTimeout (resolve, 20));
      }
      return { rms: 20 * Math.log10 (Math.sqrt (energy / samples)), peak };
    };
    const normal = await measure (180);
    e.controls.dust (0);
    await new Promise (resolve => setTimeout (resolve, 1700));
    // Keep scheduling at zero: the gain must silence the entire surface.
    playVinyl (e.state, context.rawContext.currentTime + 0.1);
    const muted = await measure (30);
    e.state.vinyl.hiss.stop();
    await context.close();
    return { normal, muted };
  });
  expect (levels.normal.rms).toBeGreaterThan (-65);
  expect (levels.normal.rms).toBeLessThan (-40);
  expect (levels.normal.peak).toBeGreaterThan (0.001);
  expect (levels.normal.peak).toBeLessThan (0.1);
  expect (levels.muted.peak).toBeLessThan (0.00001);
});
