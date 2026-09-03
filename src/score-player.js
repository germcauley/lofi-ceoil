import { midiToNoteName } from './theory.js';

/** The audio adapter consumes stored beat events. It never chooses notes. */
export function playScoreBar (state, bar, time, secondsPerBeat) {
  for (const event of bar.notes) {
    const start = time + event.at * secondsPerBeat;
    const duration = event.duration * secondsPerBeat;
    const voice = event.role === 'vinyl' ? state.vinyl.pops : state[event.role] ?? state.drums[event.role];
    if (event.midi === null) voice.triggerAttackRelease (duration, start, event.velocity);
    else voice.triggerAttackRelease (midiToNoteName (event.midi), duration, start, event.velocity);
    if (event.role === 'kick') state.chain.duck (start, state.pump, state.tempo);
  }
}
