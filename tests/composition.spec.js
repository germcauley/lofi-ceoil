import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { composeTrack, reviseComposition } from '../src/composition.js';
import { playScoreBar } from '../src/score-player.js';
import { PROGRESSIONS, noteNameToMidi } from '../src/theory.js';

const recipe = {
  version: 1, seed: 428, title: 'a room with the light on', rootMidi: 48, scale: 'dorian',
  structure: { style: 'tune', opening: 'melody', sections: ['A', 'A', 'B', 'A'], chordHold: 2 },
  motifA: { start: 0, rhythm: [3, 1, 2, 2], offsets: [0, 1, 2, 0] },
  motifB: { start: 1, rhythm: [2, 1, 2, 2], offsets: [0, 2, 3, 1] },
  progression: PROGRESSIONS.dorian[0], turns: 3, turnsSinceEnding: 0,
  variation: {}, tempoOffset: 0, tempoUser: 72, arcDepth: 0.5,
  arc: { shape: 'swell', length: 8, turn: 0 },
  user: { density: 0.5, counter: 0.55, ornament: 0.6, support: 0.5, drone: 0.25, dust: 0.3, swing: 0.28 },
  voices: { lead: 'vibraphone', keys: 'rhodes', bass: 'round' },
  auto: { lead: true, keys: true, bass: true },
  voiceOptions: { lead: ['vibraphone', 'harp'], keys: ['rhodes', 'felt'], bass: ['round', 'upright'] }
};

test ('the hook develops without losing its opening and returns in the final turn', () => {
  const score = composeTrack (recipe);
  const first = score.turns[0].phrases[0];
  const middle = score.turns[1].phrases[0];
  expect (middle.filter (note => note.at < 8)).toEqual (first.filter (note => note.at < 8));
  expect (middle).not.toEqual (first);
  expect (score.turns.at (-1).phrases[0]).toEqual (first);
  expect (score.turns.map (turn => turn.development)).toEqual (['statement', 'development', 'return']);
});

test ('a recipe produces the full same score independent of global randomness', () => {
  const first = composeTrack (recipe);
  for (let i = 0; i < 1000; i++) Math.random();
  const second = composeTrack (JSON.parse (JSON.stringify (recipe)));
  expect (second).toEqual (first);
  expect (second.bars).toHaveLength (96);
  expect (second.turns).toHaveLength (3);
  expect (second.bars[0].notes.filter (note => note.role !== 'vinyl').every (note => note.role === 'lead')).toBe (true);
  expect (second.bars.some (bar => bar.notes.some (note => note.role === 'bass'))).toBe (true);
  expect (composeTrack ({ ...recipe, seed: 429 }).bars).not.toEqual (first.bars);
  expect (recipe).not.toHaveProperty ('bars');
});

test ('scores across modes and lengths contain playable, ordered beat events', () => {
  for (const scale of Object.keys (PROGRESSIONS)) {
    for (const turns of [2, 3, 4]) {
      const score = composeTrack ({ ...recipe, seed: turns * 127, scale, progression: PROGRESSIONS[scale][0], turns });
      expect (score.barCount).toBe (turns * 32);
      for (const bar of score.bars) {
        expect (bar.notes.length).toBeGreaterThan (0);
        const invalid = bar.notes.filter ((note, index, notes) =>
          ! Number.isFinite (note.at) || note.at < 0 || note.at >= 4
          || (index > 0 && note.at < notes[index - 1].at)
          || ! Number.isFinite (note.duration) || note.duration <= 0
          || note.velocity <= 0 || note.velocity > 1
          || (note.midi !== null && (! Number.isInteger (note.midi) || note.midi < 24 || note.midi > 127)));
        expect (invalid, `${scale}, ${turns} turns, bar ${bar.index}`).toEqual ([]);
      }
    }
  }
});

test ('revisions preserve played bars and can be reconstructed from the saved recipe', () => {
  const original = composeTrack (recipe);
  const edits = { user: { ...recipe.user, counter: 0, drone: 0, ornament: 0 }, arcDepth: 0,
    rootMidi: 50, scale: 'minor', progression: PROGRESSIONS.minor[0] };
  const revised = reviseComposition (original, 8, edits);
  expect (revised.bars.slice (0, 8)).toEqual (original.bars.slice (0, 8));
  expect (revised.bars[8].rootMidi).toBe (50);
  expect (revised.bars.slice (8).flatMap (bar => bar.notes).some (note => ['pluck', 'drone'].includes (note.role))).toBe (false);
  const saved = JSON.parse (JSON.stringify (revised));
  const rebuilt = saved.revisions.reduce ((score, revision) => reviseComposition (score, revision.fromBar, revision.edits), composeTrack (saved.recipe));
  expect (rebuilt).toEqual (saved);
});

test ('drum breaks stay within four bars across section and turn boundaries', () => {
  const excessive = [];
  for (let seed = 0; seed < 80; seed++) {
    const score = composeTrack ({ ...recipe, seed, turns: 4 });
    let silence = 0, started = false;
    for (const bar of score.bars) {
      if (bar.notes.some (note => ['kick', 'snare', 'hat'].includes (note.role))) {
        started = true;
        silence = 0;
      } else if (started && ! (bar.winding && bar.barInPart >= 5)) {
        silence++;
        if (silence > 4) excessive.push ({ seed, bar: bar.index, silence });
      }
    }
  }
  expect (excessive.slice (0, 5)).toEqual ([]);
});

test ('the audio adapter schedules exactly the stored notes at the supplied tempo', () => {
  const score = composeTrack (recipe);
  const played = [], ducks = [];
  const voice = role => ({ triggerAttackRelease (...args) {
    const pitched = typeof args[0] === 'string';
    const [pitch, duration, time, velocity] = pitched ? args : [null, ...args];
    played.push ({ role, midi: pitch === null ? null : noteNameToMidi (pitch), duration, time, velocity });
  } });
  const state = { drums: {}, vinyl: { pops: voice ('vinyl') }, chain: { duck: time => ducks.push (time) }, pump: 0.35, tempo: 80 };
  for (const role of ['keys', 'bass', 'lead', 'pluck', 'drone']) state[role] = voice (role);
  for (const role of ['kick', 'snare', 'ghost', 'hat']) state.drums[role] = voice (role);
  const bar = score.bars.find (bar => bar.notes.some (note => note.role === 'kick'));
  playScoreBar (state, bar, 20, 0.75);
  expect (played).toEqual (bar.notes.map (note => ({ role: note.role, midi: note.midi,
    duration: note.duration * 0.75, time: 20 + note.at * 0.75, velocity: note.velocity })));
  expect (ducks).toEqual (played.filter (note => note.role === 'kick').map (note => note.time));
});

test ('live playback starts with a complete score, replays it and keeps edits after stop', async ({ page }) => {
  const failures = [];
  page.on ('pageerror', error => failures.push (error.message));
  page.on ('console', message => { if (/bar failed/.test (message.text())) failures.push (message.text()); });
  await page.goto ('/');
  await page.click ('#playButton');
  await page.waitForFunction (() => window.lofi.state.track?.composition);
  const original = await page.evaluate (() => window.lofi.getComposition());
  expect (original.recipe.titleLanguage).toBe ('ga');
  expect (original.recipe.titleEnglish).toBeTruthy ();
  await expect (page.locator ('#trackTitle')).toHaveAttribute ('lang', 'ga');
  await expect (page.locator ('#trackSubtitle')).toHaveText (original.recipe.titleEnglish);
  expect (original.bars.length).toBe (original.recipe.turns * 32);
  await page.click ('#replayButton');
  expect (await page.evaluate (() => window.lofi.getComposition())).toEqual (original);
  await page.evaluate (() => {
    window.lofi.controls.arc (0);
    window.lofi.controls.counter (0);
    window.lofi.controls.key ('D');
  });
  await page.waitForFunction (() => window.lofi.getComposition().revisions?.length > 0);
  const revised = await page.evaluate (() => window.lofi.getComposition());
  expect (revised.bars[0]).toEqual (original.bars[0]);
  expect (revised.bars.at (-1).rootMidi).toBe (50);
  await page.click ('#playButton');
  expect (await page.evaluate (() => window.lofi.getComposition())).toEqual (revised);
  const downloadEvent = page.waitForEvent ('download');
  await page.click ('#saveScoreButton');
  const download = await downloadEvent;
  expect (download.suggestedFilename()).toMatch (/-score\.json$/);
  expect (JSON.parse (await readFile (await download.path(), 'utf8'))).toEqual (revised);
  await page.click ('#replayButton');
  await page.waitForFunction (() => window.lofi.state.track?.composition);
  expect (await page.evaluate (() => window.lofi.getComposition())).toEqual (revised);
  expect (failures).toEqual ([]);
  await expect (page.locator ('#trackSubtitle')).toHaveText (original.recipe.titleEnglish);
  await page.evaluate (async () => { window.lofi.stop(); await window.lofi.chain.input.context.close(); });
});
