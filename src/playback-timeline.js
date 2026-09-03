// Bar anchors use the very same audio times and tempo as the sound scheduler.
// Reading this clock has no effect on playback or composition.
export function createPlaybackTimeline () {
  let anchors = [];
  return {
    schedule (anchor) {
      anchors.push (anchor);
      // Enough history for notes tied over a barline, plus the upcoming bar.
      anchors = anchors.slice (-4);
    },
    reset () { anchors = []; },
    read (now) {
      const current = anchors.findLast (anchor => anchor.time <= now);
      if (! current) return null;
      const bar = current.score.bars[current.barIndex];
      const through = Math.max (0, Math.min (4, (now - current.time) / current.secondsPerBeat));
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
        beat: current.barIndex * 4 + through, activeNotes,
        voices: current.voices, ended: current.barIndex === current.score.barCount - 1 && through === 4
      };
    }
  };
}
