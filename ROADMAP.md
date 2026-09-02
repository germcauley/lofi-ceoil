# Lofi Ceoil — roadmap

How to make the music more interesting without making it random.

## The principle

**Interest is not the opposite of predictability — randomness is.** A random walk has maximum entropy and near-zero interest, which is why most generative music toys sound like noodling. Music gets interesting through *expectation and deviation*: state a pattern, then bend it.

Four techniques let us add variety without risk. Everything below is an application of one of them.

1. **Vetted vocabularies** — sample from hand-authored cells (rhythms, cadences, motif operations), never from a continuous range.
2. **Derivation over generation** — new material is a transformation of material already accepted.
3. **Constraint plus rejection** — generate, test against music rules, retry on failure.
4. **Weighted transitions** — degree-to-degree probability tables reflecting folk practice, so common moves stay common.

---

## Status

- [x] **1. Chord voice leading**
- [x] **2. Per-mode progression sets, including the pop canon**
- [x] **3. Motif and development**
- [x] **4. Chord-aware melody**
- [x] **5. Cadences and question/answer**
- [x] **6. Counter-line textures: imitation and heterophony**
- [x] **7. Eight-bar parts with a higher turn**
- [x] **8. Bass patterns and staged entrances** *(the comping-rhythm half remains)*
- [ ] **9. Long-form structure** — arrangement done; energy arc and modal shift remain
- [x] **10. Rests and phrasing**
- [x] **11a. Ties over the barline**
- [x] **11b. Anacrusis and empty bars**
- [x] **12. Instrument voices** *(now including a sampled piano)*
- [x] **13. Voice changes driven by the arrangement**
- [ ] **14. The turntable — draggable vinyl that really scrubs**
- [ ] **15. More bass voices**
- [ ] **16. Radio mode — tracks that segue**
- [ ] **17. Generated tune names**
- [ ] **18. Save the current tune**
- [ ] **19. Sheet music, as ABC**
- [x] **20. Sampled whistle and harp** *(fiddle still synthesised — no CC0 violin found)*
- [ ] **21. More styles, slowed + reverb type music, trance, minimalism
- [ ] **22. Animated DJ that actually controls the mix, tempo etc
- [x] **23. Piano for chords, with an auto mode**
- [ ] **24. Sometimes we need to slow things down and end a tune, give some space before next tune start, let vinyl crackle continue, this can be a random thing that only happend every so often, like a DJ finsihing a set of songs, dont overuse it.
- [ ] **25. We should be able to move between keys, major to minor relative is the easiest choice but we can also be adventurou if the theory makes sense. Changing key after a bunch of songs that are all similar might be the best choice. I'll leave the decision making up to you we can talk about this when implementing

---

## 1. Chord voice leading — done

**The problem.** `buildChord` re-voiced every chord into a target register independently, so every voice jumped on every chord change — parallel motion in all four voices. That is the blocky, static quality in the accompaniment.

**The fix.** From the previous voicing, move each voice to the *nearest* tone of the new chord and hold common tones. This is the difference between a chord sequence and a chord progression.

## 2. Per-mode progression sets — done

**The problem.** There were only `major` and `minor` sets, with dorian mapped onto minor and mixolydian onto major. That discarded the defining feature of each mode.

- **Dorian's** signature is a **major IV** over a minor tonic, from the raised sixth.
- **Mixolydian's** signature is the **major ♭VII**.

**The fix.** A progression set per mode, plus the pop canon. Chord progressions are not copyrightable — they are treated as unprotectable common material, which is why one four-chord loop underpins hundreds of hit songs. Melody is where infringement lives; harmony is free.

Notable additions: **I–♭VII–IV** in mixolydian is where Irish traditional music and rock already meet — modal enough to carry the tunes, familiar enough to feel like a song.

---

## 3. Motif and development — done

**The problem.** `createPhrase` picks each note by weighted interval with a contour nudge. That is a *constrained random walk* — the current note is the only influence on the next. No idea is stated, so nothing can be developed, and `varyPhrase` can only perturb degrees by ±1, which is noise rather than development.

Real tunes are built from **motifs**: a short cell, restated transformed.

**The fix.** Generate one bar — four or five notes — then build the other three by applying operations to it.

| Operation | What it does | Why it is safe |
|---|---|---|
| **Sequence** | Restate the cell a step or third higher/lower | The most common device in folk melody. Same shape, so it cannot sound wrong |
| **Inversion** | Flip interval directions | Familiar contour, new destination |
| **Augmentation** | Double note lengths | Same pitches, new weight |
| **Ornamented repeat** | Same notes, more cuts | Literally what a trad player does on the repeat |
| **Truncation + extension** | First half, then continue differently | Keeps the opening recognisable |

The randomness moves from *which note* to *which operation*, and every operation yields something coherent because it derives from material already accepted.

**As built.** Bar 1 is always the plain statement and bar 4 is always a cadence, so two phrases developed from the same motif share their opening and their ending — which is what makes the repeat in an AABB sound like a repeat while still varying in the middle. Bar 2 is weighted heavily toward sequence; bar 3 is where the phrase develops further.

Two rejection gates keep it honest. A **motif gate** requires three distinct pitches and a range between a second and a sixth, because a weak cell makes every bar derived from it inert. A **phrase gate** rejects a range over a tenth, more than two leaps in a row, or a note repeated more than three times.

## 4. Chord-aware melody — done

**The problem.** Melody notes come from a scale pool with no knowledge of the chord underneath, so a note can clash and simply sit there unresolved.

**The fix**, straight from common practice:

- Strong beats take **chord tones**.
- Weak beats may take non-chord tones, but only as **passing tones** (approached and left by step in the same direction) or **neighbour tones** (step away, step back).

Roughly twenty lines, and it removes essentially every wrong-note moment.

**As built.** Fitting happens at render time rather than during phrase generation, so the motif stays abstract and can still be sequenced and inverted freely — it is the *rendered* note that adapts to whatever chord is underneath.

Only **exposed** notes are fitted: on a strong beat and at least a quaver long, or three quavers long anywhere. Short notes passing between chord tones are dissonant by design and are left alone. A note moves at most **one scale step**; if no chord tone is that close it is left where it is, because anything further would change the melody rather than correct it.

Measured over 400 phrases: exposed notes landing on chord tones rose from **46.6% to 98.6%**, with a maximum movement of two semitones and — across 4,972 interval pairs — **zero contour direction flips**. The tune's shape survives the correction intact.

The generate-and-test rules landed with item 3.

## 5. Cadences and question/answer — done

Bar 2 should close on an unstable degree — the 2nd or 5th, a half cadence. Bar 4 closes on the tonic. Currently only the final note is forced home, so phrases have an ending but no shape. Antecedent and consequent is what makes four bars feel like a sentence.

Add three or four stock **cadence formulas** per mode. Trad tunes reuse the same closes constantly; it is a feature, not a limitation. Zero risk, instant idiom.

**As built.** Two formula sets — `full` closes on the tonic, `half` on the fifth or second. Bar 4 renders a full cadence outright. Bar 2 keeps its development and only its *final note* is redirected, to whichever of the fifth or second is nearer, so the sequence keeps its shape and just gains a question mark.

Measured over 300 phrases: bar 4 lands on the tonic **300/300**, and bar 2 on the fifth or second **300/300** once the fallback path was taught to half-cadence too.

## 6. Counter-line textures — done

Currently the counter line is *figuration* — an arpeggio. It fills space intelligently but shares no material with the tune, so it can only be tasteful, never interesting.

- **Imitation.** Play the melody's motif delayed by a bar, a fourth or fifth below. Canon. Highest payoff here — it immediately sounds composed rather than generated.
- **Heterophony.** The actual traditional Celtic texture, and almost nobody implements it: a second voice playing *the same tune*, simplified or ornamented differently. Two fiddlers playing one melody, not two melodies.
- **Voice-leading constraints** against the melody: no parallel fifths or octaves, prefer contrary motion, stay within a tenth.

**As built.** Chosen per phrase, weighted toward figuration so the others stay events rather than the norm. Imitation answers with the melody's previous bar an octave down — bar 0 answers bar 3, so the canon carries across the phrase boundary instead of falling silent every four bars. Heterophony plays the current bar thinned to its longer notes, nudged 30 ms late, the way a second player sits just behind the lead.

Both echo textures are fitted to the current chord, since the harmony has moved on since the melody played that material. The active texture is shown next to the progression in the readout.

## 7. Eight-bar parts with a higher turn — done

Irish tunes are **8-bar parts**, AABB, and the B part — "the turn" — typically starts a register higher.

**As built.** A part is two four-bar sentences: the first states the material and stops on a **half cadence**, leaving the question open; the second restates it and closes on the **tonic**. Bars 1 and 5 are always the plain statement and bars 4 and 8 are always cadences, so two parts from the same motif share a skeleton and differ only in the middles.

A full turn of the tune is now **32 bars** — roughly a minute and three quarters at 72 bpm — so the form spans minutes rather than seconds.

The turn needed more care than a fixed shift. B has its own motif, whose shape can more than cancel a constant +2, so the shift is **raised until the B part's mean degree actually sits above A's**. Measured live: A at 5.03, B at 7.69, a turn 2.66 degrees higher. Over 300 generated parts every bar totals exactly eight quavers, half cadences land on the fifth or second, and full cadences on the tonic 300/300.

## 10. Rests and phrasing — done

**The problem, and it was hiding in plain sight.** Every rhythm cell filled all eight quavers starting at position zero. The melody never stopped and every bar landed on the downbeat — a wall of notes locked to the beat, which is what made the whole thing feel bass-driven and mechanical.

**The fix.** Cells now carry a `start` as well as `lengths`, so a bar can begin late or stop early. Fourteen cells: six filling the bar, four starting after a rest on the downbeat, four stopping before the barline.

Measured over 2,400 bars: **21.8% now start off the downbeat**, 18.7% stop before the barline, average notes per bar down from about four to **3.19**, and no bar overruns its length.

## 8. Bass patterns and staged entrances — partly done

**Bass.** One fixed figure — root on beat one, sometimes the fifth on three — is a metronome. There is now a library: `root`, `held`, `rootFifth`, `octave`, `walk`, `anticipate` (pushes the root a quaver early so the bar arrives before the downbeat) and `sparse` (no downbeat at all, so the bar opens on the chord and the melody instead). One is chosen per part.

**Staged entrances.** Everything entering at once and never stopping is what makes a generative piece sound like a loop rather than an arrangement. Each of the turn's four parts now has a plan: which bass pattern, when the chords come in, when the drums arrive, when they pull back, whether the counter line plays.

45% of turns open **bare** — no drums, no bass, no counter, and chords held back two bars so the motif is stated in the clear. Verified by forcing the path: only the lead fires, 10 notes across three bars with every other layer silent.

Drums pull out before the end of the last part, so a turn breathes rather than stopping dead. Borrowed from jacbz/Lofi's producer, which pads its sections the same way.

**Still to do:** comping rhythm patterns for the keys (bouzouki-style driving eighths, boom-chuck, sparse pad), inversions chosen for smooth bass motion, sus4 resolutions, and harmonic rhythm — two bars per chord in the A part against one in the B part.

## 11a. Ties over the barline — done

Every bar was metrically sealed: notes fitted inside their bar and stopped at the barline, so the phrase reset on every downbeat.

**As built.** A tie is added only where the *following* bar begins with a rest, so the sustained note fills silence and can never collide with the next attack — which matters because the lead is a single monophonic voice. Cadence bars are excluded: an ending that spills over stops sounding final.

Measured over 400 parts: **20.3% contain a tie**, averaging 0.42 tied notes each, with zero ties on cadence bars and zero collisions with a following attack.

## 11b. Anacrusis and empty bars — done

**Anacrusis.** Rather than events with negative positions — which would have needed cross-bar and cross-part coordination — the pickup goes into the *answering* sentence, which keeps it inside a single part. Bar 4's opening is approached from the tail of bar 3, shortening the half cadence by one or two quavers to make room. The pickup steps toward bar 4's first note so it leads somewhere rather than just filling the gap.

Measured over 400 parts: **25% carry a pickup**, and **100% of them arrive a step from their target**, with no bar overruns and no events out of time order.

**Empty bars.** A bar with no harmony, no bass, no drums and no counter — just the tune, the drone and the surface noise. The closing bar of a part is the place for it: the melody lands on its cadence with everything else out of the way, which is a structural rest rather than merely a quiet moment. Roughly a third of parts get one.

## 12. Instrument voices — done

## 12. Instrument voices — done

Raw synth tones read as synthy very quickly. Three things fix most of it without introducing samples: a soft attack so notes start rather than appear, slight detune or chorus so a note is never one perfectly static pitch, and a lowpass sitting below the brightness of the raw oscillator.

Every voice is now built that way, and the two most exposed parts are **switchable while it plays**:

- **Lead** — `whistle` (near-sine with vibrato, tin-whistle-ish), `fiddle` (bowed saw, slower attack, heavier vibrato), `piano` (FM at a slightly inharmonic 3.01 ratio, which is what a real struck string has, with a fast modulation decay for the hammer knock), `harp` (Karplus-Strong pluck, a physical decay rather than an envelope)
- **Keys** — `rhodes` (FM through chorus), `felt` (muted triangle, heavily rolled off), `pad` (detuned saws, long swell)

Swapping disposes the old chain after a delay, so notes still ringing are not cut off mid-decay. Verified with six live swaps under playback and no scheduling failures.

**The piano is sampled.** FM got as close to a piano as it usefully can, and a struck string with its own resonance and release noise is not something an oscillator reaches. It now uses nine notes from the Salamander Grand Piano set across three octaves, vendored into `public/samples/piano/` rather than fetched from someone else's host, and loaded only when the voice is chosen — 588 kB that nobody pays for unless they ask for a piano. It loads in about a tenth of a second locally, and the panel reads `loading piano` until it is ready rather than going quiet.

Every other voice stays synthesised. The same route is open for any of them: `triggerAttackRelease` is the `Tone.Sampler` interface, so it is a one-function change each time.

## 13. Voice changes driven by the arrangement — done

Coming back from a drop is exactly where an arrangement wants a new colour: the accompaniment falls away, and what returns should not be identical to what left.

**As built.** A part following one that ended on an empty bar gets a *different* lead voice; otherwise the voice holds, because changing it every part would be a gimmick rather than an arrangement. Changes land on the part boundary, never mid-phrase.

The lead selector gained an `auto` option that hands the choice to the arrangement. Picking a voice by hand pins it. Verified across 900 part-pairs: 300 correct changes after a drop, 600 correct holds, zero errors in either direction.

## 16. Radio mode — tracks that segue

Right now this plays one endless tune: the motifs rebuild every 32 bars, but the key, mode and tempo never change, so it is one piece forever. Radio mode makes each tune a **track** — a fixed set of key, mode, tempo, motifs, voices and bass patterns, held for three or four turns, perhaps five minutes — with the next one lined up and segued into.

**The good news: the transition machinery already exists.** Empty bars and staged entrances were built for phrasing, and they are exactly how a lofi segue works. End the outgoing track on a drop, start the incoming one bare. No crossfade, no second engine, no doubled CPU — and Tone has only one Transport, so running two tracks at once would be the hard way to do this.

Two things need care:

- **Key relationship.** A jump to an unrelated key sounds like someone changed station. The next key should come from a pivot set — the relative major or minor, or up a fourth or fifth — so the move reads as a modulation rather than an edit. Better still, end the outgoing track on a chord the two keys share and simply continue into it.
- **Tempo.** Tracks want different tempos, but a jump is jarring. `Transport.bpm.rampTo` over a bar or two carries it, and a slight rallentando into the drop would sound deliberate.

## 17. Generated tune names

Wistful, longing titles: *thinking of you here*, *why can't it rain every day*.

**The wrinkle is that this is a static site, so it cannot hold an API key.** Anything shipped to the browser is readable, so a live LLM call would either expose a key or require a server — which would undo the fact that this whole thing is a folder of files on GitHub Pages.

Three routes, and the third is clearly best:

1. **A local grammar** — word banks and templates. Free, instant, offline, but the seams show after a dozen titles.
2. **Live LLM** — best variety, but needs a proxy server or asks each listener for their own key.
3. **Pre-generated at build time.** An LLM writes several hundred titles once; they ship as a JSON file; the app picks one per track. The quality of an LLM, none of the runtime cost, no key anywhere. Regenerate the pool whenever it starts to feel familiar.

The title also wants somewhere to live on the panel — probably where the model plate sits now.

## 18. Save the current tune

Export what is playing, with **Ger McAuley** and this repository credited as composer.

**This shares its foundation with the turntable.** Both need the master captured into a rolling buffer, so building item 14's capture worklet delivers most of this one for free. Build the capture once.

From a captured buffer, two output routes:

- **WAV** with a `LIST`/`INFO` chunk carrying artist and composer. No dependencies, but tag support is thin and not every player reads it.
- **MP3** with proper ID3 tags via an encoder such as `lamejs`. Better metadata, at the cost of a dependency and encoding time.

Worth also writing the **seed** into the metadata — the key, mode, tempo, motifs and voices that produced the track. A saved file that records how to regenerate itself is a nicer artefact than a bare audio export, and it costs one JSON blob in a comment field.

## 19. Sheet music, as ABC

The generator already works in scale degrees and MIDI, so it holds everything notation needs. The question is only which format.

**ABC is the obvious answer, and not only on technical grounds.** It is *the* notation Irish traditional music is written and shared in — plain text, tiny, and directly pasteable into thesession.org. `abcjs` renders it in the browser and can play it back. For a Celtic tune generator, exporting anything else would be slightly missing the point. MusicXML remains worth adding later for anyone importing into MuseScore or Sibelius.

Two things to decide:

- **What gets notated.** The melody is the tune. Chords fit naturally as ABC chord symbols above the staff. The counter line is a second voice — ABC supports that, but a single staff with chord symbols is the idiomatic trad presentation and probably the right default.
- **What the form looks like on paper.** Eight-bar A and B parts with repeat marks, which is exactly how a tune is written down — so the structure built in item 7 maps onto the page with no translation.

## 20. Sampled whistle and harp — done

Both come from the **Versilian Community Sample Library**, which is CC0.

- **Whistle** is a Baroque soprano recorder — the nearest thing in a CC0 library, and the same family of edge-blown pipe. It sounds an octave above where the tune is written, which is what a tin whistle does anyway.
- **Harp** is a folk harp, which is the instrument this music actually belongs to.
- The Karplus-Strong pluck stays as **`harp (synth)`**, and the old synthesised whistle as **`whistle (synth)`** — their character is a different instrument, not a worse one.

**Fiddle is still synthesised.** VCSL has no violin: its Composite Chordophones are harp, folk harp and strumstick only. A CC0 bowed string is still to be found — VSCO 2 Community Edition is the likely source.

### Three things this cost, all worth recording

**VCSL names an octave below scientific pitch.** Their `C4` measures 522 Hz, which is MIDI 72, so it is Tone's C5. Verified by spectrum rather than assumed — autocorrelation first suggested the octave above, and only the FFT showed there was no energy at 261 Hz at all. Every sample is filed under the note it actually sounds.

**A `#` in a filename silently breaks the load.** In a URL a `#` begins the fragment, so `G#4.mp3` requests `G` and the sampler simply never gets a buffer — with no error, because nothing failed. Sharps in filenames are written `s`.

**A sampler must not be handed to the scheduler before it loads**, or the next note throws `buffer is either not set or not loaded`. The old voice now keeps playing until the new one signals ready, which also removes the gap. `Tone.loaded()` is global and resolved too early here, so each sampler carries its own `onload` promise. A six-second timeout stops a sample that never arrives from wedging playback.

## 23. Piano for chords, with an auto mode — done

The Salamander piano is now a keys voice too, voiced for chords: quieter and rolled off further so a four-note voicing does not crowd the melody.

Both rows have an `auto` option. The chord voice deliberately changes **less often than the lead** — 40% of the time the lead changes, rather than every time. Changing both at every section return would leave nothing recognisable across the seam; one of them has to carry the thread.

## Original notes on 20

The piano proved the point: synthesis has a ceiling for acoustic instruments, and past it the honest move is samples.

- **Whistle** and **fiddle** are the two most exposed voices and the two that most betray their oscillators. VCSL and VSCO 2 Community Edition are both CC0 and carry winds and strings.
- **Harp** gets a sampled option too — but the current Karplus-Strong one **stays**. Its retro character is liked, and it is a genuinely different instrument rather than a worse version of a real harp. It should be renamed to say so, something like `harp (synth)` beside `harp`.

Same lazy-load pattern as the piano: vendored, fetched only when chosen, with the panel showing a loading state. Each voice is roughly 500 kB, so they stay off the initial page load.

## 15. More bass voices

The bass has one timbre and seven patterns. The patterns changed how it *moves*; a voice selector would change what it *is*, and the low end is doing more work than any other single part.

Worth having, in roughly the order they suit the material:

- **Upright** — pizzicato double bass. The lofi default, and the one that would change the record most. Needs a short filtered noise transient for the finger, a fast decay and a touch of body resonance. A strong candidate for sampling rather than synthesis, for the same reason the piano was.
- **Sub** — near-pure sine with a slow attack, felt rather than heard. Pairs well with the `sparse` and `held` patterns.
- **Electric** — fingered bass guitar: filtered triangle with a slight pluck transient and a longer sustain than the upright.
- **Moog** — resonant filtered saw with an envelope sweep. Modern, sits oddly against the trad melody, which may be exactly the point on some turns.

Same shape as the lead and keys selectors, so the work is mostly voice design rather than plumbing. It should also join the `auto` arrangement logic once it exists: a bass voice change is another way to mark a section return.

## 14. The turntable — draggable vinyl that really scrubs

A spinning record on the panel that can be grabbed and dragged to rewind or fast-forward what is playing, with the pitch-bending scrub sound that goes with it.

**The hard part, and it is worth stating plainly: there is nothing to scrub.** This is a generative instrument, not a track player. The music is composed a bar ahead of where it plays, so there is no audio timeline sitting behind the playhead to move through. Winding the transport backwards would not replay what you heard — it would re-run the scheduler over material that no longer exists.

So the feature has a prerequisite, and the prerequisite *is* the feature:

**Capture the output.** A worklet on the master writes continuously into a circular buffer — sixty seconds of stereo at 48 kHz is about 23 MB, which is nothing. That recording is the thing the record represents, and once it exists, scrubbing is real rather than an effect.

**Then read it back under the drag.** An `AudioBufferSourceNode` cannot play backwards, so this needs a custom worklet reading the circular buffer at a signed, fractional rate with interpolation — the rate coming from the drag velocity. Negative rate gives genuine reverse; a rate above one gives fast-forward; the pitch shift falls out of the resampling for free, which is exactly the sound wanted.

**Handing back to the live engine.** On release the playhead has to catch up to the present and cross back to the live signal, which wants a short crossfade rather than a hard switch. Dragging *forward* past the present is the interesting case — there is nothing recorded there yet, so the wind has to run out at the playhead rather than into silence.

Worth building. It is the most distinctive thing on the list, and it is the only item that changes what the instrument *is* rather than what it plays.

## Original item 8 notes

- A vocabulary of backing patterns: bouzouki-style driving eighths, boom-chuck, sparse pad. Chosen per section instead of the fixed hit-plus-stab.
- **Inversions chosen for bass motion** — pick the inversion giving the smoothest bass line.
- **Suspensions**: sus4 resolving to the third is deeply Celtic and nearly free.
- **Harmonic rhythm**: two bars per chord in the A part, one in the B part. Changing the *rate* of change is a structural device currently absent.

## 9. Long-form structure

- Section-level texture changes: drop the drums, bring in the drone.
- An energy arc over minutes rather than bars.
- Occasional modal shift at a section boundary.

---

## Known limitation

A few famous progressions need chords from *outside* the mode. The Andalusian cadence (i–♭VII–♭VI–**V**) needs a major V in a minor key, which requires a raised seventh that natural minor does not contain. `buildChord` derives everything from scale degrees and cannot currently produce an accidental. Supporting these means adding explicit chromatic alteration or a mode-mixture mechanism — a change to the theory layer, not a table entry.
