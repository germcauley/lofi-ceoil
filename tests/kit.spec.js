import { test, expect } from '@playwright/test';

test ('the kit is sampled, and each role is its own voice at its own level', async ({ page }) => {
  await page.goto ('/');
  await page.click ('#playButton');
  await page.waitForFunction (() => window.lofi.state.track);

  const kit = await page.evaluate (() => {
    const drums = window.lofi.state.drums;
    return {
      roles: ['kick', 'snare', 'ghost', 'hat'].map (role => typeof drums[role]?.triggerAttackRelease),
      // One sampler per role. Sharing one across them would send every hit
      // through every role's gain, so a hat would arrive at the volume of a
      // kick.
      distinctVoices: new Set (Object.values (drums.voices)).size,
      volumes: ['kick', 'snare', 'ghost', 'hat'].map (role => Math.round (drums.voices[role].volume.value)),
      // They meet at one gain, so the kit can be turned down as a kit.
      outputs: drums.outputs.length,
      level: drums.level.gain.value
    };
  });

  expect (kit.roles).toEqual (['function', 'function', 'function', 'function']);
  expect (kit.distinctVoices).toBe (4);
  expect (kit.outputs).toBe (1);
  expect (kit.level).toBe (1);

  // A kit is not levelled flat: the kick carries and the hats sit back.
  const [kick, snare, ghost, hat] = kit.volumes;
  expect (kick).toBeGreaterThan (snare);
  expect (snare).toBeGreaterThan (hat);
  expect (ghost).toBeLessThan (snare);
  await page.evaluate (() => window.lofi.chain.input.context.close());
});

test ('the drums knob turns the kit off, and nought means silent', async ({ page }) => {
  await page.goto ('/');
  await page.click ('#playButton');
  await page.waitForFunction (() => window.lofi.state.track);

  const readings = await page.evaluate (async () => {
    const engine = window.lofi;
    const level = () => engine.state.drums.level.gain.value;
    engine.controls.drums (0);
    await new Promise (resolve => setTimeout (resolve, 500));
    const off = level();
    engine.controls.drums (0.5);
    await new Promise (resolve => setTimeout (resolve, 500));
    const half = level();
    engine.controls.drums (1);
    await new Promise (resolve => setTimeout (resolve, 500));
    return { off, half, on: level() };
  });

  // Properly silent, not merely quiet.
  expect (readings.off).toBe (0);
  expect (readings.half).toBeGreaterThan (0);
  expect (readings.half).toBeLessThan (readings.on);
  expect (readings.on).toBe (1);
  await page.evaluate (() => window.lofi.chain.input.context.close());
});

test ('the kit actually sounds, and does not clip', async ({ page }) => {
  await page.goto ('/');
  await page.click ('#playButton');
  await page.waitForFunction (() => window.lofi.state.track);

  const levels = await page.evaluate (async () => {
    const engine = window.lofi, chain = engine.chain;
    await new Promise (resolve => setTimeout (resolve, 2500));

    const context = chain.master.context.rawContext ?? chain.master.context;
    const ofKit = context.createAnalyser(); ofKit.fftSize = 2048;
    engine.state.drums.outputs.forEach (out => out.connect (ofKit));
    const ofMix = context.createAnalyser(); ofMix.fftSize = 2048;
    chain.master.connect (ofMix);

    // Hit the kit directly rather than waiting for a track that happens to
    // have one: scorings without drums are silent on purpose, so relying on
    // the draw makes this test pass or fail by luck.
    const Tone = await import ('/node_modules/.vite/deps/tone.js');
    let at = Tone.now() + 0.1;
    for (let i = 0; i < 24; i++) {
      engine.state.drums.kick.triggerAttackRelease (0.3, at, 0.9);
      engine.state.drums.hat.triggerAttackRelease (0.1, at + 0.12, 0.6);
      engine.state.drums.snare.triggerAttackRelease (0.3, at + 0.24, 0.85);
      at += 0.36;
    }

    const a = new Float32Array (2048), b = new Float32Array (2048);
    let kitPeak = 0, mixPeak = 0;
    const until = performance.now() + 9500;
    while (performance.now() < until) {
      ofKit.getFloatTimeDomainData (a);
      ofMix.getFloatTimeDomainData (b);
      for (let i = 0; i < 2048; i++) {
        kitPeak = Math.max (kitPeak, Math.abs (a[i]));
        mixPeak = Math.max (mixPeak, Math.abs (b[i]));
      }
      await new Promise (resolve => setTimeout (resolve, 10));
    }
    return { kitPeak, mixPeak };
  });

  // Sampled drums that never load would be silence, and silence looks like a
  // quiet mix rather than like a fault. This is the thing worth pinning here.
  expect (levels.kitPeak).toBeGreaterThan (0.01);
  expect (levels.kitPeak).toBeLessThan (1);
  expect (levels.mixPeak).toBeGreaterThan (0.01);

  // Deliberately not asserting the kit sits under the mix. These taps are not
  // comparable — the kit is measured at its own outputs, before the tape path
  // and the limiter, while the mix is measured after both — and the hits above
  // are fired at a velocity the music never uses. Whether the kit sits back is
  // settled by the role levels in the test above, and was measured by hand:
  // 5.8 dB under the mix peak in a full-scored track.
  await page.evaluate (() => window.lofi.chain.input.context.close());
});

test ('a scoring without a kit really has none', async ({ page }) => {
  await page.goto ('/');
  const silent = await page.evaluate (async () => {
    const { composeTrack } = await import ('/src/composition.js');
    const { PROGRESSIONS } = await import ('/src/theory.js');
    const { createTrackMaterialPicker } = await import ('/src/track-material.js');
    const material = createTrackMaterialPicker ({ storage: null }) ({ seed: 7 });
    const score = composeTrack ({
      version: 1, seed: 99, materialSeed: material.materialSeed,
      motifA: material.motifA, motifB: material.motifB,
      title: 'x', titleEnglish: null, titleLanguage: 'en', rootMidi: 48, scale: 'dorian',
      structure: { style: 'tune', opening: 'full', meter: '4/4', chordHold: 2,
        scoring: 'bare', sections: ['A', 'A', 'B', 'A'] },
      progression: PROGRESSIONS.dorian[0], turns: 2, turnsSinceEnding: 0,
      arc: { shape: 'swell', length: 8, turn: 0 }, arcDepth: 0.5,
      tempoUser: 80, tempoOffset: 0,
      user: { density: 0.9, counter: 0.55, ornament: 0.6, drone: 0.14, dust: 0.3,
        support: 0.5, swing: 0.28 },
      variation: {}, voices: { lead: 'harp', keys: 'felt', bass: 'round' },
      auto: { lead: true, keys: true, bass: true },
      voiceOptions: { lead: ['harp'], keys: ['felt'], bass: ['round'] }
    });
    return score.bars.some (bar =>
      bar.notes.some (note => ['kick', 'snare', 'hat', 'ghost'].includes (note.role)));
  });
  expect (silent).toBe (false);
});
