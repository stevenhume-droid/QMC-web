// scratch/verify_dossier_set_and_bpm_key.mjs
// Verification suite for:
// 1. Adding tracks to set from release Dossier view
// 2. Displaying BPM and Musical Key in the Set Builder timeline
// 3. Ensuring no duplicate static HTML element IDs in catalogue/index.html

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const htmlPath = path.resolve('c:/Users/steve/QMC-web/catalogue/index.html');
const rawHtml = fs.readFileSync(htmlPath, 'utf8');

console.log('=== VERIFYING DOSSIER SET ADDITION & BPM/KEY IN SET BUILDER ===\n');

// Test 1: Check static DOM element ID uniqueness
console.log('Test 1: Static HTML DOM ID uniqueness check...');
const staticHtmlWithoutScripts = rawHtml.replace(/<script[\s\S]*?<\/script>/gi, '');
const idRegex = /id=["']([a-zA-Z0-9_\-]+)["']/g;
const idCounts = new Map();
let m;
while ((m = idRegex.exec(staticHtmlWithoutScripts)) !== null) {
  const id = m[1];
  idCounts.set(id, (idCounts.get(id) || 0) + 1);
}
const duplicateIds = Array.from(idCounts.entries()).filter(([_, count]) => count > 1);
assert.equal(duplicateIds.length, 0, `Found duplicate static IDs: ${JSON.stringify(duplicateIds)}`);
console.log(`  ✓ All ${idCounts.size} static DOM element IDs are 100% unique.`);

// Extract JavaScript for VM evaluation
const scriptRegex = /<script(?:\s+type="([^"]*)")?>([\s\S]*?)<\/script>/gi;
let match;
const scripts = [];
while ((match = scriptRegex.exec(rawHtml)) !== null) {
  const type = (match[1] || '').trim().toLowerCase();
  const content = match[2];
  if (!type || type === 'text/javascript' || type === 'application/javascript') {
    scripts.push(content);
  }
}

const mainScript = scripts[scripts.length - 1];
const mockStorage = new Map();
const mockLocalStorage = {
  getItem: (k) => mockStorage.has(k) ? mockStorage.get(k) : null,
  setItem: (k, v) => mockStorage.set(k, String(v)),
  removeItem: (k) => mockStorage.delete(k),
  clear: () => mockStorage.clear()
};

const domRegistry = new Map();
function makeEl(id = '', tag = 'DIV') {
  return {
    id,
    tagName: tag,
    className: '',
    value: '',
    innerHTML: '',
    textContent: '',
    innerText: '',
    style: {},
    classList: {
      tokens: new Set(),
      add: function (...c) { c.forEach(x => this.tokens.add(x)); },
      remove: function (...c) { c.forEach(x => this.tokens.delete(x)); },
      toggle: function (c, force) {
        if (force === true) this.tokens.add(c);
        else if (force === false) this.tokens.delete(c);
        else if (this.tokens.has(c)) this.tokens.delete(c);
        else this.tokens.add(c);
      },
      contains: function (c) { return this.tokens.has(c); }
    },
    children: [],
    appendChild: function (child) { this.children.push(child); return child; },
    remove: function () { },
    setAttribute: function () { },
    getAttribute: function () { return ''; },
    focus: function () { },
    select: function () { }
  };
}

function getOrCreateEl(id, tag = 'DIV') {
  if (!domRegistry.has(id)) {
    domRegistry.set(id, makeEl(id, tag));
  }
  return domRegistry.get(id);
}

const sandbox = {
  console,
  setTimeout: (fn) => { fn(); return 1; },
  clearTimeout: () => {},
  setInterval: () => 1,
  clearInterval: () => {},
  localStorage: mockLocalStorage,
  window: {
    localStorage: mockLocalStorage,
    location: { href: 'http://localhost/catalogue/', search: '', origin: 'http://localhost' },
    addEventListener: () => {},
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    scrollTo: () => {}
  },
  document: {
    documentElement: makeEl('documentElement', 'HTML'),
    body: makeEl('body', 'BODY'),
    getElementById: (id) => getOrCreateEl(id),
    createElement: (tag) => makeEl('', tag),
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {}
  },
  showToast: (msg, type) => {
    // console.log(`[Toast ${type}]: ${msg}`);
  },
  alert: (msg) => { console.log(`[Alert]: ${msg}`); },
  confirm: () => true
};

vm.createContext(sandbox);
vm.runInContext(mainScript, sandbox);

console.log('Test 2: Function availability checks...');
assert.equal(typeof sandbox.addTrackToActiveSet, 'function', 'addTrackToActiveSet must be defined');
assert.equal(typeof sandbox.addTrackToActiveSetFromDossier, 'function', 'addTrackToActiveSetFromDossier must be defined');
assert.equal(typeof sandbox.renderSetBuilderPane, 'function', 'renderSetBuilderPane must be defined');
assert.equal(typeof sandbox.viewRecordDetail, 'function', 'viewRecordDetail must be defined');
console.log('  ✓ addTrackToActiveSetFromDossier, addTrackToActiveSet, renderSetBuilderPane and viewRecordDetail are available.');

console.log('Test 3: Direct track sequencing from Dossier...');
// Seed test records
const testRecords = [
  {
    id: 'rec-test-1',
    artist: 'Kraftwerk',
    title: 'Computer World',
    format: '12" LP',
    speed: '33 1/3 RPM',
    bpm: 128,
    musical_key: 'F Minor',
    tracks: [
      { position: 'A1', title: 'Computer World', duration: '5:05', bpm: 128, musical_key: 'F Minor' },
      { position: 'A2', title: 'Pocket Calculator', duration: '4:55', bpm: 126, musical_key: 'C Major' },
      { position: 'B1', title: 'Numbers', duration: '3:19', bpm: 128, musical_key: 'D Minor' }
    ]
  },
  {
    id: 'rec-test-2',
    artist: 'OMD',
    title: 'Electricity',
    format: '7" Single (45 RPM)',
    speed: '45 RPM',
    sideATitle: 'Electricity',
    sideADuration: '3:32',
    sideBTitle: 'Almost',
    sideBDuration: '3:40',
    tracks: []
  }
];

vm.runInContext('records = ' + JSON.stringify(testRecords) + ';', sandbox);

// Ensure activeSetState is reset
vm.runInContext('activeSetState.tracks = []', sandbox);
mockStorage.clear();

// Verify record is not yet in box
assert.equal(sandbox.isRecordInBox('rec-test-1'), false, 'rec-test-1 should not be in box initially');

// Sequence Track 1 ('Pocket Calculator', index 1) from Dossier
sandbox.addTrackToActiveSetFromDossier('rec-test-1', 1);

// Verify record was automatically packed into Record Box
assert.equal(sandbox.isRecordInBox('rec-test-1'), true, 'rec-test-1 should now be packed into Record Box');

// Verify track is in active set timeline
let activeSet = vm.runInContext('activeSetState', sandbox);
assert.equal(activeSet.tracks.length, 1, 'Should have 1 track in active set');
const queuedTr1 = activeSet.tracks[0];
assert.equal(queuedTr1.title, 'Pocket Calculator');
assert.equal(queuedTr1.artist, 'Kraftwerk');
assert.equal(queuedTr1.bpm, 126);
assert.equal(queuedTr1.key, 'C Major');
console.log(`  ✓ Track "${queuedTr1.title}" added to active set with BPM: ${queuedTr1.bpm}, Key: ${queuedTr1.key}`);

console.log('Test 4: Fallback 2-track (7" single) dossier sequencing...');
// Add Track 0 (Electricity) from 7" single
sandbox.addTrackToActiveSetFromDossier('rec-test-2', 0);
activeSet = vm.runInContext('activeSetState', sandbox);
assert.equal(activeSet.tracks.length, 2, 'Should now have 2 tracks in active set');
const queuedTr2 = activeSet.tracks[1];
assert.equal(queuedTr2.title, 'Electricity');
assert.equal(queuedTr2.artist, 'OMD');
assert.equal(queuedTr2.speed, '45 RPM');
assert.ok(queuedTr2.bpm, 'BPM should be populated');
assert.ok(queuedTr2.key, 'Key should be populated');
console.log(`  ✓ Fallback 2-track single added: "${queuedTr2.title}" with BPM: ${queuedTr2.bpm}, Key: ${queuedTr2.key}, Speed: ${queuedTr2.speed}`);

console.log('Test 5: Set Builder Timeline UI rendering with BPM & Key badges...');
// Ensure DOM containers exist
getOrCreateEl('activeSetTimeline');
getOrCreateEl('activeSetTitleInput');
getOrCreateEl('activeSetTrackCount');
getOrCreateEl('activeSetRuntime');
getOrCreateEl('activeSetSpeedAlert');

sandbox.renderSetBuilderPane();

const timelineHtml = getOrCreateEl('activeSetTimeline').innerHTML;
assert.ok(timelineHtml.includes('Pocket Calculator'), 'Timeline should render Pocket Calculator');
assert.ok(timelineHtml.includes('126 BPM'), 'Timeline should render BPM badge (126 BPM)');
assert.ok(timelineHtml.includes('C Major'), 'Timeline should render Musical Key badge (C Major)');
assert.ok(timelineHtml.includes('Electricity'), 'Timeline should render Electricity');
assert.ok(timelineHtml.includes('45 RPM'), 'Timeline should render 45 RPM badge');
console.log('  ✓ Set Builder timeline successfully displays BPM and Musical Key badges for all tracks.');

console.log('Test 6: Dossier modal rendering includes [ + Set ] buttons and Set Builder footer button...');
getOrCreateEl('detailModal');
getOrCreateEl('detailModalContent');

// Call viewRecordDetail for rec-test-1
sandbox.viewRecordDetail('rec-test-1');
const dossierHtml = getOrCreateEl('detailModalContent').innerHTML;

// Check for Dossier Set buttons
assert.ok(dossierHtml.includes('addTrackToActiveSetFromDossier'), 'Dossier tracklist must include addTrackToActiveSetFromDossier calls');
assert.ok(dossierHtml.includes('dossierSetBtn-rec-test-1-0'), 'Dossier must have dossierSetBtn for track 0');
assert.ok(dossierHtml.includes('dossierSetBtn-rec-test-1-1'), 'Dossier must have dossierSetBtn for track 1');
// Track 1 is in active set, so it should render ✓ Set
assert.ok(dossierHtml.includes('✓ Set'), 'Dossier track 1 should show ✓ Set because it is already sequenced');

// Check for Set Builder footer button
assert.ok(dossierHtml.includes("openRecordBoxDrawer('sets')"), 'Dossier footer must have button to open Set Builder');
assert.ok(dossierHtml.includes('Set Builder'), 'Dossier footer must contain "Set Builder" text');
console.log('  ✓ Dossier view successfully renders [ + Set ] / [ ✓ Set ] track buttons and Set Builder drawer launcher.');

console.log('\n=== ALL VERIFICATION TESTS PASSED (6/6) ===');
