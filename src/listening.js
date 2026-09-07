// What actually happened to each track.
//
// The first instinct is a like button, and a like button on its own measures
// almost nothing: hardly anybody presses one, and the tracks that collect the
// most are simply the ones played the most. Skips are the signal that exists
// in quantity — nearly every listener produces one, the button is already
// there, and until now it told us nothing.
//
// This keeps a local log and sends nothing anywhere. That is not a placeholder
// for a backend so much as the honest first step: it proves the shape of the
// data with no hosting, no endpoint and no questions about somebody else's
// information. When there is a database, this is what it stores.

const KEY = 'lofi-ceoil:listening';

// Enough to learn something from, small enough that a browser will not mind.
// One entry is roughly a hundred bytes.
const LIMIT = 500;

/** A listening log backed by storage, or by nothing if storage will not have
    it. Every path is guarded: a private window that refuses localStorage must
    lose the log, never the music. */
export function createListeningLog ({ storage, now = () => Date.now() } = {}) {
  if (storage === undefined) storage = globalThis.localStorage;

  const read = () => {
    try {
      const saved = JSON.parse (storage?.getItem (KEY) ?? '[]');
      return Array.isArray (saved) ? saved : [];
    } catch { return []; }
  };

  let entries = read();
  let open = null;

  const write = () => {
    try { storage?.setItem (KEY, JSON.stringify (entries)); } catch {}
  };

  return {
    /** A track has started playing. */
    began ({ code, title, bars }) {
      open = { code, title, bars, at: now(), position: (entries.at (-1)?.position ?? 0) + 1 };
    },

    /** A track has stopped, one way or another.

        `finished` means it played itself out and another began; `skipped` and
        `stopped` are the listener acting. The difference between the first and
        the other two is the whole point of recording this. */
    ended (outcome, { seconds = 0, barsHeard = 0 } = {}) {
      if (! open) return null;

      const entry = {
        code: open.code,
        outcome,
        seconds: Math.round (seconds * 10) / 10,
        // How far in they got. A track abandoned at the first bar and one left
        // running to the end are both labels, and this is what separates them.
        fraction: open.bars > 0 ? Math.min (1, Math.round (barsHeard / open.bars * 100) / 100) : 0,
        // Recorded because they are confounds, not because they are
        // interesting: a tune heard fifth in a sitting, or late at night, is
        // judged differently from the same tune heard first, or at noon.
        position: open.position,
        hour: new Date (open.at).getHours(),
        at: open.at
      };

      open = null;
      entries.push (entry);
      if (entries.length > LIMIT) entries = entries.slice (-LIMIT);
      write();
      return entry;
    },

    /** Whether a track is currently open, so nothing is recorded twice. */
    get listening () { return open !== null; },

    entries: () => entries.map (entry => ({ ...entry })),

    clear () {
      entries = [];
      open = null;
      try { storage?.removeItem (KEY); } catch {}
    }
  };
}

/** What the log says, in the only terms worth reading it in.

    Counts are useless on their own — a tune heard more collects more of
    everything — so this reports rates. `keep` is the share of tracks that were
    not cut short, which is the closest thing to "was this any good" that a log
    of behaviour can offer. */
export function summarise (entries, attributesOf = () => ({})) {
  const overall = { plays: entries.length, skipped: 0, finished: 0, stopped: 0, seconds: 0 };
  const groups = new Map();

  for (const entry of entries) {
    overall[entry.outcome] = (overall[entry.outcome] ?? 0) + 1;
    overall.seconds += entry.seconds;

    for (const [dimension, value] of Object.entries (attributesOf (entry.code) ?? {})) {
      if (value === undefined || value === null) continue;
      const key = `${dimension}:${value}`;
      const group = groups.get (key) ?? { dimension, value, plays: 0, finished: 0, seconds: 0 };
      group.plays++;
      if (entry.outcome === 'finished') group.finished++;
      group.seconds += entry.seconds;
      groups.set (key, group);
    }
  }

  const rate = (part, whole) => whole > 0 ? Math.round (part / whole * 100) / 100 : 0;

  return {
    plays: overall.plays,
    minutes: Math.round (overall.seconds / 6) / 10,
    keep: rate (overall.finished, overall.plays),
    skipped: rate (overall.skipped, overall.plays),
    // Only groups with enough behind them to mean anything. Ranking on three
    // plays is how you end up confidently learning noise.
    by: [...groups.values()]
      .filter (group => group.plays >= 5)
      .map (group => ({ ...group, keep: rate (group.finished, group.plays),
        averageSeconds: Math.round (group.seconds / group.plays) }))
      .sort ((a, b) => b.keep - a.keep)
  };
}
