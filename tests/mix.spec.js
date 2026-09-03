import { test, expect } from '@playwright/test';

test ('the default drone remains a quiet supporting layer', async ({ page }) => {
  await page.goto ('/');
  const measured = await page.evaluate (async () => {
    const e = window.lofi;
    const context = e.chain.master.context;
    await context.resume();
    const analyser = context.rawContext.createAnalyser();
    analyser.fftSize = 2048;
    e.state.drone.connect (analyser);
    const at = context.rawContext.currentTime + 0.1;
    e.state.drone.triggerAttackRelease ('G2', 2.5, at, 0.14 * 0.32);
    await new Promise (resolve => setTimeout (resolve, 1200));
    const buffer = new Float32Array (analyser.fftSize);
    let energy = 0, samples = 0;
    for (let i = 0; i < 40; i++) {
      analyser.getFloatTimeDomainData (buffer);
      for (const value of buffer) { energy += value * value; samples++; }
      await new Promise (resolve => setTimeout (resolve, 15));
    }
    const rmsDb = 20 * Math.log10 (Math.sqrt (energy / samples));
    analyser.disconnect();
    await context.close();
    return rmsDb;
  });
  console.log ('Default drone RMS dBFS:', measured.toFixed (1));
  expect (measured).toBeGreaterThan (-95);
  expect (measured).toBeLessThan (-55);
});
