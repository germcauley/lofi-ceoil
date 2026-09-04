import { test, expect } from '@playwright/test';
import { createTrackNamer } from '../src/track-names.js';
import { IRISH_TITLES } from '../src/data/track-titles-ga.js';
import { ENGLISH_TITLES } from '../src/data/track-titles-en.js';
import { phraseTitles } from '../src/data/track-title-phrases.js';

test ('a listener does not meet the same title twice in a sitting', () => {
  const nextTitle = createTrackNamer();
  const seen = new Map();
  let firstRepeat = null;

  for (let i = 0; i < 200; i++) {
    const { title } = nextTitle();
    if (seen.has (title) && firstRepeat === null) firstRepeat = i;
    seen.set (title, (seen.get (title) ?? 0) + 1);
  }

  // There were 32 titles, so a name came back inside a single sitting.
  expect (firstRepeat).toBeNull();
  expect (seen.size).toBe (200);
});

test ('the share between languages is chosen, not left to the size of the pools', () => {
  const nextTitle = createTrackNamer();
  let irish = 0;
  const runs = 1200;

  for (let i = 0; i < runs; i++) {
    const { titleLanguage } = nextTitle();
    if (titleLanguage === 'ga') irish++;
  }

  // English outnumbers Irish four to one, so one shared deck would have shown
  // an Irish title only a fifth of the time.
  expect (irish / runs).toBeGreaterThan (0.35);
  expect (irish / runs).toBeLessThan (0.55);
});

test ('every title is well formed, and the pool is large', () => {
  const all = [...IRISH_TITLES, ...ENGLISH_TITLES, ...phraseTitles()];
  expect (all.length).toBeGreaterThan (500);

  // A duplicate would quietly eat one of a deck's slots.
  expect (new Set (all.map (entry => entry.title)).size).toBe (all.length);

  for (const entry of all) {
    expect (entry.title.trim()).toBe (entry.title);
    expect (entry.title.length).toBeGreaterThan (2);
    expect (['ga', 'en']).toContain (entry.titleLanguage);
    // An Irish title is shown with its translation underneath; an English one
    // must have none, or the panel repeats itself.
    if (entry.titleLanguage === 'ga') expect (entry.titleEnglish).toBeTruthy();
    else expect (entry.titleEnglish).toBeNull();
  }
});

test ('a title record is a copy, so a track cannot edit the library', () => {
  const nextTitle = createTrackNamer();
  const first = nextTitle();
  first.title = 'mutated';
  const found = [...IRISH_TITLES, ...ENGLISH_TITLES].some (entry => entry.title === 'mutated');
  expect (found).toBe (false);
});
