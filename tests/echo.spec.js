import { test, expect } from '@playwright/test';
import { decodeTrack, encodeTrack, quantiseRecipe } from '../src/track-link.js';
import { PROGRESSIONS } from '../src/theory.js';
import { titleAt } from '../src/track-names.js';
import { createTrackMaterialPicker } from '../src/track-material.js';

const recipe = () => {
  const material = createTrackMaterialPicker ({ storage: null }) ({ seed: 424242 });
  const title = titleAt (40);
  return quantiseRecipe ({
    version: 1, seed: 1234567890, materialSeed: material.materialSeed,
    motifA: material.motifA, motifB: material.motifB,
    title: title.title, titleEnglish: title.titleEnglish, titleLanguage: title.titleLanguage,
    rootMidi: 50, scale: 'dorian',
    structure: { style: 'tune', opening: 'melody', meter: '4/4', chordHold: 2,
      sections: ['A', 'A', 'B', 'A'] },
    progression: PROGRESSIONS.dorian[0], turns: 3, turnsSinceEnding: 0,
    arc: { shape: 'swell', length: 8, turn: 0 }, arcDepth: 0.5, tempoUser: 80, tempoOffset: 4,
    user: { density: 0.5, counter: 0.55, ornament: 0.6, drone: 0.14, dust: 0.3, support: 0.5,
      swing: 0.28, brightness: 0.29, wobble: 0.27, drive: 0.3, space: 0.28, pump: 0.35,
      volume: 0.9, echo: 0.62 },
    variation: {}, voices: { lead: 'harp', keys: 'felt', bass: 'electric' },
    auto: { lead: true, keys: true, bass: true }
  });
};

// A link minted before the echo knob existed. Kept verbatim, because the only
// way to know old links still work is to keep one and decode it.
const BEFORE_ECHO = 'AQSfjc29DADHNgADAwACCQQBAAgBgFCIgIyZJE2AR0pFTUdZAJtZrni1gIYDAwICbw';

test ('a link carries the echo, and links made before it still work', () => {
  const original = recipe();
  expect (decodeTrack (encodeTrack (original)).user.echo).toBeCloseTo (0.62, 2);

  // A knob added after the format existed goes at the very end of the layout,
  // not at the end of a list in the middle of it. Appending it to the tone
  // knobs shifted the variations, voices and title by a byte each, so this
  // link still decoded and quietly described a different tune — which is
  // worse than failing.
  const decoded = decodeTrack (BEFORE_ECHO);
  expect (decoded).not.toBeNull();
  expect (decoded.title).toBe ('humming in the rain');
  expect (decoded.titleLanguage).toBe ('en');
  expect (decoded.voices.bass).toBe ('sub');
  // Absent bytes read as nought, which is dry — the right default for a tune
  // that predates the effect.
  expect (decoded.user.echo).toBe (0);
});

test ('the echo is a send that leaves the low end alone', async ({ page }) => {
  await page.goto ('/');
  await page.click ('#playButton');
  await page.waitForFunction (() => window.lofi.state.track);

  const readings = await page.evaluate (async () => {
    const engine = window.lofi, chain = engine.chain;
    const read = () => ({
      send: chain.echoSend.gain.value,
      feedback: chain.echoDelay.feedback.value,
      delay: chain.echoDelay.delayTime.value,
      tempo: engine.state.tempo
    });

    engine.controls.echo (0);
    await new Promise (resolve => setTimeout (resolve, 700));
    const dry = read();

    engine.controls.echo (1);
    await new Promise (resolve => setTimeout (resolve, 700));
    const wet = read();
    return { dry, wet };
  });

  // Nought is properly dry, not merely quiet.
  expect (readings.dry.send).toBe (0);
  expect (readings.wet.send).toBeGreaterThan (readings.dry.send);
  // More echo wants a longer tail, or it reads as slapback.
  expect (readings.wet.feedback).toBeGreaterThan (readings.dry.feedback);
  // Feedback must stay under one, or the delay never decays.
  expect (readings.wet.feedback).toBeLessThan (0.8);

  // A dotted eighth at the track's tempo: the classic lofi echo, and it has to
  // follow the tempo rather than the tempo it was built at.
  expect (readings.wet.delay).toBeCloseTo (0.75 * 60 / readings.wet.tempo, 2);
  await page.evaluate (() => window.lofi.chain.input.context.close());
});

test ('the delay follows the tempo from track to track', async ({ page }) => {
  await page.goto ('/');
  await page.click ('#playButton');
  await page.waitForFunction (() => window.lofi.state.track);

  const seen = await page.evaluate (async () => {
    const engine = window.lofi;
    const out = [];
    for (let i = 0; i < 4; i++) {
      engine.controls.skip();
      await new Promise (resolve => setTimeout (resolve, 1800));
      out.push ({ tempo: engine.state.tempo, delay: engine.chain.echoDelay.delayTime.value });
    }
    return out;
  });

  expect (new Set (seen.map (entry => entry.tempo)).size).toBeGreaterThan (1);
  for (const { tempo, delay } of seen) expect (delay).toBeCloseTo (0.75 * 60 / tempo, 2);
  await page.evaluate (() => window.lofi.chain.input.context.close());
});
