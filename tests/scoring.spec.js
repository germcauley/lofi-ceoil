import { test, expect } from '@playwright/test';
import { composeTrack } from '../src/composition.js';
import { createStructurePicker } from '../src/track-structure.js';
import { chooseTempoOffset, clampTempo, MIN_TEMPO } from '../src/track-tempo.js';
import { PROGRESSIONS } from '../src/theory.js';
import { createTrackMaterialPicker } from '../src/track-material.js';
import { titleAt } from '../src/track-names.js';
import { decodeTrack, encodeTrack } from '../src/track-link.js';

function scoreFor (scoring, opening = 'melody') {
  const material = createTrackMaterialPicker ({ storage: null }) ({ seed: 7 });
  const title = titleAt (3);
  return composeTrack ({
    version: 1, seed: 99, materialSeed: material.materialSeed,
    motifA: material.motifA, motifB: material.motifB,
    title: title.title, titleEnglish: title.titleEnglish, titleLanguage: title.titleLanguage,
    rootMidi: 48, scale: 'dorian',
    structure: { style: 'tune', opening, meter: '4/4', chordHold: 2, scoring,
      sections: ['A', 'A', 'B', 'A'] },
    progression: PROGRESSIONS.dorian[0], turns: 3, turnsSinceEnding: 0,
    arc: { shape: 'swell', length: 8, turn: 0 }, arcDepth: 0.5, tempoUser: 80, tempoOffset: 0,
    user: { density: 0.5, counter: 0.55, ornament: 0.6, drone: 0.14, dust: 0.3,
      support: 0.5, swing: 0.28 },
    variation: {}, voices: { lead: 'harp', keys: 'felt', bass: 'round' },
    auto: { lead: true, keys: true, bass: true },
    voiceOptions: { lead: ['harp'], keys: ['felt'], bass: ['round'] }
  });
}

const share = (score, roles) => score.bars
  .filter (bar => bar.notes.some (note => roles.includes (note.role))).length / score.bars.length;

const KIT = ['kick', 'snare', 'hat', 'ghost'];

test ('a scoring changes how much of the band plays', () => {
  const density = scoring => {
    const score = scoreFor (scoring);
    return score.bars.reduce ((sum, bar) => sum + bar.notes.length, 0) / score.bars.length;
  };

  // Every track used to be a full arrangement whatever else varied, and one
  // texture for an hour is most of what made a long listen go flat.
  expect (density ('bare')).toBeLessThan (density ('duo'));
  expect (density ('duo')).toBeLessThan (density ('full'));
  expect (density ('full')).toBeLessThan (density ('driving'));
  expect (density ('driving') / density ('bare')).toBeGreaterThan (2);
});

test ('an air has no kit, whatever the opening says', () => {
  // The opening decides when each part enters, and used to bring drums in at
  // bar six of the first part even on a track meant to have none.
  for (const opening of ['melody', 'chords', 'layered', 'rhythm', 'full']) {
    expect (share (scoreFor ('bare', opening), KIT)).toBe (0);
    expect (share (scoreFor ('bare', opening), ['keys'])).toBe (0);
    expect (share (scoreFor ('duo', opening), KIT)).toBe (0);
    // A duo still has an accompaniment; it is the kit that is missing.
    expect (share (scoreFor ('duo', opening), ['keys'])).toBeGreaterThan (0.3);
  }
  // And the tune is always there, whatever is missing under it.
  expect (share (scoreFor ('bare'), ['lead'])).toBeGreaterThan (0.9);
});

test ('the drum-continuity rule leaves a deliberately silent kit alone', () => {
  // That rule exists so a breakdown cannot run on. A track scored without a
  // kit is not a breakdown, and dragging the drums back in would undo it.
  const score = scoreFor ('bare');
  const kitPlans = score.turns.flatMap (turn => turn.arrangement)
    .filter (plan => plan.drumsFrom < 8);
  expect (kitPlans).toHaveLength (0);
});

test ('tracks are spread over a real range of tempos', () => {
  // 74 to 86 was the whole spread before: a twelve-beat band, and every track
  // effectively the same speed.
  let previous = null;
  const tempos = [];
  for (let i = 0; i < 40; i++) {
    previous = chooseTempoOffset (previous, 80, 0.5);
    tempos.push (clampTempo (80 + previous * 0.5));
  }
  expect (Math.max (...tempos) - Math.min (...tempos)).toBeGreaterThan (18);
  expect (new Set (tempos).size).toBeGreaterThan (5);
  // A slow air has to be reachable.
  expect (MIN_TEMPO).toBeLessThan (70);
  for (const tempo of tempos) expect (tempo).toBeGreaterThanOrEqual (MIN_TEMPO);
});

test ('the picker offers every scoring, with full the commonest', () => {
  const next = createStructurePicker();
  const counts = {};
  for (let i = 0; i < 80; i++) {
    const { scoring } = next();
    counts[scoring] = (counts[scoring] ?? 0) + 1;
  }
  for (const scoring of ['full', 'duo', 'bare', 'driving']) expect (counts[scoring]).toBeGreaterThan (0);
  expect (counts.full).toBeGreaterThan (counts.bare);
});

test ('a link carries the scoring, and older links read as full', () => {
  const score = scoreFor ('bare');
  const decoded = decodeTrack (encodeTrack ({ ...score.recipe, user: { ...score.recipe.user } }));
  expect (decoded.structure.scoring).toBe ('bare');

  // Written before scorings existed. Every track then was a full arrangement,
  // which is what index nought means.
  const older = 'AQSfjc29DADHNgADAwACCQQBAAgBgFCIgIyZJE2AR0pFTUdZAJtZrni1gIYDAwICbw';
  expect (decodeTrack (older).structure.scoring).toBe ('full');
  expect (decodeTrack (older).title).toBe ('humming in the rain');
});
