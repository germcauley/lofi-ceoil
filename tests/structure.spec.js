import { test, expect } from '@playwright/test';
import { developRiff } from '../src/melody.js';
import { createStructurePicker } from '../src/track-structure.js';

test ('openings vary their low-end entrance and give the tune a stable repeat', async ({ page }) => {
  const failures = [];
  page.on ('pageerror', error => failures.push (error.message));
  page.on ('console', message => { if (/bar failed/.test (message.text())) failures.push (message.text()); });
  await page.goto ('/');
  const result = await page.evaluate (async () => {
    const e = window.lofi;
    const { LEAD_VOICES } = await import ('/src/instruments.js');
    const sample = LEAD_VOICES.piano();
    let seed = 721;
    Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const notes = [];
    // Observe actual instrument scheduling, including replacement voices on skip.
    const prototypes = new Set();
    for (const voice of [e.state.bass, e.state.drone, e.state.lead, e.state.keys, e.state.drums.kick, e.state.drums.snare, sample.voice]) {
      let proto = Object.getPrototypeOf (voice);
      while (! Object.hasOwn (proto, 'triggerAttackRelease')) proto = Object.getPrototypeOf (proto);
      prototypes.add (proto);
    }
    sample.dispose();
    for (const proto of prototypes) {
      const original = proto.triggerAttackRelease;
      proto.triggerAttackRelease = function (...args) {
        const s = e.state;
        const role = ['bass', 'drone', 'lead', 'keys'].find (key => s[key] === this)
          ?? Object.keys (s.drums).find (key => s.drums[key] === this);
        if (role) notes.push (role);
        return original.apply (this, args);
      };
    }
    const openings = [];
    const signature = phrase => JSON.stringify (phrase.map (({ at, degree, length }) => [at, degree, length]));
    await e.start();
    while (! e.state.track) await new Promise (r => setTimeout (r, 20));
    for (let i = 0; i < 12; i++) {
      if (i) { notes.length = 0; e.controls.skip(); }
      openings.push ({
        low: notes.some (role => ['bass', 'drone', 'kick'].includes (role)),
        roles: [...new Set (notes)].sort().join (','),
        repeat: signature (e.state.form[0]) === signature (e.state.form[e.state.track.structure?.sections.indexOf ('A', 1) ?? 1])
      });
      await new Promise (r => setTimeout (r, 180));
    }
    e.stop();
    await e.chain.input.context.close();
    return openings;
  });
  expect (failures).toEqual ([]);
  expect (result.every (opening => opening.roles.length > 0)).toBe (true);
  console.log ('Opening audit:', result);
  expect (result.filter (opening => ! opening.low).length).toBeGreaterThanOrEqual (4);
  expect (new Set (result.map (opening => opening.roles)).size).toBeGreaterThanOrEqual (3);
  expect (result.filter (opening => opening.repeat).length).toBeGreaterThanOrEqual (6);
});


test ('a track retains its tune across turns and opens only once', async ({ page }) => {
  await page.goto ('/');
  await page.click ('#playButton');
  await page.waitForFunction (() => window.lofi.state.track);
  const first = await page.evaluate (async () => {
    const e = window.lofi;
    // Select a structured, delayed-bass track through the real skip path.
    for (let i = 0; i < 10; i++) {
      if (e.state.track.structure.style !== 'drift' && e.state.arrangement[0].bassFrom > 0) break;
      e.controls.skip();
      await new Promise (r => setTimeout (r, 180));
    }
    const s = e.state;
    s.track.turnsLeft = 2;
    const result = { title: s.track.title, form: s.form, bassFrom: s.arrangement[0].bassFrom };
    const original = s.bass.triggerAttackRelease;
    window.introBassNotes = 0;
    s.bass.triggerAttackRelease = function (...args) {
      window.introBassNotes++;
      return original.apply (this, args);
    };
    // Bring bar five forward to verify that the withheld bass actually enters.
    s.formOffset = s.barIndex - 4;
    return result;
  });
  expect (first.bassFrom).toBeGreaterThan (0);
  await page.waitForFunction (() => window.introBassNotes > 0);
  await page.evaluate (() => {
    const s = window.lofi.state;
    s.formOffset = s.barIndex;
  });
  await page.waitForFunction (() => window.lofi.state.track?.turn === 2);
  const next = await page.evaluate (() => {
    const e = window.lofi, s = e.state;
    const result = { title: s.track.title, form: s.form, bassFrom: s.arrangement[0].bassFrom ?? 0 };
    e.stop();
    return result;
  });
  expect (next.title).toBe (first.title);
  expect (next.form).toEqual (first.form);
  expect (next.bassFrom).toBe (0);
  await page.evaluate (() => window.lofi.chain.input.context.close());
});

test ('riff repeats its rhythmic and melodic cell before question and answer cadences', () => {
  const motif = { start: 1, rhythm: [2, 1, 2, 2], offsets: [0, 2, 1, 0] };
  const phrase = developRiff (10, motif);
  const cell = bar => phrase.filter (e => Math.floor (e.at / 8) === bar)
    .map (e => [e.at % 8, e.length, e.degree]);
  for (const bar of [1, 2, 4, 5, 6]) expect (cell (bar)).toEqual (cell (0));
  expect (cell (7).at (-1)[2]).toBe (0);
  for (let i = 1; i < phrase.length; i++) {
    expect (phrase[i - 1].at + phrase[i - 1].length).toBeLessThanOrEqual (phrase[i].at);
  }
});

test ('opening selection covers every entrance without immediate repeats', () => {
  const next = createStructurePicker();
  const tracks = Array.from ({ length: 100 }, next);
  for (let i = 0; i < tracks.length; i += 5) {
    expect (new Set (tracks.slice (i, i + 5).map (track => track.opening)).size).toBe (5);
  }
  for (let i = 1; i < tracks.length; i++) expect (tracks[i].opening).not.toBe (tracks[i - 1].opening);
  expect (tracks.filter (track => track.style === 'drift')).toHaveLength (25);
});
