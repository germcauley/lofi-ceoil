import { test, expect } from '@playwright/test';

let failures;
test.beforeEach (async ({ page }) => {
  failures = [];
  page.on ('pageerror', error => failures.push (error.message));
  page.on ('console', message => {
    if (message.type() === 'error' && /bar failed|could not start/.test (message.text())) {
      failures.push (message.text());
    }
  });
  await page.goto ('/');
  await page.waitForFunction (() => window.lofi);
  await page.evaluate (() => {
    let seed = 127;
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  });
});

// Release Web Audio explicitly between browser cases, before the next page
// creates a context in the shared browser process.
test.afterEach (async ({ page }, testInfo) => {
  if (testInfo.status === 'timedOut' || page.isClosed()) return;
  await page.evaluate (async () => {
    if (! window.lofi) return;
    window.lofi.stop();
    await window.lofi.chain.input.context.close();
  });
});

test ('rapid skips replace queued audio, including during a set rest', async ({ page }) => {
  await page.evaluate (() => {
    const e = window.lofi;
    e.state.autoVoice = e.state.autoKeysVoice = e.state.autoBassVoice = false;
    e.controls.leadVoice ('harp (synth)');
  });
  await page.click ('#playButton');
  await page.waitForFunction (() => window.lofi.state.barIndex > 0);
  await page.waitForTimeout (400);
  for (let i = 0; i < 5; i++) {
    const before = await page.evaluate (() => window.lofi.state.trackNumber);
    await page.click ('#skipButton');
    await expect.poll (() => page.evaluate (() => window.lofi.state.trackNumber), { timeout: 1000 }).toBe (before + 1);
    await page.waitForTimeout (200);
  }
  await page.evaluate (() => { window.lofi.state.resting = 3; });
  const before = await page.evaluate (() => window.lofi.state.trackNumber);
  await page.click ('#skipButton');
  await expect.poll (() => page.evaluate (() => window.lofi.state.trackNumber), { timeout: 1000 }).toBe (before + 1);
  expect (failures).toEqual ([]);
  await page.click ('#playButton');
  await page.click ('#playButton');
  await page.waitForFunction (() => window.lofi.state.barIndex > 0);
  expect (failures).toEqual ([]);
});

test ('knobs remain the centres of track variation and zero arc is exact', async ({ page }) => {
  const actual = await page.evaluate (() => {
    const e = window.lofi;
    e.state.track = { tempoOffset: 4, variation: { counter: 0.2, dust: -0.2 } };
    e.controls.tempo (79);
    e.controls.arc (0);
    e.controls.counter (0.23);
    e.controls.ornament (0.14);
    e.controls.drone (0.18);
    e.controls.pump?.(0.67);
    e.controls.dust (0.76);
    // Reapplying another knob must preserve all the user's choices.
    e.controls.brightness (0.4);
    return { counter: e.state.counter, ornament: e.state.ornament,
      drone: e.state.droneLevel, pump: e.state.pump, dust: e.state.dust, tempo: e.state.tempo };
  });
  expect (actual).toEqual ({ counter: 0.23, ornament: 0.14, drone: 0.18, pump: 0.67, dust: 0.76, tempo: 79 });
});

test ('simultaneous voice loads are independent and latest choice wins', async ({ page }) => {
  await page.route ('**/samples/**/*.mp3', async route => {
    await new Promise (resolve => setTimeout (resolve, 150));
    await route.continue();
  });
  await page.evaluate (() => {
    const e = window.lofi;
    e.controls.leadVoice ('harp');
    e.controls.keysVoice ('piano');
    e.controls.bassVoice ('upright');
  });
  await expect.poll (() => page.evaluate (() => {
    const s = window.lofi.state;
    return [s.leadVoice, s.keysVoice, s.bassVoice];
  })).toEqual (['harp', 'piano', 'upright']);
  await page.evaluate (() => {
    window.lofi.controls.leadVoice ('piano');
    window.lofi.controls.leadVoice ('marimba');
  });
  await page.waitForTimeout (500);
  expect (await page.evaluate (() => window.lofi.state.leadVoice)).toBe ('marimba');
  expect (failures).toEqual ([]);
});

test ('auto tracks change voices and settings without reloading samples or moving the level', async ({ page }) => {
  let sampleRequests = 0;
  page.on ('request', request => { if (request.url().includes ('/samples/')) sampleRequests++; });
  await page.click ('#playButton');
  await page.waitForFunction (() => window.lofi.state.barIndex > 0);
  const initialRequests = sampleRequests;
  await page.evaluate (() => window.lofi.controls.volume (0.37));
  const transitions = await page.evaluate (async () => {
    const e = window.lofi;
    const results = [];
    for (let i = 0; i < 8; i++) {
      const before = [e.state.leadVoice, e.state.keysVoice, e.state.bassVoice];
      const oldVoices = [e.state.lead, e.state.keys, e.state.bass, e.state.pluck, e.state.drums.snare, e.state.vinyl.pops];
      const variation = JSON.stringify (e.state.track.variation);
      const progression = e.state.progression.name;
      const started = performance.now();
      const original = e.state.onBar;
      await new Promise ((resolve, reject) => {
        const timeout = setTimeout (() => reject (new Error ('skip did not reach the audible bar')), 1500);
        e.state.onBar = (...args) => {
          original (...args);
          e.state.onBar = original;
          clearTimeout (timeout);
          resolve();
        };
        e.controls.skip();
      });
      const latency = performance.now() - started;
      await new Promise (resolve => setTimeout (resolve, 250));
      results.push ({
        latency,
        freshVoices: [e.state.leadVoice, e.state.keysVoice, e.state.bassVoice].every ((name, index) => name !== before[index]),
        freshSettings: JSON.stringify (e.state.track.variation) !== variation,
        freshHarmony: e.state.progression.name !== progression,
        disposed: oldVoices.every (voice => voice.disposed),
        level: e.chain.master.gain.value,
        audible: e.getLevel() > 0
      });
    }
    return results;
  });
  for (const result of transitions) {
    expect (result.latency).toBeLessThan (750);
    expect (result.freshVoices).toBe (true);
    expect (result.freshSettings).toBe (true);
    expect (result.freshHarmony).toBe (true);
    expect (result.disposed).toBe (true);
    expect (result.level).toBeCloseTo (0.37);
    expect (result.audible).toBe (true);
  }
  console.log ('Audible skip latency (ms):', transitions.map (result => Math.round (result.latency)).join (', '));
  expect (sampleRequests).toBe (initialRequests);
  const bar = await page.evaluate (() => window.lofi.state.barIndex);
  await expect.poll (() => page.evaluate (() => window.lofi.state.barIndex), { timeout: 10000 }).toBeGreaterThan (bar + 1);
  for (const row of ['lead', 'keys', 'bass']) {
    await expect (page.locator (`#${row}VoiceRow .auto-pick`)).toHaveCount (1);
  }
  expect (failures).toEqual ([]);
});

test ('manual choices survive a skip and returning to auto shows the current voice', async ({ page }) => {
  await page.click ('#playButton');
  await page.waitForFunction (() => window.lofi.state.barIndex > 0);
  for (const [row, name] of [['lead', 'harp'], ['keys', 'felt'], ['bass', 'sub']]) {
    await page.locator (`#${row}VoiceRow .seg`).filter ({ hasText: new RegExp (`^${name}$`) }).click();
    await expect (page.locator (`#${row}VoiceRow .auto-pick`)).toHaveCount (0);
  }
  const before = await page.evaluate (() => window.lofi.state.trackNumber);
  await page.click ('#skipButton');
  await expect.poll (() => page.evaluate (() => window.lofi.state.trackNumber)).toBe (before + 1);
  expect (await page.evaluate (() => {
    const s = window.lofi.state;
    return [s.leadVoice, s.keysVoice, s.bassVoice];
  })).toEqual (['harp', 'felt', 'sub']);
  await page.locator ('#leadVoiceRow .seg').filter ({ hasText: /^auto$/ }).click();
  await expect (page.locator ('#leadVoiceRow .auto-pick')).toHaveText ('harp');
  expect (failures).toEqual ([]);
});

test ('a title belongs to its track through turns, transitions and stop/restart', async ({ page }) => {
  await page.click ('#playButton');
  await page.waitForFunction (() => window.lofi.state.track?.title);
  const first = await page.evaluate (() => window.lofi.state.track.title);
  await expect (page.locator ('#trackTitle')).toHaveText (first);
  await expect (page.locator ('#trackNumber')).toHaveText ('track 001');
  await expect (page).toHaveTitle (`${first} · Lofi Ceoil`);

  // Bring the next turn forward without changing the clock or note times.
  const bar = await page.evaluate (() => {
    const s = window.lofi.state;
    s.track.turnsLeft = 2;
    s.formOffset = s.barIndex;
    return s.barIndex;
  });
  await expect.poll (() => page.evaluate (() => window.lofi.state.barIndex), { timeout: 5000 }).toBeGreaterThan (bar);
  expect (await page.evaluate (() => window.lofi.state.track.title)).toBe (first);
  await expect (page.locator ('#trackTitle')).toHaveText (first);

  // Let a natural track boundary arrive on the next bar.
  await page.evaluate (() => {
    const s = window.lofi.state;
    s.track.turnsLeft = 0;
    s.formOffset = s.barIndex;
  });
  await expect.poll (() => page.evaluate (() => window.lofi.state.trackNumber), { timeout: 5000 }).toBe (2);
  const second = await page.evaluate (() => window.lofi.state.track.title);
  expect (second).not.toBe (first);
  await expect (page.locator ('#trackTitle')).toHaveText (second);
  await expect (page.locator ('#trackNumber')).toHaveText ('track 002');

  await page.click ('#skipButton');
  const third = await page.evaluate (() => window.lofi.state.track.title);
  expect ([first, second]).not.toContain (third);
  await expect (page.locator ('#trackTitle')).toHaveText (third);
  await expect (page.locator ('#trackNumber')).toHaveText ('track 003');

  // A pending draw from a skipped track must not overwrite the stopped UI.
  await page.evaluate (() => {
    document.getElementById ('skipButton').click();
    document.getElementById ('playButton').click();
  });
  await page.waitForTimeout (300);
  await expect (page.locator ('#trackTitle')).toHaveText ('press start, stay awhile');
  await expect (page).toHaveTitle ('Lofi Ceoil — generative Irish lofi');
  await page.click ('#playButton');
  await expect (page.locator ('#trackLabel')).toHaveText ('now playing');
  expect ([first, second, third]).not.toContain (await page.locator ('#trackTitle').textContent());
  expect (failures).toEqual ([]);
});
