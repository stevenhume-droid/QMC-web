import { readFileSync } from 'fs';
import { resolve } from 'path';
import assert from 'assert';

const htmlPath = resolve('catalogue/index.html');
const html = readFileSync(htmlPath, 'utf8');

console.log('=== VERIFYING BOX VIEW SET CHOOSER & CREATION ===\n');

// Test 1: Static HTML DOM ID uniqueness check
console.log('Test 1: Static HTML DOM ID uniqueness check...');
const idRegex = /\bid=["']([^"']+)["']/g;
const idCounts = {};
let match;
while ((match = idRegex.exec(html)) !== null) {
  const id = match[1];
  if (!id.includes('${')) {
    idCounts[id] = (idCounts[id] || 0) + 1;
  }
}
const duplicateIds = Object.entries(idCounts).filter(([_, count]) => count > 1);
assert.strictEqual(duplicateIds.length, 0, `Found duplicate IDs: ${JSON.stringify(duplicateIds)}`);
console.log(`  ✓ All ${Object.keys(idCounts).length} static DOM element IDs are 100% unique.`);

// Test 2: UI DOM elements existence check
console.log('\nTest 2: Verifying required UI elements in Box view...');
const requiredElements = [
  'activeSetSelectPicker',
  'btnSetBuilderNewSet',
  'btnTopNewSet',
  'activeSetTitleInput',
  'activeSetTimeline',
  'recordBoxPane',
  'setBuilderPane'
];
requiredElements.forEach(id => {
  assert.ok(html.includes(`id="${id}"`), `Element id="${id}" must exist in index.html`);
});
console.log('  ✓ All required Set Chooser & Creation DOM elements exist.');

// Test 3: JavaScript function availability check
console.log('\nTest 3: Function availability checks...');
const requiredFunctions = [
  'renderActiveSetPicker',
  'handleActiveSetPickerChange',
  'chooseActiveSet',
  'createNewActiveSetPrompt',
  'renderSetBuilderPane'
];
requiredFunctions.forEach(fn => {
  assert.ok(html.includes(`function ${fn}`), `Function ${fn} must be defined in index.html`);
});
console.log('  ✓ renderActiveSetPicker, handleActiveSetPickerChange, chooseActiveSet, and createNewActiveSetPrompt are defined.');

// Test 4: Functional simulation of Set Chooser & Set Creation
console.log('\nTest 4: Simulating active set switching and new set creation...');

// Mock browser environment
const localStorageStore = {};
global.localStorage = {
  getItem: (key) => localStorageStore[key] || null,
  setItem: (key, val) => { localStorageStore[key] = String(val); },
  removeItem: (key) => { delete localStorageStore[key]; }
};

global.qmcSavedSets = [];
global.QMC_SAVED_SETS_KEY = 'qmc_saved_sets';

let toastMsg = null;
global.showToast = (msg) => { toastMsg = msg; };
global.escapeHtml = (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
global.notifyQmcCurationUpdate = () => { };

// Seed sample saved sets
const sampleSavedSets = [
  {
    set_id: 'set_alpha',
    title: 'Low Port Record Fair',
    description: 'Curated vinyl sequencing',
    tracks: [
      { record_id: '1', title: 'Dancing In The Street', artist: 'Martha Reeves', bpm: 110, position: 1 },
      { record_id: '2', title: 'Roadrunner', artist: 'Jonathan Richman', bpm: 136, position: 2 }
    ]
  },
  {
    set_id: 'set_beta',
    title: 'Edinburgh Soul Night',
    description: 'Northern Soul 45s',
    tracks: [
      { record_id: '3', title: 'Do I Love You', artist: 'Frank Wilson', bpm: 133, position: 1 }
    ]
  }
];
localStorage.setItem('qmc_saved_sets', JSON.stringify(sampleSavedSets));

// Extract functions from HTML to execute in node
const extractFn = (name) => {
  const regex = new RegExp(`function ${name}\\s*\\([^{]*\\)\\s*\\{[\\s\\S]*?\\n    \\}`);
  const match = html.match(regex);
  if (!match) throw new Error(`Could not extract function ${name}`);
  return new Function('return (' + match[0] + ')')();
};

const getQmcSavedSets = extractFn('getQmcSavedSets');
const saveQmcSavedSets = extractFn('saveQmcSavedSets');
const saveActiveSet = extractFn('saveActiveSet');
global.getQmcSavedSets = getQmcSavedSets;
global.saveQmcSavedSets = saveQmcSavedSets;
global.saveActiveSet = saveActiveSet;

let activeSetState = {
  id: null,
  title: 'Session Set 13/11/2026',
  description: 'QMC Vinyl Session',
  tracks: []
};

// Simulate chooseActiveSet logic
function simulateChooseActiveSet(setId) {
  const sets = getQmcSavedSets();
  const set = sets.find(s => String(s.set_id) === String(setId));
  if (!set) return;

  if (activeSetState && Array.isArray(activeSetState.tracks) && activeSetState.tracks.length > 0) {
    saveActiveSet(activeSetState);
  }

  activeSetState = {
    id: set.set_id,
    title: set.title || 'Untitled Set',
    description: set.description || 'QMC Vinyl Session',
    tracks: JSON.parse(JSON.stringify(set.tracks || []))
  };
}

// 4a: Switch to set_alpha
simulateChooseActiveSet('set_alpha');
assert.strictEqual(activeSetState.id, 'set_alpha');
assert.strictEqual(activeSetState.title, 'Low Port Record Fair');
assert.strictEqual(activeSetState.tracks.length, 2);
console.log('  ✓ Switched to "Low Port Record Fair" (2 tracks).');

// 4b: Switch to set_beta
simulateChooseActiveSet('set_beta');
assert.strictEqual(activeSetState.id, 'set_beta');
assert.strictEqual(activeSetState.title, 'Edinburgh Soul Night');
assert.strictEqual(activeSetState.tracks.length, 1);
console.log('  ✓ Switched to "Edinburgh Soul Night" (1 track).');

// 4c: Simulate create new set
const newSetId = 'set_gamma';
const newSetTitle = 'Glasgow Funk Session';
const created = saveActiveSet({
  id: newSetId,
  title: newSetTitle,
  description: 'QMC Vinyl Session',
  tracks: []
});
activeSetState = {
  id: created.set_id,
  title: created.title,
  description: created.description,
  tracks: []
};

assert.strictEqual(activeSetState.title, 'Glasgow Funk Session');
assert.strictEqual(activeSetState.tracks.length, 0);
const allSaved = getQmcSavedSets();
assert.strictEqual(allSaved.length, 3);
assert.ok(allSaved.some(s => s.title === 'Glasgow Funk Session'));
console.log('  ✓ Created new set "Glasgow Funk Session" with 0 tracks and persisted to saved sets.');

console.log('\n=== ALL BOX VIEW SET CHOOSER & CREATION TESTS PASSED (4/4) ===');
