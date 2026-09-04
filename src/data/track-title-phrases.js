// Combinatorial titles, to widen the pool beyond what is worth hand-writing.
//
// These are deliberately not free-form templates. Each family pairs two
// curated banks chosen so that *every* combination reads as a real title —
// there is no slot that can produce nonsense, because nothing goes in a slot
// that does not suit every partner. That is the price of generating names
// rather than authoring them, and it is worth paying only in English: Irish
// needs lenition and the genitive to agree, and a generator that gets those
// wrong produces titles that are not merely bland but incorrect. The Irish
// titles are all hand-written for that reason.

const FAMILIES = [
  {
    join: (a, b) => `${a} on ${b}`,
    first: ['rain', 'mist', 'frost', 'light', 'dust', 'salt', 'moonlight',
            'quiet', 'smoke', 'snow', 'sunlight', 'weather'],
    second: ['the window', 'the water', 'the long road', 'the hill', 'the roof',
             'the field', 'the harbour', 'the glass', 'the stones', 'the lane',
             'the back step', 'the far shore']
  },
  {
    join: (a, b) => `the ${a} ${b}`,
    first: ['slow', 'quiet', 'long', 'soft', 'small', 'late', 'old', 'good',
            'far', 'low', 'bright', 'idle'],
    second: ['harbour', 'morning', 'hillside', 'kitchen', 'garden', 'crossing',
             'ferry', 'orchard', 'shoreline', 'lamplight', 'headland', 'window']
  },
  {
    join: (a, b) => `${a} in the ${b}`,
    first: ['dozing', 'drifting', 'waiting', 'walking', 'dreaming', 'reading',
            'listening', 'wandering', 'humming', 'lingering'],
    second: ['rain', 'mist', 'half-light', 'small hours', 'long grass',
             'quiet', 'morning', 'shade', 'gorse', 'drizzle']
  }
];

/** Every combination, as title records matching the hand-written ones. */
export function phraseTitles () {
  const titles = [];
  for (const { join, first, second } of FAMILIES) {
    for (const a of first) {
      for (const b of second) {
        titles.push ({ title: join (a, b), titleEnglish: null, titleLanguage: 'en' });
      }
    }
  }
  return titles;
}
