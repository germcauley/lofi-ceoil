// A tradition is the bundle of choices that makes a track sound like it
// belongs somewhere: which modes and meters are likely, which forms the tune
// takes, and which progressions are in character.
//
// It sits above the two axes that already existed and were both using the
// obvious word. `scale` is the musical mode and `structure.style` is the form;
// a tradition decides which of each are even in the bag.
//
// The drums are deliberately not part of it. The hip-hop backing is what makes
// this lofi rather than either a session recording or a rock demo, and it is
// the constant that lets both traditions sound like one instrument.

import { PROGRESSIONS } from './theory.js';

export const DEFAULT_TRADITION = 'irish';

// Weighted by repetition, the way the opening key already was: a bag picker
// draws from these without replacement, so the weights are how often a choice
// comes round rather than an independent roll each time.
export const TRADITIONS = {
  irish: {
    label: 'traditional',
    modes: ['dorian', 'dorian', 'dorian', 'minor', 'minor', 'mixolydian', 'major'],
    meters: ['4/4', '4/4', '6/8'],
    forms: ['traditional', 'traditional', 'tune', 'drift']
  },

  pop: {
    label: 'pop',
    modes: ['major', 'major', 'major', 'minor', 'minor', 'minor', 'dorian'],
    // A jig is not off limits in pop, just rare. 6/8 pop exists and it is a
    // good accident when it happens.
    meters: ['4/4', '4/4', '4/4', '4/4', '6/8'],
    forms: ['riff', 'riff', 'tune', 'drift']
  }
};

export const TRADITION_NAMES = Object.keys (TRADITIONS);

export const traditionOf = name => TRADITIONS[name] ?? TRADITIONS[DEFAULT_TRADITION];

/** The name, once it is known to be one we have. Recipes written before
    traditions existed have none, and those tracks were Irish. */
export const traditionName = name => TRADITIONS[name] ? name : DEFAULT_TRADITION;

/** The modes a tradition opens in or wanders to, each listed once. */
export const modesFor = name => [...new Set (traditionOf (name).modes)];

/** The progressions in character for a tradition.

    Tagging lives on the shared table in `theory.js` rather than in a private
    copy per tradition. One table means harmony stays editable in one place and
    a progression cannot drift out of sync with itself; most of them suit both
    traditions anyway, and mixolydian I-VII-IV is the point where Irish music
    and rock already meet. An untagged progression belongs to everyone. */
export function progressionsFor (name, scale) {
  const set = PROGRESSIONS[scale] ?? PROGRESSIONS.minor;
  const tradition = traditionName (name);
  const inCharacter = set.filter (progression => ! progression.for || progression.for === tradition);
  return inCharacter.length ? inCharacter : set;
}
