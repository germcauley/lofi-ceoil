import { test, expect } from '@playwright/test';

test ('sampled guitar sounds in both roles and stays selected across skips without reloading', async ({ page }) => {
  const errors = [], requests = [];
  page.on ('pageerror', error => errors.push (error.message));
  page.on ('console', message => { if (/bar failed|could not start/.test (message.text())) errors.push (message.text()); });
  page.on ('request', request => { if (/samples\/guitar\/.*\.mp3/.test (request.url())) requests.push (request.url()); });
  await page.goto ('/');
  await page.locator ('#leadVoiceRow').getByRole ('radio', { name: 'guitar', exact: true }).click ();
  await page.locator ('#keysVoiceRow').getByRole ('radio', { name: 'guitar', exact: true }).click ();
  await page.waitForFunction (() => window.lofi.state.leadVoice === 'guitar' && window.lofi.state.keysVoice === 'guitar');
  const peaks = await page.evaluate (async () => {
    const e = window.lofi, ctx = e.chain.master.context;
    await ctx.resume ();
    const probes = ['lead', 'keys'].map (role => {
      const analyser = ctx.rawContext.createAnalyser ();
      analyser.fftSize = 2048;
      e.state[role].connect (analyser);
      e.state[role].triggerAttackRelease ('E4', 0.5, ctx.rawContext.currentTime + 0.1, 0.5);
      return { analyser, peak: 0 };
    });
    for (let i = 0; i < 35; i++) {
      for (const p of probes) {
        const data = new Float32Array (2048);
        p.analyser.getFloatTimeDomainData (data);
        for (const n of data) p.peak = Math.max (p.peak, Math.abs (n));
      }
      await new Promise (resolve => setTimeout (resolve, 20));
    }
    probes.forEach (p => p.analyser.disconnect ());
    return probes.map (p => p.peak);
  });
  expect (peaks[0]).toBeGreaterThan (0.01);
  expect (peaks[0]).toBeLessThan (0.2);
  expect (peaks[1] / peaks[0]).toBeGreaterThan (0.4);
  expect (peaks[1] / peaks[0]).toBeLessThan (0.65);
  expect (new Set (requests).size).toBe (10);
  const loaded = requests.length;
  await page.click ('#playButton');
  await page.waitForFunction (() => window.lofi.state.track);
  for (let i = 0; i < 3; i++) {
    await page.click ('#skipButton');
    await page.waitForTimeout (250);
  }
  expect (await page.evaluate (() => [window.lofi.state.leadVoice, window.lofi.state.keysVoice])).toEqual (['guitar', 'guitar']);
  expect (requests.length).toBe (loaded);
  await page.click ('#playButton');
  expect (errors).toEqual ([]);
  await page.waitForTimeout (300);
  await page.evaluate (() => window.lofi.chain.input.context.close ());
});
