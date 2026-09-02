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
- [ ] **8. Comping rhythms and harmonic rhythm**
- [ ] **9. Long-form structure**

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

## 8. Comping rhythms and harmonic rhythm

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
