import { IRISH_TITLES } from './data/track-titles-ga.js';
import { ENGLISH_TITLES } from './data/track-titles-en.js';
import { phraseTitles } from './data/track-title-phrases.js';

const ENGLISH = [...ENGLISH_TITLES, ...phraseTitles()];

// One stable ordering of every title, so a share link can name one in two
// bytes. Appending to either list is safe; reordering changes what an existing
// link means.
const ALL = [...IRISH_TITLES, ...ENGLISH];

export const titleAt = index => ({ ...(ALL[index] ?? ALL[0]) });
export const titleIndexOf = title => ALL.findIndex (entry => entry.title === title);
export const titleCount = () => ALL.length;

// An Irish title, shown with its translation underneath, is the most visible
// thing about this that says what it is — so it is not left to the size of the
// pools to decide how often one appears. There are four times as many English
// titles as Irish, and drawing from one shared deck would have shown an Irish
// name only one track in five.
const IRISH_SHARE = 0.45;

/** Independent shuffled decks, one per language. Every title in a language
    gets a turn before any of them comes round again, including when the
    listener stops and starts, while the share between languages stays put. */
export function createTrackNamer () {
  const decks = new Map ();
  let previous = null;

  // Keep title selection independent of the music's random choices: two tracks
  // generated from the same seed should still be free to be called different
  // things.
  const entropy = count => {
    const values = crypto.getRandomValues (new Uint32Array (Math.max (1, count)));
    return i => values[i % values.length] / 0x100000000;
  };

  function draw (name, pool) {
    let remaining = decks.get (name);
    if (! remaining?.length) {
      remaining = [...pool];
      const random = entropy (remaining.length);
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor (random (i) * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
      }
      // The seam between two decks must not repeat the last track's name.
      if (previous && remaining.at (-1)?.title === previous.title && remaining.length > 1) {
        [remaining[0], remaining[remaining.length - 1]] = [remaining.at (-1), remaining[0]];
      }
      decks.set (name, remaining);
    }
    return remaining.pop();
  }

  return function nextTitle () {
    const roll = crypto.getRandomValues (new Uint32Array (1))[0] / 0x100000000;
    previous = roll < IRISH_SHARE ? draw ('ga', IRISH_TITLES) : draw ('en', ENGLISH);
    return { ...previous };
  };
}
