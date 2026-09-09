import { test, expect } from '@playwright/test';

test ('the default drone remains a quiet supporting layer', async ({ page }) => {
  await page.goto ('/');
  const measured = await page.evaluate (async () => {
    const e = window.lofi;
    const context = e.chain.master.context;
    await context.resume();
    const analyser = context.rawContext.createAnalyser();
    analyser.fftSize = 2048;
    e.state.drone.connect (analyser);
    const at = context.rawContext.currentTime + 0.1;
    e.state.drone.triggerAttackRelease ('G2', 2.5, at, 0.14 * 0.32);
    await new Promise (resolve => setTimeout (resolve, 1200));
    const buffer = new Float32Array (analyser.fftSize);
    let energy = 0, samples = 0;
    for (let i = 0; i < 40; i++) {
      analyser.getFloatTimeDomainData (buffer);
      for (const value of buffer) { energy += value * value; samples++; }
      await new Promise (resolve => setTimeout (resolve, 15));
    }
    const rmsDb = 20 * Math.log10 (Math.sqrt (energy / samples));
    analyser.disconnect();
    await context.close();
    return rmsDb;
  });
  console.log ('Default drone RMS dBFS:', measured.toFixed (1));
  expect (measured).toBeGreaterThan (-95);
  expect (measured).toBeLessThan (-55);
});


/** The balance between the parts, measured through the real chain rather than
    judged by ear. Three things had gone wrong and none of them was audible as
    a number until it was measured. The bass was the loudest sustained thing in
    the mix, above the tune it was meant to be under. The kit sat so far below
    it that the hats were thirty-seven decibels down, which is not quiet, it is
    missing. And the voices had never been levelled against each other at all —
    thirteen decibels between the loudest lead and the quietest — so whether
    the tune could be heard over the bass depended on which voice was drawn.

    The tape path is pinned first. A track's own variation moves brightness,
    drive and space, and all three change what a level measures; at arc depth
    nought every knob means exactly what it says. Without that, this test reads
    a different mix on every run. */
// Thirteen voices, each given time to load and settle before it is measured.
test.setTimeout (180000);
test ('the bass sits under the tune, the kit stays in earshot, and no voice is out of line', async ({ page }) => {
  await page.goto ('/');
  const measured = await page.evaluate (async () => {
    const e = window.lofi;
    const context = e.chain.master.context;
    await context.resume();
    const raw = context.rawContext;
    const analyser = raw.createAnalyser();
    analyser.fftSize = 2048;
    e.chain.master.connect (analyser);
    const buffer = new Float32Array (analyser.fftSize);

    e.controls.arc (0);
    for (const [knob, at] of [['brightness', 0.29], ['drive', 0.3], ['space', 0.28],
      ['dust', 0.3], ['wobble', 0.35], ['echo', 0], ['pump', 0]]) e.controls[knob] (at);
    await new Promise (resolve => setTimeout (resolve, 2000));

    const db = x => x > 0 ? 20 * Math.log10 (x) : -120;

    async function measure (fire, seconds = 2) {
      await new Promise (resolve => setTimeout (resolve, 600));
      fire (raw.currentTime + 0.15);
      let peak = 0, energy = 0, samples = 0;
      const until = Date.now() + seconds * 1000;
      while (Date.now() < until) {
        analyser.getFloatTimeDomainData (buffer);
        for (const value of buffer) {
          const size = Math.abs (value);
          if (size > peak) peak = size;
          energy += value * value; samples++;
        }
        await new Promise (resolve => setTimeout (resolve, 8));
      }
      return { peak: db (peak), rms: db (Math.sqrt (energy / samples)) };
    }

    // The bass line the score actually writes: a downbeat and a mid-bar note,
    // at the pattern's own velocities.
    const bassBar = t => {
      e.state.bass.triggerAttackRelease ('C2', 1.1, t, 0.75);
      e.state.bass.triggerAttackRelease ('C2', 0.7, t + 1.5, 0.55);
    };
    const leadBar = t => {
      e.state.lead.triggerAttackRelease ('D4', 0.34, t, 0.5);
      e.state.lead.triggerAttackRelease ('E4', 0.34, t + 0.375, 0.5);
      e.state.lead.triggerAttackRelease ('G4', 0.34, t + 0.75, 0.55);
      e.state.lead.triggerAttackRelease ('A4', 0.5, t + 1.125, 0.5);
    };

    // Whatever the rows offer, rather than a list written down here: a voice
    // added later is then levelled by this test without anyone remembering to
    // add it.
    const namesIn = id => [...document.getElementById (id).querySelectorAll ('.seg')]
      .map (button => button.textContent).filter (name => name !== 'auto');

    const keysBar = t => {
      for (const note of ['D3', 'F3', 'A3']) e.state.keys.triggerAttackRelease (note, 0.9, t, 0.33);
      for (const note of ['D3', 'F3', 'A3']) e.state.keys.triggerAttackRelease (note, 0.7, t + 0.75, 0.28);
    };

    const bass = {}, lead = {}, keys = {};
    for (const name of namesIn ('bassVoiceRow')) {
      e.controls.bassVoice (name);
      await new Promise (resolve => setTimeout (resolve, 1500));
      bass[name] = await measure (bassBar);
    }
    for (const name of namesIn ('leadVoiceRow')) {
      e.controls.leadVoice (name);
      await new Promise (resolve => setTimeout (resolve, 2500));
      lead[name] = await measure (leadBar);
    }

    for (const name of namesIn ('keysVoiceRow')) {
      e.controls.keysVoice (name);
      await new Promise (resolve => setTimeout (resolve, 2500));
      keys[name] = await measure (keysBar);
    }

    const kit = {
      snare: await measure (t => {
        e.state.drums.snare.triggerAttackRelease (0.25, t, 0.7);
        e.state.drums.snare.triggerAttackRelease (0.25, t + 1.5, 0.7);
      }),
      hat: await measure (t => {
        for (let i = 0; i < 8; i++) {
          e.state.drums.hat.triggerAttackRelease (0.08, t + i * 0.375, i % 2 === 0 ? 0.5 : 0.3);
        }
      })
    };

    await context.close();
    return { bass, lead, keys, kit };
  });

  const show = (group, levels) => {
    for (const [name, level] of Object.entries (levels)) {
      console.log (`${group.padEnd (5)} ${name.padEnd (13)} peak ${level.peak.toFixed (1).padStart (7)}  rms ${level.rms.toFixed (1).padStart (7)}`);
    }
  };
  show ('bass', measured.bass);
  show ('lead', measured.lead);
  show ('keys', measured.keys);
  show ('kit', measured.kit);

  // Neither statistic alone is loudness. A sharp pluck like the synth harp has
  // the loudest peak of any lead and the quietest RMS, because it is over
  // almost immediately; a vibraphone is the reverse. Judging on peak makes the
  // pluck look hot, judging on RMS makes it look absent, and it is neither.
  // The mean of the two is crude but it does not let either envelope win.
  const loudness = level => (level.peak + level.rms) / 2;
  const spread = levels => {
    const all = Object.values (levels).map (loudness);
    return Math.max (...all) - Math.min (...all);
  };
  const median = levels => {
    const all = Object.values (levels).map (loudness).sort ((a, b) => a - b);
    return all[Math.floor (all.length / 2)];
  };

  // No voice is wildly out of line with the others of its role. Levels are
  // taste and will move again; a spread this wide within one role is a fault,
  // because it makes the whole mix depend on which voice the track drew. It
  // was thirteen decibels across the leads before this was measured.
  expect (spread (measured.lead)).toBeLessThan (6);
  expect (spread (measured.bass)).toBeLessThan (6);
  expect (spread (measured.keys)).toBeLessThan (6);

  // The foundation sits under the tune. Typical against typical rather than
  // extreme against extreme: the ends of both rows are unusual envelopes, and
  // what matters is where a track normally lands.
  expect (median (measured.bass)).toBeLessThan (median (measured.lead));

  // So does the accompaniment. Felt piano as keys was measured level with the
  // lead, which is an accompaniment that has stopped accompanying.
  expect (median (measured.keys)).toBeLessThan (median (measured.lead) - 3);

  // And the kit stays where it can be heard against the bass. The hats were
  // thirty-seven decibels under it, which is not a quiet kit but an absent one.
  const bassPeak = Math.max (...Object.values (measured.bass).map (level => level.peak));
  expect (measured.kit.snare.peak).toBeGreaterThan (bassPeak - 4);
  expect (measured.kit.hat.peak).toBeGreaterThan (measured.kit.snare.peak - 15);
});
