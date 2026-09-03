// Bar anchors use the very same audio times and tempo as the sound scheduler.
// Reading this clock has no effect on playback or composition.
export function createPlaybackTimeline () {
  let anchors = [];
  return {
    schedule (anchor) {
      const previous = anchors.at (-1);
      const timing = previous?.track === anchor.track
        ? previous.timing : { start: anchor.time, end: null };
      anchors.push ({ ...anchor, timing });
      // Enough history for notes tied over a barline, plus the upcoming bar.
      anchors = anchors.slice (-4);
    },
    reset () { anchors = []; },
    endTrack (time) {
      const timing = anchors.at (-1)?.timing;
      if (timing && timing.end === null) timing.end = time;
    },
    readClock (now) {
      const current = anchors.findLast (anchor => anchor.time <= now);
      if (! current) return null;
      const { start, end } = current.timing;
      return {
        elapsedSeconds: Math.max (0, Math.min (now, end ?? now) - start),
        resting: end !== null && now >= end
      };
    },
    read (now) {
      const current = anchors.findLast (anchor => anchor.time <= now);
      if (! current) return null;
      const bar = current.score.bars[current.barIndex];
      const beatsPerBar = current.score.beatsPerBar ?? 4;
      const through = Math.max (0, Math.min (beatsPerBar, (now - current.time) / current.secondsPerBeat));
      const activeNotes = new Set();
      for (const anchor of anchors) {
        if (anchor.track !== current.track || anchor.time > now) continue;
        anchor.score.bars[anchor.barIndex].notes.forEach ((note, index) => {
          const start = anchor.time + note.at * anchor.secondsPerBeat;
          const end = start + note.duration * anchor.secondsPerBeat;
          if (now >= start && now < end) activeNotes.add (`${anchor.barIndex}:${index}`);
        });
      }
      return {
        score: current.score, barIndex: current.barIndex, bar,
        beat: current.barIndex * beatsPerBar + through, activeNotes,
        voices: current.voices, ended: current.barIndex === current.score.barCount - 1 && through === beatsPerBar
      };
    }
  };
}
