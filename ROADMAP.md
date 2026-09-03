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

## Main development priorities

These six milestones guide the next stage of the music maker. Priority numbers describe development order; the feature numbers in the status list retain their existing IDs.

| Priority | What we build | What you hear or gain |
|---|---|---|
| **1. A complete composition plan** | Store the sections, notes, harmony and arrangement before playback, with reproducible generation. | A track we can replay, inspect, edit and improve. |
| **2. Stronger musical development** | Flexible section lengths, memorable hooks, tension, contrasting passages and deliberate returns. | Music that feels like it goes somewhere. |
| **3. Instruments that respond to each other** | Bass works with the kick; accompaniment leaves space for the melody; fills announce transitions. | A more convincing ensemble. |
| **4. Better performance and sound** | Richer samples, articulation, coordinated timing and dynamics, better balance. | Less of the “MIDI instruments playing patterns” feeling. |
| **5. Creative control and export** | “Keep this melody, change the backing”; lock sections; regenerate selected parts; WAV, MIDI and stems. | A useful music-making instrument. |
| **6. Selection and taste** | Audition alternatives, save favourites and gradually bias generation toward preferred choices. | More music you want to keep. |

**Priority 1 is implemented:** tracks now have a complete, reproducible score before playback, with replay and JSON score downloads. See feature **34** for the delivered scope.

The composition plan supplies a shared foundation for the visualiser (**33**), notation (**19**), and creative control/export (**18**, expanded to MIDI and stems). Musical development builds on the recurring forms in **32**; ensemble interaction extends arrangement and counter-line work in **6**, **8** and **27**. Performance and sound extend instruments and phrasing in **12**, **20** and **26**. Selection and taste build on **30**.

---

## Status

- [x] **34. Complete composition plans, reproducible scores and replay**

- [x] **1. Chord voice leading**
- [x] **2. Per-mode progression sets, including the pop canon**
- [x] **3. Motif and development**
- [x] **4. Chord-aware melody**
- [x] **5. Cadences and question/answer**
- [x] **6. Counter-line textures: imitation and heterophony**
- [x] **7. Eight-bar parts with a higher turn**
- [x] **8. Bass patterns, staged entrances, comping and harmonic rhythm**
- [x] **32. Varied openings and recognizable tune/riff returns**
- [ ] **33. Pixel-art piano-roll visualiser — instrument colours and switchable scrolling**
- [x] **9. Long-form structure — the energy arc**
- [x] **10. Rests and phrasing**
- [x] **11a. Ties over the barline**
- [x] **11b. Anacrusis and empty bars**
- [x] **12. Instrument voices** *(now including a sampled piano)*
- [x] **13. Voice changes driven by the arrangement**
- [ ] **14. The turntable — draggable vinyl that really scrubs**
- [x] **15. More bass voices**
- [x] **16. Radio mode — tracks that segue**
- [x] **31. A "new track" button**
- [x] **17. Generated tune names**
- [ ] **18. Save the current tune — WAV download**
- [ ] **19. Notation of the current tune** *(backlog)*
- [x] **20. Sampled whistle and harp** *(fiddle still synthesised — no CC0 violin found)*
- [ ] **21. More styles, slowed + reverb type music, trance, minimalism**
- [ ] **22. Animated DJ that actually controls the mix, tempo etc**
- [ ] **30. Liking a track, and learning from it**
- [x] **23. Piano for chords, with an auto mode**
- [x] **24. Ending a set — wind down, leave space, let the crackle run**
- [x] **25. Moving between keys, through a pivot chord**
- [x] **26. Phrasing — the melody plays rather than executes**
- [x] **27. Variety in the counter line**

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

**Comping.** One figure every bar — a hit on the downbeat and a stab halfway — is a sequencer, not a player. There are now seven backings, one chosen per part: `sustain`, `stab`, `offbeat` (leaving the downbeat to the bass), `bouzouki` (driving quavers, the backing behind a session tune), `boomChuck`, `anticipate` (pushing into the next bar so the change arrives early) and `suspension` — a sus4 landing first and resolving to the third halfway through, which is deeply Celtic and costs nothing. The resolution is free: voice leading moves the fourth down to the third by a step because that is the nearest tone.

**Harmonic rhythm.** The A part often holds each chord for two bars while the B part moves every bar, so the turn speeds up as it goes. Changing the *rate* of harmonic change is a structural device the piece had none of. A chord held across bars is struck once at its start, and a progression of six chords or more is forced to move every bar — the canon is eight chords across eight bars and would otherwise never finish.

**Still to do:** inversions chosen specifically for smooth bass motion. Voice leading already keeps the upper parts close; the bass still takes the root every time.

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

## 16. Radio mode — done

**The problem was worse than "no radio".** The motifs were rebuilt every turn, so the tune changed every thirty-two bars and never settled — there was no track to recognise in the first place.

A track now holds its material for **two to four turns**, which is a tune played several times through, exactly as a set does. Everything else keeps moving underneath: the arrangement, the energy arc, the voices, the counter textures. Each track also sits a few beats either side of where the tempo knob is set, so a set does not run at one speed all night — the knob became the centre a track varies around, as density and counter already had.

Set endings are now tied to track boundaries. One mid-track would cut a tune off rather than finish it.

Verified across four tracks: the motif was identical within every track and different across all of them, with tempos of 75, 72, 68 and 70 around a knob set to 72, and no scheduling failures.

### Original notes

Right now this plays one endless tune: the motifs rebuild every 32 bars, but the key, mode and tempo never change, so it is one piece forever. Radio mode makes each tune a **track** — a fixed set of key, mode, tempo, motifs, voices and bass patterns, held for three or four turns, perhaps five minutes — with the next one lined up and segued into.

**The good news: the transition machinery already exists.** Empty bars and staged entrances were built for phrasing, and they are exactly how a lofi segue works. End the outgoing track on a drop, start the incoming one bare. No crossfade, no second engine, no doubled CPU — and Tone has only one Transport, so running two tracks at once would be the hard way to do this.

Two things need care:

- **Key relationship.** A jump to an unrelated key sounds like someone changed station. The next key should come from a pivot set — the relative major or minor, or up a fourth or fifth — so the move reads as a modulation rather than an edit. Better still, end the outgoing track on a chord the two keys share and simply continue into it.
- **Tempo.** Tracks want different tempos, but a jump is jarring. `Transport.bpm.rampTo` over a bar or two carries it, and a slight rallentando into the drop would sound deliberate.

## 17. Generated tune names — done

Wistful, longing titles: *thinking of you here*, *why can't it rain every day*.

**The wrinkle is that this is a static site, so it cannot hold an API key.** Anything shipped to the browser is readable, so a live LLM call would either expose a key or require a server — which would undo the fact that this whole thing is a folder of files on GitHub Pages.

Three routes, and the third is clearly best:

1. **A local grammar** — word banks and templates. Free, instant, offline, but the seams show after a dozen titles.
2. **Live LLM** — best variety, but needs a proxy server or asks each listener for their own key.
3. **Pre-generated at build time.** An LLM writes several hundred titles once; they ship as a JSON file; the app picks one per track. The quality of an LLM, none of the runtime cost, no key anywhere. Regenerate the pool whenever it starts to feel familiar.

**As built.** A pool of 256 complete, pre-generated titles ships in `src/data/track-titles.json`. There is no runtime text generation or API call. Each listening session shuffles the full pool, uses every name before repeating, and avoids a repeat at the join between pools. Title selection uses its own randomness so it does not change the musical choices.

A track owns its title for its whole lifetime, including repeated turns and arrangement changes. A new track gets a new title whether it arrives naturally or through a skip. The panel's now-playing area and browser tab update at the audible start, with a track number beside the title. Stopping clears the display but keeps the remaining title pool for the next start.

Browser checks cover title stability across turns, natural track boundaries, skips, and stopping before a queued display update.

## 18. Save the current tune

Export what is playing, with **Ger McAuley** and this repository credited as composer.

**This shares its foundation with the turntable.** Both need the master captured into a rolling buffer, so building item 14's capture worklet delivers most of this one for free. Build the capture once.

From a captured buffer, two output routes:

- **WAV** with a `LIST`/`INFO` chunk carrying artist and composer. No dependencies, but tag support is thin and not every player reads it.
- **MP3** with proper ID3 tags via an encoder such as `lamejs`. Better metadata, at the cost of a dependency and encoding time.

Feature **34** now supplies a versioned recipe, random seed, complete score and revision history. Audio export should embed or accompany that data. A seed alone is insufficient: generation also depends on the recipe parameters and composer version.

## 19. Notation of the current tune — backlog

The generator already works in scale degrees and MIDI, so it holds everything notation needs. The question is only which format.

**The deliverable is a stave on screen** — the tune as written music, for whatever is playing right now. Not a text format for its own sake.

Two ways to get there. `abcjs` takes ABC and renders it as ordinary notation in the browser, so ABC would be an internal representation rather than the output; that route also gives a copyable ABC string for free, which is how Irish tunes are shared. Or VexFlow draws staves directly from note data, skipping the intermediate format entirely.

Either works. The choice only matters if a copyable text form is wanted alongside the picture. MusicXML remains worth adding later for anyone importing into MuseScore or Sibelius.

Feature **34** now defines the current tune as a complete stored score, with explicit revisions for live musical edits. Notation can use that snapshot and distinguish the current turn from the complete track.

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

## 15. More bass voices — done

Four voices, chosen by hand or by the arrangement: **`round`** (the original triangle), **`upright`** — pizzicato double bass, a fast filter sweep for the finger against the string and almost no sustain for the short woody decay — **`sub`**, near a pure sine and felt more than heard, and **`electric`**, fingered, with more sustain and a brighter edge so it carries through a busier arrangement.

In `auto` the bass changes **least often of the three voices** — a quarter of the times the lead does. It is the foundation, and a foundation that keeps changing is not one.

Upright remains a sampling candidate; a plucked double bass has a body resonance that a filter sweep only gestures at.

### Original note

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

## 9. Long-form structure — done

Every turn had roughly the same intensity, so a piece that ran for twenty minutes never went anywhere. Holding one level forever is the long-form version of the random walk problem: nothing is stated, so nothing develops.

**A stated arc, not a drift.** Over six to eleven turns — roughly ten to twenty minutes, the scale at which a listener notices a piece going somewhere — energy follows one of four shapes: `swell` (rise to a peak two thirds through, then away), `build` (climb and end at the top), `ebb` (begin high and recede) and `plateau` (rise, hold, release). When one finishes another is planned.

**It scales the knobs rather than overriding them.** A density of 0.5 becomes a journey between roughly 0.3 and 0.7 instead of sitting at 0.5 forever, and at arc depth zero nothing moves and every knob means exactly what it says. An `arc` knob sets how far it is allowed to swing.

**And it reaches the arrangement, not only the levels.** A quiet stretch should be quiet because parts are *absent*, not merely turned down. Low energy makes a turn likelier to open with the tune alone, lets the drums sit out a whole part, and draws backings and bass patterns from the calm end — `sustain`, `stab`, `held`, `sparse`. High energy draws from the driving end — `bouzouki`, `boomChuck`, `walk`, `octave` — and the drums are always present.

**Energy never reaches zero.** At the bottom the drums would sit out three parts in four; a trough should be sparse, not absent. The floor is 0.12, which still gives 65% of parts without drums at the very bottom against 0% at the peak.

The `swell` shape is written as two quarter-waves rather than one sine, because a single sine scaled to peak at two thirds flattens to nothing early and stays there for the last three turns.

**Modal shift** is in too: about one turn in ten keeps the tonic and changes only the mode. Nothing moves and everything recolours, which makes it the least disruptive structural move available without ending the tune.

Verified live across eleven turns: a swell finishing 0.99 → 0.69 → 0.12, an ebb descending 1.0 → 0.82 → 0.65 → 0.47 → 0.30 → 0.12, a build starting up again, with density tracking from 0.63 at the peak to 0.41 at the trough, and no scheduling failures.

---

## Known limitation

A few famous progressions need chords from *outside* the mode. The Andalusian cadence (i–♭VII–♭VI–**V**) needs a major V in a minor key, which requires a raised seventh that natural minor does not contain. `buildChord` derives everything from scale degrees and cannot currently produce an accidental. Supporting these means adding explicit chromatic alteration or a mode-mixture mechanism — a change to the theory layer, not a table entry.

---

## 24. Ending a set — done

Occasionally the tune should stop rather than roll on forever: a DJ finishing a set rather than beat-matching another record.

**How it runs.** In the last part of a turn, the arrangement sheds a layer at a time — drums from bar 5, bass and counter from bar 6, everything but the tune at bar 7 — while the tempo eases to 82% over four bars. The melody lands on its cadence, then **two to four bars of nothing but surface noise** before the next tune begins.

**Kept rare, and never back to back.** At least four turns must pass, and then it is a 30% chance — so roughly one set ending every seven or eight turns, which at 32 bars a turn is several minutes apart. The effect only works if it is not expected; a generative piece that keeps pausing is worse than one that never does.

The bar count keeps running through the pause so the transport never stops. A `formOffset` holds the form in place, so the next tune starts at the beginning of a part rather than wherever the bar count happened to land.

Verified end to end: wind-down, two bars of crackle alone, key moved, form rebuilt, tempo restored, no scheduling failures.

## 25. Moving between keys — done

**Four moves.** The **relative** major or minor and a **fifth** either way share nearly every note with where we are. **Up a tone** is the lift a trad set uses. **Modal interchange** keeps the tonic and changes only the mode — nothing moves, everything recolours, and it is the subtlest of the four.

**And a pivot to carry it.** A modulation across silence is an edit; a modulation through a chord belonging to *both* keys happens inside the music. The ear hears the chord in the old key and then finds it has been in the new one all along.

`findPivot` compares the diatonic triads of both keys and returns one they share — triads rather than sevenths, because a seventh is far less likely to be common and a pivot only works if the chord genuinely belongs to both. The outgoing tonic is rejected: it is the least ambiguous chord there is, and ambiguity is the mechanism. Where two keys are strong in the arriving key — its fourth or fifth — those are preferred, because they set up the new tonic.

Across all 92 key and mode pairs the move set can produce, **63% have a pivot**; the rest fall back to a plain change, which is why the pivot is optional rather than required. Zero pivots were wrong — every one's notes belong to both keys.

**Two places it happens.** At a set ending, the target is chosen as the wind-down begins so the last bars can lean on the shared chord. And occasionally — 12%, and never straight after a set ending — a tune **modulates without stopping**: the pivot lands on the turn's final bar and the new key begins on the next one.

That answers the open question: it does both. A modulation nobody was expecting should be a surprise rather than a habit, so the mid-flight one is rarer than the set ending.

One ordering trap worth recording: the key must be applied **before** the form is built. Otherwise the phrases are written for the key being left and then played in the one just arrived at.

Verified live: E♭ mixolydian to F mixolydian, up a tone, carried by a C minor pivot — vi in the old key, v in the new. Arrived exactly where planned, with no scheduling failures.

### Still open

- **Chromatic mediants** (C to A♭). Cinematic rather than folk. Probably wrong here, but striking, and the pivot machinery would find no shared chord so it would land as a hard change — which may be the point.

---

## 26. Phrasing — done

The melodies were robotic, and there was a specific culprit: **velocity was `0.26 + random() * 0.16`, rolled fresh per note.** That is the same mistake as the old pitch random walk, one layer down. Random dynamics are not phrasing — a listener hears them as a machine that cannot decide how hard to hit anything.

Phrasing is *shape*, and all of it is derivable from structure already present, so none of it is guesswork:

- **A dynamic arch per sentence**, cresting around two thirds through rather than in the middle, which is where a sung phrase puts its weight.
- **The peak note of each sentence is emphasised** — it is what the phrase is aiming at.
- **Metrical weight**: the downbeat carries, the offbeats give way.
- **The cadence eases off** — the closing note is the softest thing in the sentence.
- **Articulation from the interval to the next note**: a step is slurred so the notes run together, a leap is separated. This is how a wind or bowed player actually phrases.
- **A breath before each sentence**, about 22 ms.

Measured over 7,910 notes: dynamics span **0.38 to 1.15**, the sentence peak averages **0.99**, the closing note **0.43**, and the shape runs 0.73 → 0.78 → 0.45 across each sentence. 49% of notes are slurred, 28% lifted. Live, the lead produced 44 distinct velocities across 47 notes where it used to produce noise.

## 27. Variety in the counter line — done

Same fault, and the same fix, plus the point that one fixed feel every phrase is what makes an accompaniment mechanical. It is not that any one feel is wrong; it is that hearing only one is.

**Four figuration feels**, chosen per phrase: `even` (a note per quaver), `sparse` (half as many, leaving the melody more room), `double` (semiquaver pairs, so the figure runs) and `pulsed` (quavers with every other one much lighter, which swings it).

The figure also sits **an octave up** a quarter of the time, which changes its role from foundation to decoration without changing a note of it. Its velocity follows an arch across the bar rather than sitting flat.

And the two echo textures — imitation and heterophony — now **carry the melody's own phrasing**, dynamics and slurs included. An echo that ignored the shape of what it was echoing would give the game away immediately.

---

## 28. Harmony aligned to the form — done

The chord cycle was indexed off the **absolute bar count** — `barIndex % chords.length` — so it drifted out of step with the structure. The pause between tunes advanced the count but not the music, which meant a tune could resume on its subdominant rather than at home, and with a three-chord progression the harmony rotated against the eight-bar parts and only realigned every 24 bars.

None of that was chosen. It is now indexed against **position within the part**, so every part opens on the progression's first chord regardless of how many bars have gone by.

Verified across a set ending: at absolute bar 34, after a rest of irregular length, part 0 still opened on chord one. Under the old indexing that bar would have started on the third chord of a four-chord progression.

## 29. The pop and rock canon — done

The table had the headline four-chord loops but was missing several very common progressions, most glaringly **I–IV–V** — the three-chord backbone of most rock ever written.

Added: `I-IV-V`, `I-V-IV`, `I-vi-ii-V` (doo-wop's other half, and the front of rhythm changes), `vi-ii-V-I` (round the circle and home), `I-iii-vi-IV`, `IV-V-iii-vi` (the "royal road", everywhere in Japanese pop and it lands beautifully under a modal tune), and `canon` — Pachelbel, eight chords, one a bar across an eight-bar part.

Minor gained `i-iv-VII-III`, `i-VI-VII` and `i-VII-VI-v`; dorian `i-VII-i-IV` and `i-III-IV-i`; mixolydian `I-VII-IV-I` and `I-IV-I-VII`.

**34 progressions across the four modes**, up from 20, every chord checked for a valid degree and a known quality.

### Still missing, and why

- **12-bar blues** does not fit an eight-bar part. It would need the harmonic rhythm work in item 8 first.
- **The Andalusian cadence** (i–♭VII–♭VI–V) needs a major V in a minor key, which means a raised seventh that natural minor does not contain. That is the chromatic-alteration limitation recorded at the end of this file, still open.

---

## 30. Liking a track, and learning from it

A like button, and generation that leans toward what gets liked.

**The learning part is tractable, because the parameters are already known.** A track is a small vector — key, mode, tempo, progression, motif shape, arc shape, voices, counter texture, comping pattern. A like is a labelled example. With enough of them the weighted picks throughout the generator could be biased toward combinations that get liked, which is a nudge to existing probabilities rather than a model.

**The wrinkle is where the likes go.** This is a static site with no backend, which is the property that makes it a folder of files on Pages. Three options:

1. **`localStorage`** — learns per listener, on their own machine. Honest, private, works today, and gets better the longer one person listens. It does not aggregate.
2. **A backend** — aggregates across everyone and genuinely learns what *people* like rather than what one person likes. It also ends the no-server property, needs hosting, and puts you in charge of other people's data.
3. **Export the likes** — a listener can download their liked tracks as JSON and send it on. No infrastructure, no privacy questions, and it works for gathering a first dataset before deciding whether option 2 is worth it.

Worth starting with 1, since a listener hearing the machine drift toward their taste over an evening is the interesting half, and it needs nothing. Option 3 is a small addition on top and answers "what do people like" without a server.

**Note the honest limit:** liking a *track* labels every parameter it had, most of which were not why you liked it. Dozens of likes are needed before the signal separates from the noise, and with one listener that is a long evening. Liking specific *moments* — this texture, this progression — would learn far faster from far fewer clicks, and is probably the better design.

Pairs naturally with item 17: a track with a name is much easier to like than one without.

---

## 31. A "new track" button — done

Abandons the current track and starts a fresh one.

**The skip no longer waits for a bar boundary.** The outgoing instruments fade over 40 ms and a fresh first bar starts 60 ms after the audio scheduling time. All voices, including percussion and vinyl pops, get fresh scheduling timelines: moving the transport alone left old notes queued and caused Tone.js errors. The small sample library is decoded and cached before playback, so skipping needs no network request. Skipping also interrupts the pause between sets.

Half the time the new track arrives in a new key, chosen from the same four moves as a set ending. Deliberately **without a pivot**: a skip is a cut, and smoothing the seam would be papering over the thing the listener just asked for.

Everything else resets with it — motifs, arrangement, voicing, any modulation that was in flight — while the long energy arc carries on, since that is a separate dimension from which tune is playing.


### Track character and voice selection

All three instrument rows now default to `auto` and choose fresh voices when a track starts. Choosing a voice manually pins that row. A dot marks the voice currently playing in auto mode. Independent loading per row prevents a bass choice from cancelling a sampled lead or keys choice.

Tracks also vary tempo, swing, cuts, drone, counter, brightness, dust, wobble, drive, space and pump around the listener's knob positions. The `arc` control scales this variation and the long energy arc; at zero the knob values are exact. Output level is never randomised.

Browser regression tests cover rapid skips, skipping during a set rest, stop/restart, independent voice loads and preserving knob settings. Fresh instrument banks dispose all their owned effects as well as their voices, so repeated skips do not leave chorus or filter nodes running.


### Near-unique tracks — done

New tracks are now screened against recent musical material, independently of titles, keys, timbres and floating-point effect settings. Those alone cannot make a familiar melody feel new.

- Remember the last 128 motif pairs in this browser, including across reloads where local storage is available.
- Reject repeated pairs even when A/B are swapped or pitches transposed.
- Avoid the same rhythm-and-contour pair from the last 32 tracks, reused opening motifs from the last eight, and repeated pairs of rhythm cells from the last four.
- Give each track a fresh opening chord progression and retain the existing per-track voice and parameter variation.

Candidates still come from the existing folk-melody grammar. Selection is limited to 64 candidates; if none clear every check, the least repetitive valid candidate wins, so the skip cannot stall. This reduces recent resemblance rather than guaranteeing perceptual uniqueness forever or against music outside this browser's history.

In a seeded comparison of 2,000 generated tracks, recent opening reuse fell from 49 occurrences to zero; repeated motif pairs fell from one to zero. Tests also cover transposition, swapped sections, similar contours, history across reloads, unavailable storage and a stalled random source.

Rapid-skip coverage also exposed a clock stall when multiple settings updates repeatedly replaced the same tempo ramp. Tempo changes now share one scheduling path: unchanged targets do not restart ramps, and a skip sets the new tempo at the cut before restarting playback.


## 32. Varied openings and recognizable returns — done

The opening audit found low-end audio in all 12 sampled starts: even a bare arrangement called the drone unconditionally. None of those tracks repeated a complete A phrase exactly; only their underlying motif was retained.

- Rotate through five entrances: melody alone, chords first, melody with offbeat backing, light percussion without kick, and the full band. Each appears once per shuffled bag, with no adjacent repeat at the seam.
- Schedule bass, drone, kick, chords, lead and counter entrances explicitly. Bass can arrive after two or four bars. The intro is used only on the first turn.
- Mix AABA tunes, ABAB riffs, traditional AABB and freer evolving AABB tracks. Three styles retain the complete phrases across turns; the fourth keeps developing them.
- Riffs state the same cell three times, then answer with a cadence. Structured tracks retain their progression and lead colour, so changes in backing do not erase the tune's identity. Explicit key/mode changes still work.
- Delayed lead entrances introduce the first four-bar question, then the following section carries the music onward.

Browser checks observe instrument scheduling through real starts and skips; phrase checks cover recurrence across turns and riff timing. These verify the arrangement rules, while the musical feel still needs listening feedback.

## 33. Pixel-art piano-roll visualiser

Visualise each generated track inside the player as a colourful, scrolling piano roll with an 8-bit or 16-bit game aesthetic. The listener can switch between horizontal and vertical layouts during playback.

**What the engine already knows.** Pitched parts are composed as scale degrees, converted to MIDI note numbers, then scheduled through Tone.js as note names with duration, time and velocity. The app does not currently create a MIDI file or maintain a complete MIDI sequence for the track. Drum hits are scheduled events too; noise-based percussion, vinyl hiss, effects and reverb are not pitched MIDI notes. We can build this directly from the note events without audio-to-MIDI transcription or ML.

### Player experience

- **Horizontal:** time runs left to right, pitch runs bottom to top. Follow playback with a visible playhead and a scrolling note field.
- **Vertical:** rotate the musical layout so time runs vertically and pitch runs left to right, like a falling-note game. A horizontal/vertical toggle preserves the current musical position and remembers the listener's preference.
- **Instrument colours:** distinct, stable colours for lead, keys, bass, counter line and drone. Keep colours tied to musical roles when automatic voice changes occur; the legend names the current instrument. Give percussion labelled lanes of its own so a snare is not mistaken for a pitched note.
- **Musical detail:** block length represents note duration, position represents pitch, and a restrained brightness change reflects velocity. Highlight sounding notes at the playhead. Show chords as stacked blocks, ornaments as small blocks, rests as space, and section/bar markers to reveal hooks and returns.
- **Pixel-art treatment:** crisp rectangular notes, a limited game-like palette, pixel-grid details and small instrument sprites or icons. Begin with a readable 16-bit-inspired look; an 8-bit palette can be a later appearance option. This changes the visuals only, with no required change to the audio.
- **Readable in the player:** responsive layout, a compact colour legend, optional instrument visibility, and a reduced-motion/static view. Labels and shapes support the colours so they are not the sole way to identify parts.

### Implementation path

1. **Expose the events that are actually scheduled.** Introduce a shared note-event boundary for audio and visuals, carrying track identity, instrument role/voice, final pitch or percussion lane, audio start time, duration and velocity. Capture after chord fitting, ornaments and humanisation so the display follows the performed notes. Stop and skip must invalidate cancelled future events.
2. **Render the live rolling view.** Use a bounded event buffer and a canvas renderer driven by the audio clock. Use the complete score from **34** for future-note previews and track layout. Use actual scheduled audio times for the playhead and performed notes; live revisions replace only the upcoming part of the score. Keep rendering separate from sound scheduling and pause drawing when hidden.
3. **Add the orientation toggle and pixel styling.** Both layouts use the same events and playhead. Resizing or changing direction must preserve playback, colour assignments and position.
4. **Connect the future composition plan.** Whole tracks now have a stored score through **34**; use it for a complete-track overview and longer previews. The same event representation can support MIDI export and notation; recorded audio remains the source for an exact WAV including effects and tails.

**Acceptance checks:** visible notes match the scheduled pitches and entrances; muted/absent parts produce no invented notes; percussion occupies its own lanes; track changes clear outgoing queued notes; stop freezes or clears consistently; direction changes do not restart audio; both layouts remain usable on mobile. Verify clock alignment through tempo changes and ensure rendering does not cause audible glitches.


## 34. Complete composition plans, reproducible scores and replay — done

Priority 1 separates writing a track from playing it. Before its first bar sounds, the composer writes all 64–128 bars: section order, phrases, harmony, arrangement, planned voices, energy changes, percussion, ornaments and note timings. The same folk grammar, varied openings and recent-material screening remain in use.

- **Pure composer:** `composeTrack(recipe)` requires no Web Audio context, wall clock, local storage or global random state. A versioned recipe records the seed and all inputs. Repeating it produces the same score.
- **Stored events:** each bar has ordered note events with instrument role, MIDI pitch where applicable, onset and duration in beats, and velocity. Percussion roles remain identifiable separately from pitched instruments. Continuous hiss and effect tails are audio processes rather than score notes.
- **Playback adapter:** the engine schedules those stored events onto its existing instruments. It does not redraw the melody, percussion or ornamentation while playing. Timing follows the live transport tempo; kick ducking uses the kick's actual scheduled onset.
- **Live edits:** key, mode and note-related controls rewrite the upcoming bars at the next bar boundary. Played bars remain intact. The recipe plus saved revision history reconstructs the revised score.
- **Player controls:** “replay tune” restarts the current composition, including after stopping; “save score” downloads its JSON. The player shows bar count, section order, turn count and whether the score has been edited.

Replay retains current sound and tempo controls, including manually pinned instruments. This is reproducible composition, not a promise of byte-identical audio: synthesis noise, continuous vinyl, effect tails and live mix changes are outside the note score. JSON score import, WAV/MIDI/stem export and section editing remain future work under priority 5. The visualiser remains feature **33**.

Validation covers deterministic generation, all four modes and supported track lengths, event ordering and pitch bounds, reconstruction after edits, the audio adapter's exact note scheduling, browser replay/save/stop behaviour, and the existing playback regressions.
