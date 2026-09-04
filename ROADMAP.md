# Lofi Ceoil — roadmap

How to make the music more interesting without making it random.

## The principle

**Interest is not the opposite of predictability — randomness is.** A random walk has maximum entropy and near-zero interest, which is why most generative music toys sound like noodling. Music gets interesting through *expectation and deviation*: state a pattern, then bend it.

Four techniques let us add variety without risk. Everything below is an application of one of them.

1. **Vetted vocabularies** — sample from hand-authored cells (rhythms, cadences, motif operations), never from a continuous range.
2. **Derivation over generation** — new material is a transformation of material already accepted.
3. **Constraint plus rejection** — generate, test against music rules, retry on failure.
4. **Weighted transitions** — interval probability tables reflecting folk practice, so common moves stay common. These are no longer guessed: they are measured from 55,246 real tunes, including what tends to follow what. See **47** and **59**.

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

- [x] **1. Chord voice leading**
- [x] **2. Per-mode progression sets**
- [x] **3. Motif and development**
- [x] **4. Chord-aware melody**
- [x] **5. Cadences and question/answer**
- [x] **6. Counter-line textures**
- [x] **7. Eight-bar parts with a higher turn**
- [x] **8. Bass patterns and staged entrances** *(partly done)*
- [x] **9. Long-form structure**
- [x] **10. Rests and phrasing**
- [x] **11a. Ties over the barline**
- [x] **11b. Anacrusis and empty bars**
- [x] **12. Instrument voices**
- [x] **13. Voice changes driven by the arrangement**
- [ ] **14. The turntable — draggable vinyl that really scrubs**
- [x] **15. More bass voices**
- [x] **16. Radio mode**
- [x] **17. Generated tune names**
- [ ] **18. Save the current tune**
- [ ] **19. Notation of the current tune** *(backlog)*
- [x] **20. Sampled whistle and harp**
- [ ] **21. More styles — slowed and reverb, trance, minimalism**
- [ ] **22. An animated DJ that controls the mix**
- [x] **23. Piano for chords, with an auto mode**
- [x] **24. Ending a set**
- [x] **25. Moving between keys**
- [x] **26. Phrasing**
- [x] **27. Variety in the counter line**
- [x] **28. Harmony aligned to the form**
- [x] **29. The pop and rock canon**
- [ ] **30. Liking a track, and learning from it**
- [x] **31. A "new track" button**
- [x] **32. Varied openings and recognizable returns**
- [ ] **33. Pixel-art piano-roll visualiser**
- [x] **34. Complete composition plans, reproducible scores and replay**
- [x] **35. A random opening key**
- [x] **36. Levelling the voices**
- [x] **37. Kalimba replaces the whistle**
- [x] **38. The supporting line**
- [x] **39. Replay should queue, not interrupt**
- [ ] **40. Irish forms with a hip-hop backing** *(6/8 first pass done)*
- [x] **41. Filter sweeps across a section boundary**
- [ ] **42. More of the effects palette**
- [x] **43. Mix corrections**
- [ ] **44. The piano roll** *(built, currently hidden)*
- [x] **45. New lead voices**
- [x] **46. Tempo actually varies per tune**
- [x] **47. Vinyl surface — hiss, crackle, pops and scuffs**
- [x] **48. Track timer**
- [x] **49. Track titles as Gaeilge, with English translations**
- [x] **50. Hook development across turns — first pass**
- [x] **51. Bass and kick coordination — first pass**
- [x] **52. Chords leave space for the melody — first pass**
- [x] **53. Short transition fills**
- [x] **54. Arpeggiated chord accompaniment**
- [x] **55. Sampled nylon-string guitar**
- [x] **56. 6/8 jig feel — first pass**
- [~] **57. Learn from a corpus of real tunes** *(melody done; harmony still open)*
- [x] **58. Two traditions: Irish and pop/rock** — *built, then rejected*
- [x] **59. A melodic grammar measured from the repertoire**
- [x] **60. Cadence targets, and the notes the pool leaves out**
- [x] **62. Ornamentation as a real layer — cuts, taps, rolls and crans**
- [ ] **61. Dungeon synth — a side project off this engine**
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

---

## 43. Mix corrections — done

Three complaints after a long listen, all of them regressions from recent work.

**The drums disappeared for minutes.** The energy arc set `drumsFrom` to "never" when `random() > 0.25 + energy * 0.8`, which at the trough is **65% of parts**. Four parts a turn and tracks lasting several turns meant the beat could be gone for minutes on end. A sit-out is an effect; the arc had made it the norm.

The threshold moved to `0.55 + energy * 0.45`, reducing how often the arrangement requests a drumless part. The first continuity check worked only within individual turns; a later audit of complete scores still found gaps of **17 bars** where breaks joined across a turn boundary.

The continuity rule now carries the trailing silence across the whole track, including empty bars and early drum exits. Once the groove starts, a breakdown lasts **at most four bars** before the drums return for the rest of the part. Varied openings and deliberate set endings keep their separate entrance and exit rules. Verified across 150 generated tracks; an 80-seed regression test checks the actual drum events in the scores.

**The bass was too loud.** Each of the four voices had been set at a level that would suit a lead. `round` −11 to −15, `upright` −9 to −13, `electric` −13 to −16, and `sub` from −7 to −17 — a sine in the bottom octave carries far more energy than its number suggests, so it now sits lowest of the four rather than highest.

**The drone was too present.** A sustained sawtooth never stops, so it never stops being noticed. Its voice went from −26 to −34, the default level from 0.25 to 0.14, its per-track variation from ±0.225 to ±0.10, and the velocity it is played at from half to a third.

A later vinyl calibration accidentally changed the drone to −12 dB through a broad text replacement. Restored to −34 dB and covered by a real audio test: at the default playing velocity its isolated RMS returned from about −45 to −67 dBFS.

## 44. The piano roll — hidden for now

Left in place and fully wired; the section simply carries `hidden`. Removing that attribute brings it back without touching anything else.

---

## 45. New lead voices — done

The fiddle and whistle leads were not liked, and both were the synthesised ones. That is the same line the piano ran into: an oscillator can suggest a *struck* or *plucked* string, because the interesting part is the decay, but a **bowed or blown** instrument gives itself away immediately — the sound is continuous, so there is nowhere for the imitation to hide.

Both are removed. In their place, two more CC0 instruments from VCSL:

- **Vibraphone**, soft mallets — the signature lofi mallet sound, and exactly the case for sampling: the shimmer of the metal bar and its long unforced decay are not things an oscillator arrives at.
- **Marimba** — wooden and dry where the vibraphone is metallic and ringing, so the two do not compete for the same job.

The lead is now `vibraphone`, `marimba`, `piano`, `harp`, `harp (synth)` and `whistle` — five sampled instruments and one synth kept deliberately, because its Karplus-Strong character is a different instrument rather than a worse one.

VCSL's octave convention was verified again by spectrum for both: a file named `C3` in the vibraphone folder sounds 261.8 Hz, MIDI 60, which is scientific C4. Same one-octave offset as the harp and recorder, so each sample is filed under the note it actually sounds.

One download trap worth recording: two vibraphone notes exist only as `rr2` takes, and the fallback for a missing `rr1` tested whether the downloaded file was *non-empty* — which a 404 body is. Fetching by HTTP status rather than file size fixed it, and every sample is now checked with `ffprobe` before use.

### Still open

An intermittent `Start time must be strictly greater than previous start time` was seen twice during rapid voice swapping and could not be reproduced afterwards under deliberate stress — six swaps interleaved with skips produced none. It is the same monophonic-voice ordering family as the two bugs already fixed in the drums and the vinyl pops. Not chased further because it will not reproduce; worth catching if it recurs.

## 35. A random opening key — done

Every session began in C dorian, which made the machine sound like it had one tune in it before a note was played.

The key is now drawn from all twelve. The **mode is weighted rather than uniform** — dorian 43%, minor 29%, mixolydian 15%, major 14% — because dorian and minor are where this music lives, and a flat quarter-share each would have made major the opening one time in four.

The panel reads its initial selection from the engine rather than asserting C, or the buttons would disagree with what is playing from the first bar.

---

## 36. Levelling the voices — done

The voices were badly out of balance, and the cause was underneath the code: **the sample files themselves were recorded at wildly different levels**. Measured peaks per set — piano −10 dBFS, harp −15, recorder −27, vibraphone −34, marimba −39. A 30 dB spread between instruments, and up to **17 dB within one instrument** — the recorder's own notes varied that much between each other.

No amount of tuning `volume` numbers fixes that, because the within-set variation would remain. Every sample is now **peak-normalised to −6 dBFS**, which brought every set flat to within 0.2 dB. With the files equal, the `volume` settings can do purely musical balancing, and sampled voices at the same number now produce the same level by construction.

A note on method: the first three attempts at measuring this chased noise. `getLevel()` is a *smoothed* RMS sampled on animation frames, and the energy arc moves the filter and dust between runs, so nothing was comparable. Pinning the tape path and reading true peak from a dedicated analyser gave stable numbers — and showed the spread was 23 dB, not the 8 dB the first measurement suggested.

## 37. Kalimba replaces the whistle — done

The recorder was only ever a stand-in for a tin whistle nobody has sampled under CC0, and it did not convince. **Kalimba** takes its place: plucked metal tines, warm and naturally a little detuned, and one of the most recognisable lofi timbres. It spans the melody's range properly, where the recorder sat awkwardly above it.

## 38. The supporting line — done

A second voice that does the opposite of the counter line. Where the counter fills the tune's *rests*, this lands **on** the notes that matter and is silent everywhere else — a highlight on someone else's phrase rather than an answer to it.

It takes its moments from the phrasing already computed: the note a sentence is aiming at, and the note it comes to rest on. So it never has to guess what is worth supporting. It doubles a third above where the chord allows and the octave otherwise, which is the plainest harmony available and the least likely to fight the tune.

**Glockenspiel** carries it by default. Its lowest sample already sounds well above where the tune sits, so it can only ever decorate — which is the point. A `support` knob sets how often it appears; measured over 128 bars it played 46 notes against the lead's 426, about one in nine.

Two traps, both silent. The composition layer *records* notes rather than sounding them, and registers recorder stubs for a fixed list of roles — a part not on that list writes into nothing. And Codex's refactor changed the helper signatures to take state first for the injectable RNG, so calling the old `chance (p)` compared against `undefined` and was **always false**, with no error to show for it.

Saved recipes also gained a compatibility fix: a setting that did not exist when a score was saved now defaults instead of producing `NaN`, which JSON writes as `null` and which would have made older saved scores come back subtly broken.

---

## 39. Replay should queue, not interrupt — done

"Replay tune" restarts immediately. It should **line up** — finish the tune that is playing and repeat from its start — the way a repeat is a musical instruction rather than a rewind.

Implemented as a single queued repeat. During playback, the button snapshots the current score and highlights a **repeat-once icon**, with a tooltip and accessible label explaining how to cancel. It leaves the transport and scheduled notes alone, waits through the remaining turns and any set-ending rest, then replays that score from bar one. The queue clears when consumed, so new tracks resume after the repeat.

A second press cancels. **New track** and **Stop** also clear the queue. While stopped, **Replay tune** starts the last saved score immediately. Replay preserves the notes and arrangement captured when queued; current sound and tempo controls still apply. Browser tests cover track boundaries, cancellation, skips, stops and set rests.

## 40. Irish forms with a hip-hop backing

**6/8 and 3/4** as well as 4/4, and the dance forms that live there: **jigs** (6/8), **slip jigs** (9/8), **reels** (4/4 driving), **polkas** (2/4), **hornpipes** (dotted 4/4). Each has its own rhythmic cell and its own melodic habits, so this reaches the rhythm vocabulary and the motif grammar, not only the time signature.

Underneath them, a **hip-hop drum and bass backing** — which is exactly the collision the project is named for. The first 6/8 pass is implemented in item 56. Other meters and more specialised dance-form vocabularies remain open.

## 41. Filter sweeps across a section boundary — done

A slow filter creep that builds or releases tension into the next section — the cutoff moving gradually across several bars so the arrival is *prepared* rather than merely happening.

The arc already moves brightness, but it moves it *within* a section and at the pace of turns. This is a different gesture: aimed at a boundary, timed to land on it, and steeper.

**As built.** Two gestures. `rise` climbs a highpass from 20 Hz to as much as 1 kHz, thinning everything from the bottom up — tension. `fall` closes a lowpass from wide open down towards 600 Hz, darkening from the top down — release. Both are **exponential**, because filter frequency is heard logarithmically and a linear ramp does almost nothing and then everything at once.

The gesture is timed to **finish exactly on the boundary** and then returns to transparent over a fraction of a beat, which is what makes the arrival feel like a release rather than a change that merely happened.

It uses **its own pair of filters**, not the existing `tone`. That one is the brightness knob plus the energy arc and is rewritten whenever any setting changes — a sweep writing to it would be overwritten mid-gesture. The pair sits transparent when unused, so it costs nothing.

Only two boundaries are eligible: the move into the B part, and the end of the turn. A sweep into an arbitrary bar is a filter wobbling; the gesture means something only if what it arrives at is a change. It runs on roughly a third of turns — a build that happens every time builds nothing — and falls rather than rises into a set ending, since that is a release.

Verified: a rise traced 20 → 53 → 199 → 768 Hz and snapped back to 20; a fall traced 20000 → 6229 → 1917 → 710 Hz and returned to 20000.

## 42. More of the effects palette

Delay, phaser, chorus as a send rather than baked into individual voices, and reverb with more than one character. Currently the tape path is fixed: saturation, bitcrush, wobble, lowpass, one reverb. A **tape delay** in particular is close to the genre's centre, and a send-and-return structure would let parts sit at different depths rather than sharing one setting.

## 21. More styles — slowed and reverb, trance, minimalism

Beyond lofi: the same generative machinery pointed at other genres.

The open question is what a "style" actually parameterises. Tempo, swing, the note pools and the effects chain are obvious. Less obvious, and more important: **slowed-and-reverb** wants extreme tempo reduction with a long reverb and no swing, and would suit the stretching work this project originally grew out of. **Trance** wants a fixed 16th-note pulse, long builds and a completely different harmonic rhythm. **Minimalism** wants phase relationships between repeating cells — which the motif machinery could express well, since it already thinks in cells and transformations.

Each is really a preset over the parameters that already exist, plus the one or two that do not. Worth doing after the time-signature work in item 40, since that is the parameter most of them need.

## 22. An animated DJ that controls the mix

A figure on the panel who is visibly doing what the machine is doing — reaching for the filter as it sweeps, riding the fader as a part drops out, cueing the next track.

The value is not decoration. Everything the generator decides is currently invisible unless you read the readout: which texture is playing, where the energy arc has got to, that a set ending is coming. A DJ makes those legible without a single label, because a gesture reads faster than text.

It needs the arrangement to expose its intentions slightly ahead of time — which the composed score already does, since bars are written before they are played.

## 46. Tempo actually varies per tune — done

**Current tempo floor: 74 BPM.** The tempo knob, generated score settings, replay playback and end-of-track slowdown targets all use this minimum. The default base tempo is now 80 BPM, leaving room for variation down to 74 without making neighbouring tracks identical at the floor.

Follow-up: the knob showed only the base tempo, hiding the actual changes, and independent random offsets allowed nearly identical neighbouring tempos. A separate live BPM readout now shows the transport's tempo, including ramps. New tracks choose from offsets of −12 to +12 BPM scaled by drift, with adjacent tempos separated by at least 4 BPM at default drift. Zero drift still uses the exact base tempo; replay keeps the saved offset.

Every tune ran at nearly the same speed. A track did carry its own tempo offset, but the range was four beats either way and it was then multiplied by the drift knob, so the default of 0.5 turned it into **two beats** — not a tempo change anyone notices.

The range is now seven either way. At the default that gives roughly 68 to 76 bpm around a knob set to 72, and at full drift 65 to 79.

The first attempt removed the drift multiplication entirely, on the argument that a tune's tempo is part of its identity like its key. A test rejected it: **at arc 0 every knob must mean exactly what it says**, and that contract is worth more than the argument. Widening the range satisfies both.

## 47. Vinyl surface — done

Completed the vinyl work left in progress: a quiet continuous hiss, fine crackle, duller pops and occasional scuffs. Each transient stream has its own noise voice and filter. The surface joins the music at the limiter, outside the sidechain and tape effects, so the kick does not pump it.

The dust control changes the shared surface level and event density. At zero dust the surface is silent; new instrument banks fade it in after a skip. The default isolated surface measured around −56 dBFS RMS, with individual ticks around −35 dBFS peak in the calibration pass. These measurements establish a restrained starting balance; listening remains the guide for further tuning.

Surface events are generated during playback rather than stored in the musical score. Per-voice scheduling also carries across bars: when a tempo increase catches up with already queued noise, conflicting ticks are omitted instead of scheduling backwards and throwing. Tests cover this transition, default surface level and silence at zero dust.

Queued replay (**39**) is now complete. The piano roll remains hidden (**44**).

## 48. Track timer — done

The current track's elapsed playback time appears in `m:ss` beside its title. It counts from the audible start of each track, resets on a new track or repeat and clears on stop. The audio timeline retains the track's start across tempo changes and score revisions; elapsed time is not estimated from bar count. During a between-track gap, the finished track's time freezes with a **rest** label.

The display catches up from the audio clock after a background tab returns. Timer updates sit outside the title's live region so screen readers do not repeatedly announce the tune. Tests cover changing tempo, future scheduled boundaries, repeats, skips, stop and rests; the layout was checked at mobile width.

## 49. Track titles as Gaeilge, with English translations — done

Give each track an Irish title as the main heading, with its English translation in smaller text directly underneath. Keep both titles paired with the track so they remain consistent through playback, repeat and saved scores.

Use natural, checked Irish phrasing with correct fadas, and translations that preserve the title's meaning and tone. Prefer a curated collection of bilingual titles over assembling unrelated words. Keep the English subtitle legible on small screens and mark each language appropriately for screen readers.

Implemented with a starter deck of 32 paired titles: Irish heading, smaller English subtitle, and language tags. The pair is stored in the score recipe and retained through repeats and JSON downloads. Older English-only scores keep their title without an invented translation. The shuffled deck avoids repeats until exhausted. Reference spot checks: [cois na tine](https://www.teanglann.ie/en/fgb/cois) and [solas na gealaí](https://www.teanglann.ie/en/fuaim/solas_na_geala%C3%AD).

## 50. Hook development across turns — first pass done

Structured tracks establish the original A phrase throughout the first turn. On middle turns, the middle bars answer with neighbouring scale tones while preserving the hook's opening, rhythm and cadences. The existing singability check rejects awkward contours. The final turn restores the original A phrase; contrasting B phrases and intentionally drifting tracks retain their existing behaviour. Two-turn tracks keep a statement and return without forcing an extra development stage.

This is a conservative first step, not the whole musical-development milestone. Flexible section lengths, stronger rhythmic transformations and more deliberate ensemble responses remain open. Composition tests check retained openings, changed middle phrases, final returns and reproducibility.

## 51. Bass and kick coordination — first pass done

After writing each bar, coordinate eligible bass attacks with its actual kick events. A bass attack within half a beat (plus humanisation tolerance) joins the kick, including the offbeat kick near beat three. Pitches, velocities and note counts stay unchanged; durations shorten where needed to leave room for the next bass note. Passing notes are not collapsed onto a shared kick.

Sparse entries and anticipations retain their deliberate independence. Without a kick, the bass keeps its original timing. The same coordination runs for new compositions and revised scores, so saved notes and replay carry the relationship without fresh playback randomness. Existing quieter bass voices and staged openings are preserved.

Next ensemble work: accompaniment that leaves space around the hook, then short fills that announce section changes.

## 52. Chords leave space for the melody — first pass done

Chord attacks sharing a main melody entrance play at 68% of their original velocity; chord attacks underneath a held melody note play at 82%. Rolled chord notes share one adjustment, keeping the voicing balanced. Chords responding in melody rests, chord-only introductions and short melody ornaments retain their original dynamics.

This pass changes dynamics rather than removing harmony: chord pitches, durations, rhythms and note counts are preserved. It runs when writing or revising a score, so replay and exports retain the interaction. Tests cover rolled chords, held melody notes, responses in rests, unchanged introductions and saved-score reproduction. More selective rhythmic accompaniment and transition fills remain future work.

## 53. Short transition fills — done

Occasional two- or three-hit pickups on the final beat before a different section. Two patterns use soft ghost notes with a hat or snare response. Fills keep the kick and backbeat, replacing only late ghost/hat decoration to avoid duplicate noise triggers. They skip repeated sections, busy melody endings, drumless bars and final wind-downs; an eligible transition has a 45% chance of a fill.

Fill decisions and notes are part of the reproducible score, including revisions, replay and export. A 30-track audit found 61 fill bars, all at valid section transitions. Tests cover preserved backbone, per-voice spacing, restrained levels and excluded passages. This completes the first transition-fill pass proposed in items 51 and 52; more selective rhythmic accompaniment remains open.

## 54. Arpeggiated chord accompaniment — done

Rising, falling and alternating patterns play individual tones from the current voice-led chord. They replace the chord accompaniment in at most one inner section per turn, chosen occasionally, and retain the existing instrument. Slow pad sections keep their original articulation. Each bar has up to six soft attacks and a closing rest; prominent melody entrances suppress nearby attacks except the opening harmonic anchor.

Arpeggios continue through held-chord bars without speeding up harmonic changes. Notes, pattern choices and melody gaps are stored in the score for replay and export. Thirteen relevant tests passed; a 30-track audit exercised all three patterns and verified the section limit and held-bar playback.

## 55. Sampled nylon-string guitar — done

Added **guitar** to both lead and chord voice rows and their automatic choices. Ten local nylon-string samples span A2–A5 and share the existing preload/cache and instrument-disposal paths. Lead volume is −10 dB; chord accompaniment is −16 dB with a darker filter and shorter release, suitable for the arpeggio patterns.

Recordings by quartertone, via Nicholaus P. Brosowsky's tonejs-instruments distribution. Attribution, source revision and license references are retained in `public/samples/guitar/ATTRIBUTION.md`. Sample levels were matched to approximately −6 dBFS (encoded peaks −6.6 to −6.3); A3, E4 and A5 pitch labels were spot-checked by autocorrelation. Browser checks verify actual audio from both voices, their relative levels, manual selection surviving skips, and no sample refetching after preload.

## 56. 6/8 jig feel — first pass done

New tracks draw from a shuffled bag of two 4/4 choices and one 6/8 choice. The score summary identifies the meter. In 6/8, tempo counts the dotted-quarter pulse (two pulses per bar), retaining the 74 BPM minimum; stored note times remain quarter-note beats, with three per bar. Older recipes without a meter retain 4/4.

The existing melodic contour is rephrased onto six integer quaver slots, grouped in threes, with rests and phrase-ending cadences retained. This is a first adaptation of the motif grammar, not a complete traditional jig vocabulary. Dedicated chord and bass patterns, six-slot arpeggios, a second-pulse snare, lighter intervening hats and meter-aware fills support that phrasing. Counter-line occupancy and echoes follow the six-slot grid. Straight triplet grouping replaces 4/4 swing for jig tracks.

Playback counts quavers between bar callbacks so skips, natural track boundaries and repeats can change meter. Meter changes update the underlying quarter-note tempo at the boundary. Track timing, note highlighting, vinyl duration and section sweep lengths follow the meter. The piano roll remains hidden as before.

Validation covers reproducible jig scores and revisions across 20 seeds, note bounds for every role, snare placement, phrase returns, playhead endings, and browser playback at both meters with skips and repeat. Further work: native jig-specific motif selection, a manual meter choice, 3/4 and 9/8, and more dance-specific accompaniment.

## 57. Learn the harmony from a corpus of real tunes

Right now every chord progression is hand-written. A corpus would let the
generator weight its choices on what real tunes actually do — which chord
tends to follow which, how often a phrase cadences, where a modal tune
borrows from outside the mode.

**Hooktheory / TheoryTab** is the obvious candidate, and it is the wrong
corpus for this project on two counts.

The first is fit. TheoryTab is Western pop and rock. Its statistics would
pull the harmony toward pop cadences and away from the modal movement —
the flat seventh, the double-tonic shuttle, the absent leading note — that
makes these tunes sound Irish rather than generically pleasant. We would
be spending real effort to make the generator sound less like itself.

The second is licensing. Hooktheory's terms prohibit scraping,
bulk-downloading and redistributing the TheoryTab database. There is a
Trends API exposing next-chord probabilities, but it needs an account, and
baking its numbers into a table in a public repository is arguably
redistributing the derived database. Not a fight worth having for a corpus
we do not want.

**The Session** is the corpus we actually want. Around 50,000 settings of
Irish traditional tunes in ABC notation, with weekly data dumps in CSV,
JSON and SQLite at `github.com/adactio/TheSession-data`. The tunes
themselves are traditional and long out of copyright. The database is
licensed **ODbL**, which asks for an attribution notice and share-alike on
derivative *databases* — a produced work, such as generated audio, carries
the notice but is not itself forced open. That fits a public repository
cleanly.

What we would take from it: chord and interval transition weights per
mode, phrase-length and cadence distributions, and a sense of how often
tunes move between the relative major and minor. Melodic shape is worth
studying but not copying — the motif grammar is the part of this
generator with a voice of its own, and a corpus should inform its
harmonic choices rather than replace its melodic ones.

Open question before starting: derive the tables offline and commit them
(small, fast, reproducible, needs the ODbL notice and an alterations
file), or ship the ABC parser and derive at build time. Offline looks
right.

## 58. Two traditions: Irish and pop/rock

A switch between an Irish traditional character and a pop/rock one, each
drawing on its own material.

**Naming first.** Two axes already use the obvious words. `mode` is the
musical mode (dorian, minor, mixolydian, major) and `style` is the form
(`tune`, `riff`, `traditional`, `drift` in `src/track-structure.js`). The
new axis needs a third name — **tradition** — and it sits above both: a
tradition constrains which modes and forms are even in the bag.

**Harmony is the smallest part of the difference.** Swapping chord tables
alone will not make this sound like pop. If we left everything else as it
is, a pop progression would still arrive wearing an AABB form, cuts and
rolls on the long notes, a 6/8 jig lilt and a harp. A tradition has to be
a bundle:

| Slot | Where it lives | Irish | Pop/rock |
| --- | --- | --- | --- |
| Harmony | `PROGRESSIONS` in `theory.js` | modal, flat seventh, double-tonic | functional, V-I cadences |
| Mode bag | `composition.js` | dorian and mixolydian weighted up | major and minor |
| Form | `FORMS` in `track-structure.js` | AABB, 32-bar tune | verse/chorus, 8- and 16-bar |
| Meter | `track-structure.js` | 6/8 and 4/4 | 4/4, occasional 6/8 |
| Melody | `melody.js` | cuts and rolls, stepwise, ornament bias high | hooks, repeated rhythmic cells, wider leaps |
| Voices | `instruments.js` pools | harp, guitar, whistle-family, vibraphone | rhodes, electric bass, felt piano |
| Drums | `parts.js` | the same hip-hop backing either way |

The drums stay put deliberately. The hip-hop backing is what makes this
lofi rather than either a session recording or a rock demo, and it is the
constant that lets the two traditions sound like one instrument.

**The datasets are asymmetric, and only one is needed.**

Pop/rock does not need a corpus. `PROGRESSIONS.major` is already a
hand-written pop and rock table — I-V-vi-IV, I-IV-V, doo-wop, the royal
road, the Pachelbel canon. Pop harmony is the most documented harmony
there is; a dataset would mostly re-derive what is already in that file,
at the cost of a licence to honour. The work for this tradition is in the
other slots — form, melodic cells, voices — not the chords.

Irish is where a corpus genuinely earns its keep. Modal cadences, how
often a tune shuttles between relative major and minor, which intervals
carry a phrase — these are hard to hand-write convincingly and easy to
get subtly wrong. **The Session** under ODbL is the source, as recorded in
item 57.

**Chordonomicon** (666,000 genre-tagged chord progressions, on Hugging
Face) is the tempting shortcut for the pop side and is **CC-BY-NC**.
Non-commercial only, which would bind any derived weight table we shipped
and would sit badly with ever monetising output from this generator. Given
we do not need it, not worth the constraint.

Order of work: introduce the tradition axis with hand-written tables on
both sides and no dataset at all, so the bundle is proven end to end. Only
then feed the Irish harmony from The Session, where it is measurably hard
to do by hand.

---

## Where this is going

The roadmap had grown into fifty-odd items pulling in four directions at once —
a toy, a radio station, an export tool and a product. That is why it stopped
being useful for deciding what to do next. The direction is now settled:

> **An Irish thing, done well.** Narrow and particular, not a general lofi
> engine. There are many of the latter and nothing much like the former.

That decision has teeth. It is why the pop tradition in **58** was built and
then removed, and it is the test any new idea has to pass: *does this make the
Irish thing better, or just bigger?*

### What makes this worth continuing

Most generative lofi is a chord loop with a pentatonic scale sprinkled over the
top. The distinctive asset here is the melody: a grammar derived from 55,246
real tunes, which as far as we can tell nothing else in this space has. That is
the moat, and it is where effort compounds.

The three phases below are ordered so the moat gets deeper before the surface
gets wider.

### Phase one — make the tunes convincing

The melody is closest to being genuinely good and furthest from finished.

- **59** gave it the vocabulary and the sentence structure. Done.
- **60** is the next honest gap: real tunes cadence on notes this generator
  cannot reach.
- **Ornamentation as a first-class layer.** Done — see **62**.
- **Phrase-level structure.** The AABB form exists, but A and B do not yet
  answer each other. A real tune poses a question in bars one to four and
  answers it in five to eight. The corpus can be measured for this the same way
  its intervals were.
- **Heterophony.** `parts.js` already notes that two players on one tune, very
  slightly apart, is the traditional texture — and it is much more evocative
  than two different melodies. Worth making real.

### Phase two — make a tune something you can keep

Everything generated so far is gone the moment it plays. Nothing can be shared,
which is why nobody has heard this.

- **A tune has a permalink.** A score is already a reproducible recipe plus a
  seed. A URL carrying that seed would let someone send a tune to someone else.
  Cheapest possible route to this being heard by anyone.
- **18. Save the current tune** — WAV, and MIDI, which matters more: MIDI means
  the tunes can leave and be used elsewhere.
- **19. Notation** — the tunes are already stored as degrees and durations, and
  ABC is the format the tradition actually uses. A tune that can be printed as
  ABC is a tune a musician can play.

### Phase three — make it an instrument rather than a toy

- **"More like this."** Lock a phrase, ask for variations on it, keep the one
  you like. The composition layer already supports revision; the interface does
  not expose it.
- **30. Liking a track, and learning from it** — with a corpus-derived baseline
  to bias away from, this becomes meaningful rather than arbitrary.
- **Lock and regenerate by part** — keep the melody, replace the backing.

### Deliberately not doing

- **A second tradition** (**58**). Tried, rejected. Dilutes the one thing that
  makes this distinctive.
- **Training a neural model.** The grammar is a first-order Markov chain fitted
  by counting, and it is honest about that. A learned sequence model is a large
  amount of work for a gain that ornamentation and phrase structure would
  deliver more cheaply and more controllably.
- **21. More styles** — trance and minimalism are a different project wearing
  this one's clothes. Dungeon synth is genuinely adjacent and is **61**, kept
  deliberately as a separate thing.

---

## 59. A melodic grammar measured from the repertoire — done

`tools/derive-tune-stats.mjs` reads The Session's dump — 55,246 settings,
6.6 million notes — and writes `src/data/tune-stats.js`: distributions only,
about 28 KB, no tune or phrase reproduced. ODbL attribution and the full list
of alterations are in `src/data/TUNE-STATS-ATTRIBUTION.md`.

What the corpus said about the hand-tuned grammar it replaced: the instinct
that folk melody is overwhelmingly stepwise was right, at 46% guessed against
48% measured. Everything else was off. Notes were repeated nearly twice as
often as real tunes repeat them; thirds were under-used by about a third; every
interval was a coin flip on direction when real tunes fall more than they rise;
and nothing wider than a fifth could occur at all, so a tune could never make
the skip that gives a jig its lift.

The table also holds what follows what, which is where grammar actually lives.
After a fall of a fifth the corpus almost stops descending — a further step
down goes from 16% to 1% — and either repeats the note or turns back up. That
is the gap-fill principle, measured rather than assumed, and half the
probability mass moves between the plain distribution and that row.

`melody.js` now takes the meter and draws from the matching repertoire, which
is the first time melody generation has known what meter it is in: 6/8 from
jigs, 9/8 from slip jigs, 3/4 from waltzes, 2/4 from polkas, reels otherwise.

One thing the data contradicts that is left alone on purpose. `engine.js` says
dorian and minor are where this music lives and major is the exception; the
corpus is 64% major and 14% dorian, and jigs specifically are 63% major. That
inversion may well be right for lofi, where modal suits the mood — but it is
now a taste decision rather than an assumption.

## 60. Cadence targets, and the notes the pool leaves out — done

The derived table already records where real parts come to rest. For jigs: the
tonic 42% of the time, the fifth 15%, the second 13%, the fourth 10%, the
seventh 8%. Nothing reads it yet, and wiring it in turns out to uncover
something bigger than a cadence tweak.

`CADENCE_FORMULAS` can only land a part on pool index 0, 1 or 4. In the corpus,
**about a fifth of all part endings are on the fourth or the seventh** — and in
major those two notes are not in the pool at all. `GAPPED.major` is
`[0, 1, 2, 4, 5]`, which omits the fourth and the seventh deliberately, as a
folk-flavoured simplification. It is a good instinct for the middle of a phrase,
where those notes are the easiest way to sound wrong. It is the wrong rule at a
cadence, where landing on the flat seventh is one of the most characteristic
sounds in the modal repertoire.

So this is really two decisions:

1. **Cadences should target scale degrees, not pool indices.** The same formula
   currently means different notes in different modes, because the pool is ten
   notes in major and fourteen in dorian.
2. **The pool should be allowed to widen at a cadence**, so a tune can end
   where real tunes end.

Then the formula set can be weighted by the measured frequencies, and formulas
added for the endings that are currently unreachable.

Worth doing carefully: the gapped pool is load-bearing for how the middle of a
phrase sounds, and widening it everywhere would undo that.

**Done, and both decisions went the way described.** Cadence formulas are now
scale degrees rather than pool indices — which in dorian, whose pool holds all
seven notes, is what they already meant, so this mostly fixed major, where a
half cadence on "index 4" had been landing on the sixth. A cadence event
carries a `scaleDegree` alongside its pool index, and playback prefers it, so
the pool widens exactly at the cadence and nowhere else. Cadence notes also
skip the chord-tone fitting that would otherwise snap a modal ending on the
flat seventh back onto the chord.

Formula choice is weighted by the measured frequencies rather than picked
uniformly. Generated part endings now sit close to the corpus: tonic 50%
against 42%, the fifth 12% against 15%, the fourth 9% against 10%, the seventh
7% against 8%. The tonic runs high because a full cadence still always
resolves there, which is deliberate. Degrees two and five have no formulas yet
and are the obvious next addition.

## 61. Dungeon synth — a side project off this engine

A separate generator, not a style inside this one. Dungeon synth wants slow
tempi, modal and minor material, long reverb, sparse or absent percussion, and
bell, choir and reedy organ voices — and it is lo-fi by convention, so the tape
character, hiss and vinyl surface already built here are the right aesthetic
rather than an add-on.

The overlap with what exists is unusually large: modal note pools, the drone,
the motif grammar, the arc, the tape path and the surface noise all transfer
almost unchanged. What differs is mostly what gets removed — the hip-hop
backing, the swing, the tempo range — plus a voice bank and a much longer sense
of time.

Kept separate on purpose. Folding it in would be exactly the dilution that
**58** was rejected for; standing it up beside this one is a way to find out how
much of this engine is genuinely reusable, which is worth knowing.

## 62. Ornamentation as a real layer — done

There was one ornament: a cut, a grace note a step above, on a note long
enough to take it. Everything else in the vocabulary was missing, including
the roll, which is the signature sound of a jig.

Ornamentation here is articulation, not decoration. A player has no volume
control and no sustain, so these are how one note is separated from the next
and how a long note is kept alive. That framing decides the rules, and they
are the ones a player follows without thinking:

- A **roll** needs room. It fills a long note — in a jig, the whole dotted
  crotchet — and sounds the note three times with a cut and a tap between:
  the note, above, the note, below, the note.
- A **cut** separates two notes of the same pitch. This is the one place an
  ornament is not a matter of taste, because there is no way to sound the same
  note twice without articulating between them, so it is decided before the
  ornament bias is consulted at all. The listener's own control still gates
  every ornament at playback.
- A **cran** is what a player uses where there is no note below to strike, so
  it belongs at the bottom of the range: several cuts in quick succession
  rather than one.
- A **tap** answers a line that has just come down from above.

Kinds are chosen when the tune is written and recorded in the score, so a
replay ornaments identically; the grace notes themselves are produced at
playback, because they are performance rather than melody. Scores written
before ornaments had kinds recorded a plain `true`, which is read as a cut.

One real fault turned up while testing. A grace note is flicked in just before
the beat, but on the first note of a bar there is no room before it, and the
timing was clamped — so the grace landed exactly on top of its own note, a
chord rather than an ornament, on the strong beat where a cut is most likely.
A player solves it the other way round: the beat lands on the cut and the note
follows. It now does that.

Measured across 2,000 phrases: about 19% of notes carry an ornament, split
roughly cut 47%, roll 26%, tap 23%, cran under 1% — which is right, since a
cran only applies at the bottom of the range. Verified against all four lead
voices, including the plucked one, since a roll retriggers a monophonic voice
five times and that is exactly what used to break it.
