// Which voices a track reaches for when it is choosing for itself.
//
// Deliberately free of Tone and of the instruments themselves: composition is
// pure — no audio context, no DOM — and it needs this to pick a voice for a
// mid-track swap. Importing the instruments there would drag an audio library
// into the one part of this that is supposed to run anywhere.

/** How often a voice is reached for when the choice is automatic.
    Everything stays selectable by hand; this only decides what a track picks
    for itself.

    The palette was even, and half of it was struck metal — vibraphone,
    marimba, kalimba, glockenspiel. Played evenly that reads as world music or
    as a toy rather than as lofi, whatever the notes are doing. Warm and
    slightly worn is the sound: an electric piano, a felt piano, a guitar, a
    harp. The bells stay, because a bell is lovely once in a while and awful
    every time.

    A weight of nought would be a removal; nothing here has one. */
export const VOICE_WEIGHTS = {
  lead: { rhodes: 5, guitar: 5, felt: 4, harp: 4, piano: 3,
    vibraphone: 2, marimba: 1, kalimba: 1, 'harp (synth)': 1 },
  keys: { rhodes: 5, felt: 5, guitar: 3, piano: 3, pad: 2 },
  bass: { upright: 4, round: 4, electric: 3, sub: 2 },
  support: { glockenspiel: 3, vibraphone: 3, kalimba: 2, marimba: 2 },
  // The answering voice. The synthesised pluck was the only one there was for
  // a long time, so it stays the commonest — but a harp or a picked guitar
  // answering a rhodes is a better pairing than the pluck is, and neither had
  // ever been reachable.
  counter: { pluck: 4, harp: 4, guitar: 3, piano: 3, kalimba: 2, glockenspiel: 2, marimba: 1 }
};

/** One name, drawn by those weights. */
export function pickVoice (role, names, random = Math.random) {
  const weights = VOICE_WEIGHTS[role] ?? {};
  const pool = names.map (name => ({ name, weight: weights[name] ?? 1 }));
  const total = pool.reduce ((sum, entry) => sum + entry.weight, 0);
  let roll = random() * total;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return entry.name;
  }
  return pool[pool.length - 1]?.name;
}
