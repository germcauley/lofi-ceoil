import { test, expect } from '@playwright/test';
import { composeTrack, reviseComposition } from '../src/composition.js';
import { PROGRESSIONS } from '../src/theory.js';
import { jigPhrase } from '../src/musical-meter.js';
import { createPlaybackTimeline } from '../src/playback-timeline.js';

const recipe = {
  version: 1, seed: 428, title: 'Jig test', rootMidi: 48, scale: 'dorian',
  structure: { meter: '6/8', style: 'tune', opening: 'full', sections: ['A', 'A', 'B', 'A'], chordHold: 2 },
  motifA: { start: 0, rhythm: [1, 1, 1, 1, 2, 2], offsets: [0, 1, 2, 0, 1, 0] },
  motifB: { start: 1, rhythm: [2, 1, 2, 2], offsets: [0, 2, 3, 1] },
  progression: PROGRESSIONS.dorian[0], turns: 3, turnsSinceEnding: 0,
  variation: {}, tempoOffset: 0, tempoUser: 80, arcDepth: 0.5,
  arc: { shape: 'swell', length: 8, turn: 0 },
  user: { density: 0.5, counter: 0.55, ornament: 0.6, support: 0.5, drone: 0.14, dust: 0.3, swing: 0.28 },
  voices: { lead: 'guitar', keys: 'guitar', bass: 'round' },
  auto: {}, voiceOptions: {}
};

test ('jig phrasing uses integer quavers, keeps cadences and spaces notes', () => {
  const notes = Array.from ({ length: 8 }, (_, at) => ({ at, length: 1, degree: at }));
  expect (jigPhrase (notes).map (n => n.at)).toEqual ([0, 1, 2, 3, 4, 5]);
  expect (jigPhrase ([{ at: 60, length: 4, degree: 0 }])).toMatchObject ([{ at: 45, length: 3, degree: 0 }]);
});

test ('jig scores and edits reproduce, with all instruments inside three quarter beats', () => {
  for (let seed = 0; seed < 20; seed++) {
    const score = composeTrack ({ ...recipe, seed });
    expect (score.beatsPerBar).toBe (3);
    expect (composeTrack (JSON.parse (JSON.stringify (score.recipe)))).toEqual (score);
    expect (score.turns.at (-1).phrases[0]).toEqual (score.turns[0].phrases[0]);
    const invalid = score.bars.flatMap (bar => bar.notes.filter (n =>
      !Number.isFinite (n.at) || n.at < 0 || n.at >= 3 || !Number.isFinite (n.duration) || n.duration <= 0));
    expect (invalid).toEqual ([]);
    for (const bar of score.bars) {
      const backbeats = bar.notes.filter (n => n.role === 'snare' && !n.fill);
      expect (backbeats.every (n => Math.abs (n.at - 1.5) < 0.025)).toBe (true);
      expect (bar.counterPlan.busy.every (row => row.length === 6)).toBe (true);
    }
    const edits = { user: { ...recipe.user, counter: 0, drone: 0 } };
    const revised = reviseComposition (score, 16, edits);
    expect (revised.bars.slice (0, 16)).toEqual (score.bars.slice (0, 16));
    expect (reviseComposition (composeTrack (score.recipe), 16, edits)).toEqual (revised);
  }
});

test ('playhead and ending use the score meter', () => {
  const score = composeTrack (recipe), timeline = createPlaybackTimeline ();
  timeline.schedule ({ score, track: {}, barIndex: score.barCount - 1, time: 10, secondsPerBeat: 0.5 });
  expect (timeline.read (11).beat).toBe ((score.barCount - 1) * 3 + 2);
  expect (timeline.read (11).ended).toBe (false);
  expect (timeline.read (11.5).ended).toBe (true);
});

test ('mixed meters play at the displayed pulse tempo and survive repeat and skips', async ({ page }) => {
  const errors = [];
  page.on ('pageerror', e => errors.push (e.message));
  page.on ('console', m => { if (/bar failed/.test (m.text())) errors.push (m.text()); });
  await page.goto ('/');
  await page.evaluate (() => { window.lofi.controls.arc (0); window.lofi.controls.tempo (80); });
  await page.click ('#playButton');
  await page.waitForFunction (() => window.lofi.getPlayback());
  const meters = new Set ();
  for (let i = 0; i < 3; i++) {
    if (i) { await page.click ('#skipButton'); await page.waitForTimeout (200); }
    const info = await page.evaluate (() => ({
      meter: window.lofi.getComposition().recipe.structure.meter,
      tempo: window.lofi.getTempo(), bar: window.lofi.state.barIndex
    }));
    meters.add (info.meter);
    expect (info.tempo).toBeCloseTo (80);
    const elapsed = await page.evaluate (async () => {
      const e = window.lofi;
      const next = async index => {
        while (!e.getPlayback() || e.getPlayback().barIndex <= index) await new Promise (r => setTimeout (r, 10));
        return { index: e.getPlayback().barIndex, time: e.getTrackTime().elapsedSeconds };
      };
      const a = await next (e.getPlayback().barIndex);
      const b = await next (a.index);
      return b.time - a.time;
    });
    expect (elapsed).toBeCloseTo (info.meter === '6/8' ? 1.5 : 3, 1);
    await expect (page.locator ('#scoreSummary')).toContainText (info.meter);
  }
  expect ([...meters].sort()).toEqual (['4/4', '6/8']);
  const saved = await page.evaluate (() => window.lofi.getComposition());
  await page.click ('#playButton');
  await page.click ('#replayButton');
  await page.waitForFunction (() => window.lofi.getPlayback());
  expect (await page.evaluate (() => window.lofi.getComposition())).toEqual (saved);
  await page.evaluate (async () => { window.lofi.stop(); await window.lofi.chain.input.context.close(); });
  expect (errors).toEqual ([]);
});
