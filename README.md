# Lofi Ceoil

A browser instrument that generates endless lofi with an Irish accent, and lets you shape it while it plays.

*Ceoil* — of music.

**[▶ Play it](https://germcauley.github.io/lofi-ceoil/)** — no install, no sign-up. Press start and turn things.

![The Lofi Ceoil panel](docs/panel.png)

Everything is synthesised in the browser with [Tone.js](https://tonejs.github.io/). There are no audio files, no samples, and no server — the whole thing is about 280 kB of JavaScript and it will run forever without repeating itself.

## What it actually does

Most generative lofi toys roll new random notes every bar, which produces noodling rather than music. This one writes **phrases**.

It works from **motifs**. Each cycle invents two one-bar cells and develops each into an eight-bar part — the length an Irish tune actually comes in — then plays them **AABB**, so a full turn is 32 bars. A phrase is built by applying named operations to its motif — *repeat*, *sequence*, *inversion*, *augmentation*, *truncate-and-extend* — so the randomness sits in which operation is chosen, never in which note comes next. Every result is coherent because it is a transformation of material already accepted.

Bars 1 and 5 are always the plain statement and bars 4 and 8 are always cadences, so the two developments of a motif share a skeleton and differ only in the middles. That is what makes the repeat sound like a repeat.

Two gates keep it honest: a motif needs three distinct pitches and a range between a second and a sixth, and a finished phrase is rejected if it spans more than a tenth, leaps more than twice in a row, or repeats a note more than three times.

The melodic grammar leans Celtic and folk:

- **Gapped note pools.** Rather than the full seven-note scale, melodies draw on pentatonic and hexatonic subsets, which is what most Irish and Scottish tunes actually use. Dorian and mixolydian keep their characteristic sixth and flat seventh.
- **Stepwise motion.** Intervals are weighted heavily toward steps, with fourths and fifths as occasional events rather than the default. Random intervals sound random; weighted ones sound sung.
- **Arched contour.** Each phrase rises toward a peak bar and falls back, coming to rest on the tonic. That cadence is what makes a phrase sound finished.
- **Cuts.** Fast grace notes flicked in above the main note. This single ornament does more for the folk character than any amount of note choice.

Each part is two four-bar sentences shaped as a **question and an answer**: the first stops on a half cadence — the fifth or the second, leaving it open — and the second closes on the tonic. That is what makes eight bars feel like a sentence rather than eight bars.

The **B part sits higher** than the A part, as the turn does in trad. A fixed shift is not enough, since B's own motif can cancel it out, so the shift is raised until the turn genuinely sits above the A part.

There is a second line too, in one of three **textures** chosen per phrase. *Figuration* arpeggiates the chord into the melody's rests. *Imitation* answers with the melody's previous bar an octave down — canon, carried across the phrase boundary so it never falls silent. *Heterophony* plays the same tune thinned to its longer notes and nudged fractionally late, the way a second player sits behind the lead; it is the traditional Celtic texture and the one almost nobody implements.

Figuration follows three rules that keep it musical instead of busy:

- **It arpeggiates the actual chord**, so it is consonant with the harmony rather than merely in key.
- **One figure per phrase.** Six shapes — up, down, up-down, alberti, pendulum, rolling — chosen once and held for four bars. A repeating figure reads as accompaniment; a fresh note order every bar reads as fidgeting.
- **Complementary rhythm.** It maps where the melody is sounding and plays into the rests. This is the part that makes two lines sound like a duet instead of a pile.

It also runs in contrary motion: when the melody climbs across a phrase, the figure runs backwards.

Melody notes are **fitted to the chord** as they play. Anything exposed — on a strong beat and at least a quaver long, or longer than that anywhere — is nudged onto a chord tone, but never by more than one scale step, so the motif's shape is preserved rather than overwritten. Short passing notes are left dissonant, because that is what they are for. It takes exposed notes from under half landing on chord tones to virtually all of them, without a single change of melodic direction.

Rhythm cells carry rests as well as notes, so a bar can start after the downbeat or stop before the barline — about a fifth do each. Without that the melody never stops and every bar lands on the beat, which is what makes a generated tune sound locked to a grid.

The bass has a pattern library rather than one figure — root, held, root-fifth, octave, walk, *anticipate* (pushing the root a quaver early so the bar arrives before the downbeat) and *sparse* (no downbeat at all). One is chosen per part.

Each turn also gets an **arrangement**: which layers play in which of its four parts, when the drums arrive and when they pull back. Nearly half of all turns open bare — no drums, no bass, chords held back two bars — so the motif is stated in the clear before anything joins it.

Underneath, chords come from **per-mode progression sets** written in roman numerals, so they transpose to any key for free. Each mode gets its own, because the chords that define a mode only exist in that mode — dorian's major IV comes from its raised sixth, mixolydian's major ♭VII from its flat seventh. The sets include the pop canon (I–V–vi–IV and friends) alongside the modal vamps; chord progressions are unprotectable common material, so they are free to use.

Chords **voice-lead**: each voice moves to the nearest tone of the next chord and common tones stay put, which averages a little over one semitone of movement per voice. Re-voicing each chord independently is what makes block chords sound blocky. A pipe-like drone holds the fifth. The drums swing, humanise their timing, and duck the whole mix on every kick.

Then the tape path ruins it pleasantly: saturation, parallel bitcrushing, wow and flutter, a lowpass, reverb, and a bed of vinyl hiss and crackle that never pumps, because a record surface doesn't.

**Voices are switchable while it plays.** The lead can be a `whistle`, a `fiddle`, a `piano` or a `harp`, with synthesised versions of the whistle and harp kept alongside the sampled ones; the keys a `rhodes`, a `felt` piano, a `piano` or a `pad`. Most are synthesised — a soft attack, a little chorus or detune, and a lowpass under the raw oscillator do most of the work of not sounding synthetic. The piano is **sampled**, because FM only gets so close to a struck string; its samples load only when you choose it.

Set either row to `auto` and the **arrangement picks the voice**: a part that follows a drop comes back on a different instrument, which is what gives a section return its lift. The chord voice changes less often than the lead, because if both change at once nothing carries across the seam. Pick a voice by hand and it stays put.

Phrases can begin with an **anacrusis** — a pickup into the answering sentence, stepping toward its first note, the way an Irish tune starts on an upbeat rather than the downbeat. And a part's closing bar is sometimes **empty**: no harmony, no bass, no drums, so the tune lands on its cadence alone.

Notes can also **tie over the barline**, but only where the next bar starts with a rest, so a sustained note fills silence rather than colliding with the next attack. About a fifth of parts carry one.

Every so often — no more than once in seven or eight turns — the tune **ends a set** rather than rolling on. The last part sheds a layer at a time, the tempo eases off, the melody lands on its cadence, and two to four bars of nothing but surface noise follow before the next tune starts in a **new key**.

Keys move four ways: the relative major or minor, a fifth either way, up a tone, or modal interchange — same tonic, new mode. Where the two keys share a chord, that **pivot** carries the change, so the ear hears it in the old key and then finds it has been in the new one all along. Tunes occasionally modulate this way *without* stopping, which is rarer still. The panel's key and mode buttons follow it either way.

The melody is **phrased, not executed**. Each sentence has a dynamic arch that crests about two thirds through, emphasises its peak note, and eases into its cadence; steps are slurred and leaps separated; and there is a breath before each new sentence. Velocity used to be random per note, which is not phrasing but noise.

The counter line picks a **feel** per phrase — even, sparse, running semiquavers, or pulsed — and sits an octave up a quarter of the time. The echo textures carry the melody's own phrasing with them.

## The controls

Drag a knob vertically. Hold **shift** for fine adjustment, **double-click** to reset, scroll to nudge. Everything responds while it plays. **Space** starts and stops.

| Composition | |
|---|---|
| **tempo** | 55–95 bpm |
| **swing** | how far the offbeats lean |
| **density** | how busy the drums and melody get |
| **counter** | how much the arpeggiated second line plays |
| **cuts** | how often notes get ornamented |
| **drone** | the sustained fifth underneath |

| Tape path | |
|---|---|
| **tone** | lowpass cutoff — muffled to open |
| **dust** | bitcrush, bit depth and vinyl noise together |
| **wobble** | wow and flutter depth |
| **drive** | tape saturation |
| **space** | reverb |
| **pump** | how hard the kick ducks the mix |
| **level** | output |

Key and mode are buttons. Changing mode rebuilds the phrase, since a tune written for dorian doesn't belong in major.

## Running it locally

```bash
npm install && npm run dev
```

Then open `http://localhost:5173`. Node 22 or later.

## Where things live

The code is organised so that each file answers one question.

| File | What it decides |
|---|---|
| [`src/theory.js`](src/theory.js) | Scales, chord voicings, and the progression table. **The highest-leverage file** — adding a progression here changes what the machine sounds like more than anything else. |
| [`src/melody.js`](src/melody.js) | Phrase construction: gapped pools, interval weighting, contour, ornaments, AABB variation, and the counter-line figures. |
| [`src/parts.js`](src/parts.js) | What each instrument plays in a given bar. |
| [`src/instruments.js`](src/instruments.js) | The synth voices. Each exposes `triggerAttackRelease`, which is also the `Tone.Sampler` interface, so swapping any voice for real samples is a one-function change. |
| [`src/effects.js`](src/effects.js) | The tape path and the sidechain duck. |
| [`src/engine.js`](src/engine.js) | Audio graph, live state, and bar scheduling. |
| [`src/knob.js`](src/knob.js) | The rotary control. Pointer, wheel, and keyboard, with the standard slider role. |
| [`src/meter.js`](src/meter.js) | The segmented LED spectrum display, driven by a real FFT of the output. Colours are read from CSS custom properties, so the palette stays in one place. |

In development, `window.lofi` is exposed — `lofi.controls.dust(0.9)` works from the console.

## Notes for anyone extending it

Tone's monophonic voices — `MonoSynth`, `Synth`, `NoiseSynth` — reject events scheduled out of order, and they do it by throwing. If you add a part that can place two notes at overlapping times on one voice, either give it its own voice or sort and space the events first. Both bugs found while building this were exactly that.

## Design

A dark maroon panel floating on a hot pink to coral gradient, with a segmented LED meter running orange at the bottom into pink at the top.

The whole palette lives in `:root` at the top of [`src/style.css`](src/style.css). Restyling is about fifteen values.

## Roadmap

[ROADMAP.md](ROADMAP.md) — what is planned for the music engine and why, including the reasoning on how to add variety without adding randomness.

## Licence

MIT. The code is original; nothing is derived from another generator.

The piano samples are from the [Salamander Grand Piano](https://archive.org/details/SalamanderGrandPianoV3) by Alexander Holm, CC-BY 3.0.

The whistle and harp samples are from the [Versilian Community Sample Library](https://github.com/sgossner/VCSL) by Versilian Studios, CC0.
