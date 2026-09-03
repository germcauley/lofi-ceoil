/** Coordinate already-written bass attacks with this bar's actual kicks.
    Times are beats, so the relationship survives tempo changes and replay.
    Keep sparse entries and anticipations independent: their space is deliberate. */
export function coordinateBassWithKick (notes, pattern, beatsPerBar = 4) {
  if (pattern === 'sparse' || pattern === 'anticipate') return notes;
  const kicks = notes.filter (note => note.role === 'kick');
  if (! kicks.length) return notes;
  const bass = notes.filter (note => note.role === 'bass').sort ((a, b) => a.at - b.at);
  const replacements = new Map ();
  for (let i = 0; i < bass.length; i++) {
    const note = bass[i];
    // Half a beat accommodates the laid-back kick on the "and" of three.
    // The small tolerance includes the existing performance jitter.
    const kick = kicks.reduce ((closest, hit) =>
      Math.abs (hit.at - note.at) < Math.abs (closest.at - note.at) ? hit : closest);
    if (Math.abs (kick.at - note.at) > 0.55) continue;
    // Do not collapse passing notes onto a single kick or reorder a walk.
    const previous = i ? (replacements.get (bass[i - 1]) ?? bass[i - 1]).at : -Infinity;
    const next = bass[i + 1]?.at ?? beatsPerBar;
    if (kick.at <= previous || kick.at >= next) continue;
    const duration = Math.min (note.duration, next - kick.at - 0.04, beatsPerBar - kick.at - 0.04);
    if (duration <= 0) continue;
    replacements.set (note, { ...note, at: kick.at, duration });
  }
  return notes.map (note => replacements.get (note) ?? note);
}

/** Let exposed melody notes lead the ensemble. Treat a rolled chord as one
    gesture so its upper notes do not accidentally jump back to full volume.
    Chords in melody rests and chord-only introductions keep their weight. */
export function makeRoomForMelody (notes) {
  // Short ornaments should not duck the harmony; these are the main notes.
  const melody = notes.filter (note => note.role === 'lead' && note.duration >= 0.75);
  if (! melody.length) return notes;
  const chords = notes.filter (note => note.role === 'keys').sort ((a, b) => a.at - b.at);
  const replacements = new Map ();
  for (let i = 0; i < chords.length;) {
    const start = chords[i].at;
    const group = [];
    while (i < chords.length && chords[i].at - start <= 0.16) group.push (chords[i++]);
    const endAttack = group.at (-1).at;
    const sharedAttack = melody.some (note => note.at >= start - 0.18 && note.at <= endAttack + 0.18);
    const underMelody = melody.some (note => note.at < start && note.at + note.duration > start);
    const weight = sharedAttack ? 0.68 : underMelody ? 0.82 : 1;
    if (weight === 1) continue;
    for (const note of group) replacements.set (note, { ...note, velocity: note.velocity * weight });
  }
  return notes.map (note => replacements.get (note) ?? note);
}

/** A small pickup into a different section, not a fill at every bar line.
    Keep the backbeat and kick; replace only the last beat's incidental
    ghost/hat decoration so each noise voice retains a clean timeline. */
export function addTransitionFill (notes, bar, random) {
  if (bar.barInPart !== 7 || ! bar.nextSection || bar.nextSection === bar.section
      || bar.winding || ! notes.some (note => note.role === 'snare')) return notes;
  const offset = bar.meter === '6/8' ? -1 : 0;
  const busy = notes.filter (note => note.role === 'lead' && note.at >= 3 + offset).length >= 3;
  if (busy || random() >= 0.45) return notes;
  const pattern = random() < 0.5
    ? [['ghost', 3.25, 0.34], ['hat', 3.5, 0.28], ['ghost', 3.75, 0.42]]
    : [['ghost', 3.25, 0.3], ['snare', 3.5, 0.4]];
  const shifted = pattern.map (([role, at, velocity]) => [role, at + offset, velocity]);
  const kept = notes.filter (note => ! (['ghost', 'hat'].includes (note.role) && note.at >= 3.15 + offset));
  const fill = shifted.filter (([role, at]) =>
    ! kept.some (note => note.role === role && Math.abs (note.at - at) < 0.15))
    .map (([role, at, velocity]) => ({ role, midi: null, at, duration: 0.125, velocity, fill: true }));
  return [...kept, ...fill];
}
