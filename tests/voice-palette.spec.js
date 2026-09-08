import { test, expect } from '@playwright/test';
import { pickVoice, VOICE_WEIGHTS } from '../src/voice-palette.js';
import { LEAD_VOICES, KEYS_VOICES, BASS_VOICES, SUPPORT_VOICES } from '../src/instruments.js';
import { decodeTrack } from '../src/track-link.js';

const share = (role, names, draws = 12000) => {
  let seed = 4242;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const counts = {};
  for (let i = 0; i < draws; i++) {
    const name = pickVoice (role, names, random);
    counts[name] = (counts[name] ?? 0) + 1;
  }
  return name => (counts[name] ?? 0) / draws;
};

test ('the automatic palette leans warm rather than struck', () => {
  const names = Object.keys (LEAD_VOICES);
  const of = share ('lead', names);

  // Played evenly, half the palette was struck metal, which reads as world
  // music or as a toy whatever the notes are doing.
  const bells = ['vibraphone', 'marimba', 'kalimba'].reduce ((sum, n) => sum + of (n), 0);
  expect (bells).toBeLessThan (3 / names.length);
  expect (of ('rhodes')).toBeGreaterThan (of ('kalimba') * 3);
  expect (of ('guitar')).toBeGreaterThan (of ('marimba') * 3);

  // Nothing is removed — a bell is lovely once in a while.
  for (const name of names) expect (of (name)).toBeGreaterThan (0);
});

test ('every voice that exists has a weight, and none is zero', () => {
  // A name with no weight silently falls back to one, which is how a voice
  // ends up commoner than intended without anybody choosing that.
  const tables = { lead: LEAD_VOICES, keys: KEYS_VOICES, bass: BASS_VOICES, support: SUPPORT_VOICES };
  for (const [role, table] of Object.entries (tables)) {
    for (const name of Object.keys (table)) {
      expect (VOICE_WEIGHTS[role]?.[name]).toBeGreaterThan (0);
    }
  }
});

test ('adding voices did not move the ones a link already names', () => {
  // A voice is stored in a link as its position in the table, so a new one
  // must be appended and never inserted.
  const older = 'AQSfjc29DADHNgADAwACCQQBAAgBgFCIgIyZJE2AR0pFTUdZAJtZrni1gIYDAwICbw';
  const decoded = decodeTrack (older);
  expect (decoded.title).toBe ('humming in the rain');
  expect (decoded.voices.lead).toBe ('kalimba');
  expect (decoded.voices.bass).toBe ('sub');

  // The new warm leads sit after the originals.
  const leads = Object.keys (LEAD_VOICES);
  expect (leads.indexOf ('rhodes')).toBeGreaterThan (leads.indexOf ('harp (synth)'));
  expect (leads.slice (0, 7)).toEqual (
    ['guitar', 'vibraphone', 'marimba', 'kalimba', 'piano', 'harp', 'harp (synth)']);
});

test ('choosing a voice is reproducible and never returns nothing', () => {
  const seeded = () => { let s = 9; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const names = Object.keys (LEAD_VOICES);
  expect (pickVoice ('lead', names, seeded())).toBe (pickVoice ('lead', names, seeded()));
  // One option left, or a role nobody weighted, must still answer.
  expect (pickVoice ('lead', ['harp'], Math.random)).toBe ('harp');
  expect (pickVoice ('nonesuch', ['a', 'b'], Math.random)).toMatch (/^[ab]$/);
});
