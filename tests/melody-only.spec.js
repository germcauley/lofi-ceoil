import { test, expect } from '@playwright/test';

test.afterEach (async ({ page }) => {
  await page.evaluate (async () => {
    window.lofi.stop();
    await window.lofi.chain.input.context.close();
  }).catch (() => {});
});

/** Melody only is measured through the real chain rather than read off a flag.
    What matters is what reaches the speakers, and a part can be muted in state
    and still arrive by another road — the counter line and the support both
    feed the echo, for one. So the echo is turned well up for this. */
test ('melody only silences everything but the tune, and brings it all back', async ({ page }) => {
  test.setTimeout (60000);
  await page.goto ('/');

  const levels = await page.evaluate (async () => {
    const e = window.lofi;
    const context = e.chain.master.context;
    await context.resume();
    const raw = context.rawContext;
    const analyser = raw.createAnalyser();
    analyser.fftSize = 2048;
    e.chain.master.connect (analyser);
    const buffer = new Float32Array (analyser.fftSize);

    // No record surface, and plenty of echo to leak through if anything did.
    e.controls.dust (0);
    e.controls.echo (0.9);

    // The lead is a sampled voice; give it time to finish loading.
    const deadline = Date.now() + 8000;
    while (e.state.lead.loaded === false && Date.now() < deadline) {
      await new Promise (resolve => setTimeout (resolve, 100));
    }

    async function loudness (fire) {
      await new Promise (resolve => setTimeout (resolve, 900));
      fire (raw.currentTime + 0.1);
      let energy = 0, samples = 0;
      const until = Date.now() + 1400;
      while (Date.now() < until) {
        analyser.getFloatTimeDomainData (buffer);
        for (const value of buffer) { energy += value * value; samples++; }
        await new Promise (resolve => setTimeout (resolve, 10));
      }
      const rms = Math.sqrt (energy / samples);
      return rms > 0 ? 20 * Math.log10 (rms) : -120;
    }

    const s = e.state;
    const parts = {
      bass: t => s.bass.triggerAttackRelease ('C2', 1, t, 0.75),
      keys: t => ['D3', 'F3', 'A3'].forEach (note => s.keys.triggerAttackRelease (note, 0.8, t, 0.35)),
      counter: t => s.pluck.triggerAttackRelease ('A4', 0.4, t, 0.6),
      kick: t => s.drums.kick.triggerAttackRelease ('C1', 0.25, t, 0.9),
      snare: t => s.drums.snare.triggerAttackRelease (0.25, t, 0.7),
      lead: t => s.lead.triggerAttackRelease ('D4', 0.6, t, 0.55)
    };

    e.controls.melodyOnly (true);
    const muted = {};
    for (const name of ['bass', 'keys', 'counter', 'kick', 'snare']) muted[name] = await loudness (parts[name]);
    const pumpWhileMuted = s.pump;
    const tune = await loudness (parts.lead);

    e.controls.melodyOnly (false);
    // Past the lead's tail before listening to the bass again.
    await new Promise (resolve => setTimeout (resolve, 2500));
    const restored = { bass: await loudness (parts.bass), kick: await loudness (parts.kick) };

    return { muted, tune, restored, pumpWhileMuted, pumpAfter: s.pump };
  });

  console.log ('melody only:', JSON.stringify (levels));

  for (const [name, db] of Object.entries (levels.muted)) {
    expect (db, `${name} while melody only`).toBeLessThan (-80);
  }
  expect (levels.tune).toBeGreaterThan (-55);
  expect (levels.restored.bass).toBeGreaterThan (-55);
  expect (levels.restored.kick).toBeGreaterThan (-60);

  // With the kit gone, nothing is left to duck to.
  expect (levels.pumpWhileMuted).toBe (0);
  expect (levels.pumpAfter).toBeGreaterThan (0);
});

test ('the switch holds across tracks, answers to M, and leaves the tune alone', async ({ page }) => {
  await page.goto ('/');
  const button = page.locator ('#melodyOnlyButton');
  await expect (button).toHaveAttribute ('aria-pressed', 'false');

  // It can be set before anything plays.
  await button.click();
  await expect (button).toHaveAttribute ('aria-pressed', 'true');
  expect (await page.evaluate (() => window.lofi.state.melodyOnly)).toBe (true);

  await page.click ('#playButton');
  await page.waitForFunction (() => window.lofi.state.track?.composition);

  // Not part of the tune: switching it does not change what a link names.
  const before = await page.evaluate (() => window.lofi.linkForCurrentTrack());
  await page.mouse.click (4, 4);
  await page.keyboard.press ('m');
  await expect (button).toHaveAttribute ('aria-pressed', 'false');
  await page.keyboard.press ('m');
  await expect (button).toHaveAttribute ('aria-pressed', 'true');
  expect (await page.evaluate (() => window.lofi.linkForCurrentTrack())).toBe (before);

  // A new track rebuilds the instruments; the switch has to survive that.
  await page.click ('#skipButton');
  await expect.poll (() => page.evaluate (() => window.lofi.state.trackNumber)).toBe (2);
  expect (await page.evaluate (() => window.lofi.state.melodyOnly)).toBe (true);
  await expect (button).toHaveAttribute ('aria-pressed', 'true');
  await expect.poll (() => page.evaluate (() => window.lofi.state.drums.level.gain.value)).toBeLessThan (0.01);
});
