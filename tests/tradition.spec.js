import { test, expect } from '@playwright/test';
import { composeTrack } from '../src/composition.js';
import { createStructurePicker } from '../src/track-structure.js';
import { PROGRESSIONS } from '../src/theory.js';
import { TRADITIONS, TRADITION_NAMES, modesFor, progressionsFor, traditionName } from '../src/tradition.js';

test ('each tradition keeps to its own modes, meters and forms', () => {
  for (const name of TRADITION_NAMES) {
    const next = createStructurePicker (name);
    const drawn = Array.from ({ length: 60 }, next);
    const { meters, forms } = TRADITIONS[name];

    expect (new Set (drawn.map (structure => structure.meter)))
      .toEqual (new Set (meters));
    expect (new Set (drawn.map (structure => structure.style)))
      .toEqual (new Set (forms));
    // Every draw must be a real form, or sections would come back undefined.
    expect (drawn.every (structure => structure.sections.length > 0)).toBe (true);
  }

  expect (modesFor ('irish')).toContain ('dorian');
  expect (modesFor ('pop')).not.toContain ('mixolydian');
});

test ('progression tags cover the whole table and leave every mode playable', () => {
  const tagged = new Set ();
  for (const [mode, set] of Object.entries (PROGRESSIONS)) {
    for (const progression of set) {
      // A tag naming a tradition we do not have would silently exclude a
      // progression from everything.
      if (progression.for) {
        expect (TRADITION_NAMES).toContain (progression.for);
        tagged.add (progression.name);
      }
    }
    // No tradition may be left with nothing to play in a mode it uses.
    for (const name of TRADITION_NAMES) {
      if (! modesFor (name).includes (mode)) continue;
      expect (progressionsFor (name, mode).length).toBeGreaterThan (2);
    }
  }
  expect (tagged.size).toBeGreaterThan (0);
});

test ('an unknown or missing tradition reads as the default rather than throwing', () => {
  expect (traditionName (undefined)).toBe ('irish');
  expect (traditionName ('klezmer')).toBe ('irish');
  expect (progressionsFor ('klezmer', 'dorian')).toEqual (progressionsFor ('irish', 'dorian'));
  expect (progressionsFor ('irish', 'lydian').length).toBeGreaterThan (0);
});

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

test ('a version 1 recipe still composes, and reads as Irish', () => {
  const score = composeTrack (recipe);
  expect (score.recipe.tradition).toBe ('irish');
  expect (score.recipe.version).toBe (2);
  expect (score.bars.length).toBeGreaterThan (0);
  // Version 1 said nothing about tradition, so naming it must not change the
  // music those recipes already described.
  expect (composeTrack ({ ...recipe, version: 2, tradition: 'irish' }).bars)
    .toEqual (score.bars);
  expect (() => composeTrack ({ ...recipe, version: 9 }))
    .toThrow ('Unsupported composition version');
});

test ('a tradition changes which progressions a track can reach', () => {
  // Start both on a progression that suits either tradition, so what the two
  // scores reach afterwards is the composer's own choosing and nothing else.
  // Drift wanders within a track, which exercises that choice repeatedly
  // rather than only at the opening.
  const shared = PROGRESSIONS.major.find (progression => ! progression.for);
  const inMajor = tradition => composeTrack ({
    ...recipe, version: 2, tradition, scale: 'major', progression: shared, turns: 4,
    structure: { ...recipe.structure, style: 'drift', sections: ['A', 'A', 'B', 'B'] }
  });

  const popOnly = new Set (Object.values (PROGRESSIONS).flat()
    .filter (progression => progression.for === 'pop').map (progression => progression.name));
  const reached = score => new Set (score.bars.map (bar => bar.progression));

  const pop = inMajor ('pop'), irish = inMajor ('irish');
  expect (inMajor ('pop').bars).toEqual (pop.bars);
  expect (reached (pop).size).toBeGreaterThan (1);

  // The contract: pop can play the functional cadences, Irish never does.
  expect ([...reached (irish)].some (name => popOnly.has (name))).toBe (false);
  expect ([...reached (pop)].some (name => popOnly.has (name))).toBe (true);
});
