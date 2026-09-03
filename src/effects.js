// The lofi treatment. This is where most of the character lives — the notes
// underneath are fairly plain, and everything that makes them sound like lofi
// happens in this chain.
//
// Signal order matters. Saturation before bitcrush, both before the lowpass,
// so the filter tames the harmonics the first two stages generate rather than
// letting them sit on top as fizz.

import * as Tone from 'tone';

export function createChain () {
  // Musical material passes through here and gets ducked by the kick.
  const sidechain = new Tone.Gain (1);

  const saturation = new Tone.Distortion ({ distortion: 0.18, oversample: '2x' });
  const crusher = new Tone.BitCrusher ({ bits: 8 });
  const crusherMix = new Tone.CrossFade (0.25);

  // Wow and flutter: slow pitch drift, as if the transport is not quite
  // holding speed. Depth stays low — past about 0.25 it stops sounding like
  // tape and starts sounding broken.
  const wobble = new Tone.Vibrato ({ frequency: 0.7, depth: 0.06, type: 'sine' });

  const tone = new Tone.Filter ({ type: 'lowpass', frequency: 2600, rolloff: -12, Q: 0.6 });

  // A sweep pair, separate from `tone`. `tone` is the brightness knob plus the
  // energy arc and gets rewritten whenever a setting changes; a sweep writing
  // to the same node would be overwritten mid-gesture. These sit transparent
  // — the lowpass wide open, the highpass at the very bottom — until a sweep
  // moves them, so they cost nothing when unused.
  const sweepLow = new Tone.Filter ({ type: 'lowpass', frequency: 20000, rolloff: -24, Q: 1.1 });
  const sweepHigh = new Tone.Filter ({ type: 'highpass', frequency: 20, rolloff: -24, Q: 1.1 });
  const reverb = new Tone.Reverb ({ decay: 3.2, wet: 0.28, preDelay: 0.02 });

  // Catches the peaks that saturation and the noise bed add, so the output
  // stays put regardless of where the knobs are.
  const limiter = new Tone.Limiter (-1.5);
  const master = new Tone.Gain (0.9);

  // Bitcrush is mixed in parallel rather than inline: fully crushed sounds
  // like a broken codec, a blend sounds like an old sampler.
  sidechain.connect (saturation);
  saturation.connect (crusherMix.a);
  saturation.connect (crusher);
  crusher.connect (crusherMix.b);

  crusherMix.connect (wobble);
  wobble.connect (tone);
  tone.connect (sweepHigh);
  sweepHigh.connect (sweepLow);
  sweepLow.connect (reverb);
  reverb.connect (limiter);
  limiter.connect (master);
  master.toDestination();

  return {
    input: sidechain,
    sidechain,
    saturation,
    crusher,
    crusherMix,
    wobble,
    tone,
    sweepLow,
    sweepHigh,
    reverb,
    limiter,
    master,

    /** A filter sweep aimed at a section boundary.

        The point is that it *lands*: the gesture is timed to finish exactly
        where the next section begins, so the arrival is prepared rather than
        merely happening. It then returns to transparent over a fraction of a
        beat, which is what makes the boundary feel like a release.

        `rise` climbs the highpass, thinning everything from the bottom up —
        tension. `fall` closes the lowpass, darkening from the top down —
        release. Both are exponential, because filter frequency is heard
        logarithmically and a linear ramp does almost nothing then everything.

        Returns the time it lands, so a caller can line something up with it. */
    sweep (kind, startTime = Tone.now(), seconds = 2, depth = 1) {
      const at = Math.max (startTime ?? Tone.now(), Tone.now() + 0.01);
      const lands = at + seconds;

      if (kind === 'rise') {
        const top = 120 + depth * 900;
        sweepHigh.frequency.cancelScheduledValues (at);
        sweepHigh.frequency.setValueAtTime (20, at);
        sweepHigh.frequency.exponentialRampToValueAtTime (top, lands);
        // Snap back at the boundary, not before it.
        sweepHigh.frequency.exponentialRampToValueAtTime (20, lands + 0.12);
      } else {
        const bottom = 4000 - depth * 3400;
        sweepLow.frequency.cancelScheduledValues (at);
        sweepLow.frequency.setValueAtTime (20000, at);
        sweepLow.frequency.exponentialRampToValueAtTime (Math.max (200, bottom), lands);
        sweepLow.frequency.exponentialRampToValueAtTime (20000, lands + 0.18);
      }

      return lands;
    },

    /** Puts both filters back where they cannot be heard. */
    clearSweep (time = Tone.now()) {
      const at = Math.max (time, Tone.now() + 0.01);
      sweepHigh.frequency.cancelScheduledValues (at);
      sweepHigh.frequency.setValueAtTime (20, at);
      sweepLow.frequency.cancelScheduledValues (at);
      sweepLow.frequency.setValueAtTime (20000, at);
    },

    /** Ducks the chain on a kick hit and lets it breathe back in. This is the
        pump that glues a lofi beat together. Amount 0 disables it. */
    duck (time, amount, tempo) {
      if (amount <= 0.001) return;

      // Param events cannot be scheduled in the past, and the first bar fires
      // at almost exactly the current context time.
      const at = Math.max (time, Tone.now() + 0.01);
      const floor = 1 - amount;
      // Recovery scales with tempo so the pump keeps its musical length
      // instead of getting shorter as the track speeds up.
      const recovery = Math.min (0.55, (60 / tempo) * 0.85);

      sidechain.gain.cancelScheduledValues (at);
      sidechain.gain.setValueAtTime (floor, at);
      sidechain.gain.linearRampToValueAtTime (1, at + recovery);
    }
  };
}
