// Where each part sits between the speakers.
//
// Everything was in the middle. Not narrow — actually mono, with no panner
// anywhere in the graph, so whatever width existed came out of the chorus and
// the reverb by accident. Nine parts stacked in a single spot fight each
// other for the same space, and the usual response is to reach for the levels,
// which does not help because the problem was never loudness.
//
// This is Tone-free on purpose, like `voice-palette.js`: it is a table of
// decisions about the arrangement, and it should be readable and testable
// without an audio context.

/** Each part's place, from −1 hard left to +1 hard right, at full width.
 *
 *  Three rules underneath the numbers.
 *
 *  The low end is centred. A kick and a bass carry most of the energy, and
 *  moving either off centre unbalances the whole mix and costs headroom on
 *  one side for nothing. The snare stays with them because it is the other
 *  half of the backbeat.
 *
 *  Parts that answer each other go opposite ways. The counter line exists to
 *  reply to the tune, and the reply is much easier to follow from the other
 *  side of the room; the support sparkle sits opposite as well, which is also
 *  what stops it merging into the lead.
 *
 *  Everything else is a small offset rather than a large one. A part hard
 *  left is a novelty; a part fifteen percent left is a part with its own
 *  place, which is what is wanted. */
export const PLACEMENT = {
  // The anchor.
  kick: 0,
  bass: 0,
  snare: -0.05,
  // The bed. Barely moved: it is the floor of the track, not a voice on it.
  drone: 0.08,

  // The kit's own detail, either side of the backbeat.
  hat: -0.3,
  ghost: 0.24,

  // The tune, just off centre, with the chords leaning the other way.
  lead: -0.14,
  keys: 0.2,

  // The two that answer it, clearly opposite.
  pluck: 0.4,
  support: -0.42
};

/** A part's place at a given width. Width nought is the mono mix this had
    before, which is worth being able to get back to: some listeners are on a
    single speaker, and a mix that only works wide is a mix with a problem
    hidden in it. */
export function placementAt (role, width = 1) {
  const at = PLACEMENT[role] ?? 0;
  const amount = Math.max (0, Math.min (1, width));
  return Math.max (-1, Math.min (1, at * amount));
}

/** Where the width knob starts. Not full: the table above is the widest the
    image should ever get, and a default at the top of a control leaves the
    listener nothing to reach for. */
export const DEFAULT_WIDTH = 0.8;

/** Every role that has a place, for callers wiring panners up. */
export const PLACED_ROLES = Object.keys (PLACEMENT);
