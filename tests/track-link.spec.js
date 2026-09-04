import { test, expect } from '@playwright/test';
import { encodeTrack, decodeTrack, quantiseRecipe, packRecipe } from '../src/track-link.js';
import { composeTrack } from '../src/composition.js';
import { PROGRESSIONS } from '../src/theory.js';
import { titleAt, titleIndexOf, titleCount } from '../src/track-names.js';
import { createTrackMaterialPicker } from '../src/track-material.js';
import { LEAD_VOICES, KEYS_VOICES, BASS_VOICES } from '../src/instruments.js';

const voiceOptions = {
  lead: Object.keys (LEAD_VOICES), keys: Object.keys (KEYS_VOICES), bass: Object.keys (BASS_VOICES)
};

function recipeFor (overrides = {}) {
  const material = createTrackMaterialPicker ({ storage: null }) ({ seed: 424242 });
  const title = titleAt (40);
  return quantiseRecipe ({
    version: 1, seed: 1234567890, materialSeed: material.materialSeed,
    motifA: material.motifA, motifB: material.motifB,
    title: title.title, titleEnglish: title.titleEnglish, titleLanguage: title.titleLanguage,
    rootMidi: 50, scale: 'dorian',
    structure: { style: 'tune', opening: 'melody', meter: '4/4', chordHold: 2,
      sections: ['A', 'A', 'B', 'A'] },
    progression: PROGRESSIONS.dorian[3], turns: 3, turnsSinceEnding: 0,
    arc: { shape: 'swell', length: 8, turn: 0 }, arcDepth: 0.5, tempoUser: 80, tempoOffset: 4,
    user: { density: 0.5, counter: 0.55, ornament: 0.6, drone: 0.14, dust: 0.3, support: 0.5,
      swing: 0.28, brightness: 0.29, wobble: 0.27, drive: 0.3, space: 0.28, pump: 0.35, volume: 0.9 },
    variation: { density: 0.0731, counter: -0.1442, ornament: 0.2013, drone: -0.0312,
      dust: 0.1109, support: 0.04, swing: -0.0577 },
    voices: { lead: 'harp', keys: 'felt', bass: 'electric' },
    auto: { lead: true, keys: true, bass: true },
    voiceOptions,
    ...overrides
  });
}

test ('a link reproduces the tune note for note', () => {
  const original = recipeFor();
  const decoded = decodeTrack (encodeTrack (original), { voiceOptions });

  const first = composeTrack (original), second = composeTrack (decoded);
  // Not merely similar. A knob is compared against a seeded random, so a
  // difference of a thousandth flips one comparison and cascades — which is
  // why recipes are quantised when they are made rather than when encoded.
  expect (second.bars).toEqual (first.bars);
  expect (second.turns).toEqual (first.turns);
  expect (first.bars.reduce ((sum, bar) => sum + bar.notes.length, 0)).toBeGreaterThan (500);
});

test ('a tune fits in a link somebody would actually paste', () => {
  const code = encodeTrack (recipeFor());
  expect (code.length).toBeLessThan (100);
  // URL-safe, so it survives being sent through anything.
  expect (code).toMatch (/^[A-Za-z0-9_-]+$/);
});

test ('the details a listener would notice all survive the trip', () => {
  const original = recipeFor();
  const decoded = decodeTrack (encodeTrack (original), { voiceOptions });

  expect (decoded.title).toBe (original.title);
  expect (decoded.titleEnglish).toBe (original.titleEnglish);
  expect (decoded.scale).toBe (original.scale);
  expect (decoded.rootMidi).toBe (original.rootMidi);
  expect (decoded.structure.meter).toBe (original.structure.meter);
  expect (decoded.structure.sections).toEqual (original.structure.sections);
  expect (decoded.progression.name).toBe (original.progression.name);
  expect (decoded.voices).toEqual (original.voices);
  expect (decoded.tempoUser).toBe (original.tempoUser);
  expect (decoded.tempoOffset).toBe (original.tempoOffset);
  expect (decoded.arc).toEqual (original.arc);
  expect (decoded.motifA).toEqual (original.motifA);
  expect (decoded.motifB).toEqual (original.motifB);
});

test ('a broken link is refused rather than thrown', () => {
  // This reads something a stranger pasted into a URL bar.
  for (const bad of ['', 'nonsense', '!!!!', 'AAAA', 'A'.repeat (500), '../../etc/passwd']) {
    expect (() => decodeTrack (bad, { voiceOptions })).not.toThrow();
  }
  expect (decodeTrack ('!!!not base64!!!', { voiceOptions })).toBeNull();

  // A version this build does not know must be refused, not guessed at.
  const bytes = packRecipe (recipeFor());
  bytes[0] = 99;
  const code = btoa (String.fromCharCode (...bytes))
    .replace (/\+/g, '-').replace (/\//g, '_').replace (/=+$/, '');
  expect (decodeTrack (code, { voiceOptions })).toBeNull();
});

test ('the title index addresses the whole library', () => {
  // Two bytes, and the pool has to stay inside them.
  expect (titleCount()).toBeLessThan (65536);
  expect (titleIndexOf (titleAt (0).title)).toBe (0);
  expect (titleIndexOf (titleAt (titleCount() - 1).title)).toBe (titleCount() - 1);
  // An index past the end must still give a usable title rather than nothing.
  expect (titleAt (999999).title).toBeTruthy();
});

test ('quantising is idempotent, so a shared tune stays put', () => {
  // Re-sharing a tune that arrived from a link must not drift it further.
  const once = quantiseRecipe (recipeFor());
  const twice = quantiseRecipe (once);
  expect (twice.user).toEqual (once.user);
  expect (twice.variation).toEqual (once.variation);
  expect (twice.arcDepth).toBe (once.arcDepth);
  expect (encodeTrack (twice)).toBe (encodeTrack (once));
});
