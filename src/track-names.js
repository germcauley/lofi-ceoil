import titles from './data/track-titles-ga.json';

/** One shuffled deck per listening session. Every title gets a turn before
    any repeats, including when the listener stops and starts again. */
export function createTrackNamer () {
  let remaining = [];
  let previous = null;

  return function nextTitle () {
    if (! remaining.length) {
      remaining = [...titles];
      // Keep title selection independent of the music's random choices.
      const random = crypto.getRandomValues (new Uint32Array (remaining.length));
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor (random[i] / 0x100000000 * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
      }
      // The seam between two decks must not repeat the last track's name.
      if (remaining.at (-1) === previous) {
        [remaining[0], remaining[remaining.length - 1]] = [remaining.at (-1), remaining[0]];
      }
    }
    previous = remaining.pop();
    return { ...previous };
  };
}
