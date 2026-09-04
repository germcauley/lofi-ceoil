// Choose entrances without letting a run of random draws sound like one preset.
// These plans belong to a track; its intro happens once, not on every turn.
const OPENINGS = ['melody', 'chords', 'layered', 'rhythm', 'full'];
const FORMS = {
  tune: ['A', 'A', 'B', 'A'],
  riff: ['A', 'B', 'A', 'B'],
  traditional: ['A', 'A', 'B', 'B'],
  drift: ['A', 'A', 'B', 'B']
};

function bagPicker (values) {
  let bag = [], previous;
  return () => {
    if (! bag.length) {
      bag = [...values];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor (Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      if (bag.at (-1) === previous) [bag[0], bag[bag.length - 1]] = [bag.at (-1), bag[0]];
    }
    previous = bag.pop();
    return previous;
  };
}

/** The section plan a form implies. A link carries the form and rebuilds
    these, rather than spending bytes on something already determined. */
export const sectionsFor = style => [...(FORMS[style] ?? FORMS.tune)];

export function createStructurePicker () {
  const opening = bagPicker (OPENINGS);
  const meter = bagPicker (['4/4', '4/4', '6/8']);
  const style = bagPicker (Object.keys (FORMS));
  return () => {
    const kind = style();
    return { meter: meter(), opening: opening(), style: kind, sections: [...FORMS[kind]], chordHold: Math.random() < 0.6 ? 2 : 1 };
  };
}

const ENTRANCES = {
  melody: { leadFrom: 0, chordsFrom: 2, bassFrom: 4, drumsFrom: 6, droneFrom: 4, counterFrom: 8 },
  chords: { leadFrom: 4, chordsFrom: 0, bassFrom: 4, drumsFrom: 6, droneFrom: 4, counterFrom: 8 },
  layered: { leadFrom: 0, chordsFrom: 0, bassFrom: 2, drumsFrom: 4, droneFrom: 4, counterFrom: 8, comp: 'offbeat' },
  rhythm: { leadFrom: 4, chordsFrom: 2, bassFrom: 4, drumsFrom: 0, droneFrom: 4, counterFrom: 8, kickFrom: 4 },
  full:   { leadFrom: 0, chordsFrom: 0, bassFrom: 0, drumsFrom: 0, droneFrom: 0, counterFrom: 4 }
};

export function openingPlan (structure) {
  return ENTRANCES[structure.opening];
}
