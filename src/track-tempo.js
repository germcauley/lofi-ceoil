// Keep adjacent tracks distinct without moving the listener's base tempo.
//
// The floor used to be 74, which with drift-scaled offsets of at most twelve
// put every track between 74 and 86 — a twelve-beat band, and most of why an
// hour of this sounded like one long track. A set has slow airs in it as well
// as reels.
export const MIN_TEMPO = 62;
export const DEFAULT_TEMPO = 80;
export const clampTempo = value => Math.max (MIN_TEMPO, Math.min (100, value));

export function chooseTempoOffset (previous, base, drift, random = Math.random) {
  // Offsets are scaled by drift before they are heard, so these have to be
  // twice what the audible spread should be.
  // The high end goes further than the low: nothing was ever brisk, and one
  // track in ten sitting near the top of the range is what stops a long
  // listen feeling uniformly slow.
  const offsets = [-24, -16, -8, -4, 0, 4, 8, 16, 24, 36];
  const audible = offset => clampTempo (base + offset * drift);
  const minimum = 8 * drift;
  const choices = previous == null ? offsets : offsets.filter (offset =>
    Math.abs (audible (offset) - audible (previous)) >= minimum);
  const pool = choices.length ? choices : offsets;
  return pool[Math.floor (random() * pool.length)];
}
