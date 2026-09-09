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

// A turn is a full thirty-two bar tune. How long a track runs is therefore the
// turn count times the tempo times the meter, and for a long time only the
// first of those three was chosen — two to four turns, drawn without reference
// to how fast the track was or what meter it was in.
//
// Measured, that put tracks anywhere from 1.3 minutes to 8.3. A fast jig
// played twice was over before it began; a slow 4/4 played four times was
// eight and a quarter minutes on one title, which is not a track, it is a
// side. And the two were the same decision made blind.
//
// Choosing the count from the duration instead fixes both ends at once, and it
// is also the more musical reading: a set is played round until it has been
// heard, and a quick tune needs more turns to get there than a slow one does.
const TURN_BARS = 32;
const SHORTEST = 150;   // two and a half minutes
const LONGEST = 300;    // five, and a hard ceiling rather than a preference

/** How many times to play the tune, given what one bar of it costs.

    The target moves so that two tracks at the same tempo are not the same
    length, but the count is clamped to two and four whatever it says: once
    through is not a set, and past four the tune stops being a tune you are
    hearing again and starts being one you are still hearing. */
export function turnsFor (barSeconds, random = Math.random) {
  const turnSeconds = barSeconds * TURN_BARS;
  if (! (turnSeconds > 0)) return 3;

  const target = SHORTEST + random() * (LONGEST - SHORTEST);
  let best = 2;
  for (const turns of [3, 4]) {
    // Never past the ceiling, and only if it lands nearer the target than what
    // we already have.
    if (turns * turnSeconds > LONGEST) break;
    if (Math.abs (turns * turnSeconds - target) < Math.abs (best * turnSeconds - target)) best = turns;
  }
  return best;
}

/** Seconds in one bar at a tempo, in a meter. The pulse divisor is why a 6/8
    bar is not simply three quarters of a 4/4 one. */
export const barSecondsAt = (tempo, { beats, pulseBeats }) =>
  (60 / tempo) * beats / pulseBeats;
