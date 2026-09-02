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
- [ ] **3. Motif and development**
- [ ] **4. Chord-aware melody**
- [ ] **5. Cadences and question/answer**
- [ ] **6. Counter-line textures: imitation and heterophony**
- [ ] **7. Eight-bar parts with a higher turn**
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

## 3. Motif and development

**The problem, and the biggest one remaining.** `createPhrase` picks each note by weighted interval with a contour nudge. That is a *constrained random walk* — the current note is the only influence on the next. No idea is stated, so nothing can be developed, and `varyPhrase` can only perturb degrees by ±1, which is noise rather than development.

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

## 4. Chord-aware melody

**The problem.** Melody notes come from a scale pool with no knowledge of the chord underneath, so a note can clash and simply sit there unresolved.

**The fix**, straight from common practice:

- Strong beats take **chord tones**.
- Weak beats may take non-chord tones, but only as **passing tones** (approached and left by step in the same direction) or **neighbour tones** (step away, step back).

Roughly twenty lines, and it removes essentially every wrong-note moment.

Add **generate and test** alongside it: no more than two leaps in a row; a leap must be followed by a step in the opposite direction; range within a tenth; no note repeated more than three times. Fail, regenerate.

## 5. Cadences and question/answer

Bar 2 should close on an unstable degree — the 2nd or 5th, a half cadence. Bar 4 closes on the tonic. Currently only the final note is forced home, so phrases have an ending but no shape. Antecedent and consequent is what makes four bars feel like a sentence.

Add three or four stock **cadence formulas** per mode. Trad tunes reuse the same closes constantly; it is a feature, not a limitation. Zero risk, instant idiom.

## 6. Counter-line textures

Currently the counter line is *figuration* — an arpeggio. It fills space intelligently but shares no material with the tune, so it can only be tasteful, never interesting.

- **Imitation.** Play the melody's motif delayed by a bar, a fourth or fifth below. Canon. Highest payoff here — it immediately sounds composed rather than generated.
- **Heterophony.** The actual traditional Celtic texture, and almost nobody implements it: a second voice playing *the same tune*, simplified or ornamented differently. Two fiddlers playing one melody, not two melodies.
- **Voice-leading constraints** against the melody: no parallel fifths or octaves, prefer contrary motion, stay within a tenth.

Make these a **texture** selector — figuration, imitation, heterophony, drone-only — chosen per section rather than replacing what exists.

## 7. Eight-bar parts with a higher turn

Irish tunes are **8-bar parts**, AABB, and the B part — "the turn" — typically starts a register higher. We are at 4-bar phrases. This is the most idiomatic structural change available, and it gives the listener a shape spanning minutes rather than seconds.

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
