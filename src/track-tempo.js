// Keep adjacent tracks distinct without moving the listener's base tempo.
export const MIN_TEMPO = 74;
export const DEFAULT_TEMPO = 80;
export const clampTempo = value => Math.max (MIN_TEMPO, Math.min (100, value));

export function chooseTempoOffset (previous, base, drift, random = Math.random) {
  const offsets = [-12, -8, -4, 0, 4, 8, 12];
  const audible = offset => clampTempo (base + offset * drift);
  const minimum = 8 * drift;
  const choices = previous == null ? offsets : offsets.filter (offset =>
    Math.abs (audible (offset) - audible (previous)) >= minimum);
  const pool = choices.length ? choices : offsets;
  return pool[Math.floor (random() * pool.length)];
}
