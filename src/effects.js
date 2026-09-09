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

  // The kit has its own way in. Two things were wrong with sending it through
  // the sidechain alongside everything else. The kick ducked itself, so the
  // pump ate the very transient it was triggered by; and the kit shared the
  // brightness lowpass, which is set for the melodic voices and sits near
  // 2.6 kHz — below almost all of a hat. A sidechain is supposed to duck the
  // music around the drums, not the drums as well.
  const kitInput = new Tone.Gain (1);
  // Its own tone control, tracking brightness so the kit darkens with the
  // track, but from far higher up and with a floor that keeps the hats.
  const kitTone = new Tone.Filter ({ type: 'lowpass', frequency: 9000, rolloff: -12, Q: 0.4 });

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
  // The echo is a send rather than a stage in the chain, because a delay
  // across the whole mix smears the bass and drums into porridge. Only the
  // melodic voices are fed into it, so the low end stays dry and the tune is
  // the thing that repeats.
  const echoSend = new Tone.Gain (0);
  // Echoes with full low end pile up. Thinning them first is most of what
  // keeps a long feedback tail from turning into mud.
  const echoTrim = new Tone.Filter ({ type: 'highpass', frequency: 320, rolloff: -12 });
  const echoDelay = new Tone.FeedbackDelay ({ delayTime: 0.5, feedback: 0.36, wet: 1 });
  // Movement on the repeats only. The dry signal never touches this, so it
  // colours the tail without smearing the note that caused it.
  const echoPhase = new Tone.Phaser ({ frequency: 0.22, octaves: 2, baseFrequency: 500 });
  const echoReturn = new Tone.Gain (1);

  const reverb = new Tone.Reverb ({ decay: 3.2, wet: 0.28, preDelay: 0.02 });

  // Catches the peaks that saturation and the noise bed add, so the output
  // stays put regardless of where the knobs are.
  const limiter = new Tone.Limiter (-1.5);
  const master = new Tone.Gain (0.9);

  // Bitcrush is mixed in parallel rather than inline: fully crushed sounds
  // like a broken codec, a blend sounds like an old sampler.
  sidechain.connect (saturation);
  // The kit joins after the duck and before the colour, so it is saturated,
  // crushed and warbled with everything else — the treatment is what makes it
  // sound like a record — but it is never ducked and never dulled.
  kitInput.connect (kitTone);
  kitTone.connect (saturation);
  saturation.connect (crusherMix.a);
  saturation.connect (crusher);
  crusher.connect (crusherMix.b);

  crusherMix.connect (wobble);
  wobble.connect (tone);
  tone.connect (sweepHigh);
  sweepHigh.connect (sweepLow);
  // The return lands after the sweeps so a filter sweep takes the echoes with
  // it, and before the reverb so repeats sit in the same room as everything
  // else rather than in front of it.
  echoSend.connect (echoTrim);
  echoTrim.connect (echoDelay);
  echoDelay.connect (echoPhase);
  echoPhase.connect (echoReturn);
  echoReturn.connect (reverb);

  sweepLow.connect (reverb);
  reverb.connect (limiter);
  limiter.connect (master);
  master.toDestination();

  return {
    input: sidechain,
    sidechain,
    kitInput,
    kitTone,
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
    echoSend,
    echoDelay,

    /** The kit's share of the brightness knob. It follows the same gesture as
        the melodic tone so the whole track darkens together, but it starts an
        octave and a half higher and never closes below 4 kHz, because past
        that point a hat stops being quiet and starts being absent. */
    setKitTone (brightness, when = Tone.now()) {
      const amount = Math.max (0, Math.min (1, brightness));
      kitTone.frequency.rampTo (4000 + amount * 10000, 2, when);
    },

    /** How much of the melodic voices is fed to the echo. */
    setEcho (amount, when = Tone.now()) {
      echoSend.gain.rampTo (Math.max (0, Math.min (1, amount)) * 0.5, 0.4, when);
      // More echo wants a longer tail, or it reads as a slapback rather than
      // something the tune disappears into.
      echoDelay.feedback.rampTo (0.24 + Math.max (0, Math.min (1, amount)) * 0.3, 0.4, when);
    },

    /** A dotted eighth at the current tempo — the classic lofi echo, and the
        one that locks to the beat rather than fighting it. Set explicitly
        rather than in note notation, because a delay written as `8n.` is
        resolved once against whatever the tempo happened to be and then never
        follows it again. */
    setEchoTempo (tempo) {
      if (! (tempo > 0)) return;
      echoDelay.delayTime.rampTo (Math.min (1.5, 0.75 * 60 / tempo), 0.3);
    },

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
