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
  tone.connect (reverb);
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
    reverb,
    limiter,
    master,

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
