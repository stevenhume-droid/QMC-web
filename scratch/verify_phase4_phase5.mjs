// verify_phase4_phase5.mjs
// Verification suite for Phase 4 (Crates & Sets Dashboard Tabs) & Phase 5 (Spotify Set Export Pipeline)

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const htmlPath = path.resolve('c:/Users/steve/QMC-web/catalogue/index.html');
const rawHtml = fs.readFileSync(htmlPath, 'utf8');

console.log('=== VERIFYING PHASE 4 & PHASE 5: CRATES/SETS TABS & SPOTIFY EXPORT ===');

// 1. Static HTML IDs Check
const htmlWithoutScripts = rawHtml.replace(/<script[\s\S]*?<\/script>/gi, '');
const idRegex = /id="([^"]+)"/g;
const staticIds = new Set();
let match;
while ((match = idRegex.exec(htmlWithoutScripts)) !== null) {
  const id = match[1];
  assert.ok(!staticIds.has(id), `Duplicate ID detected: ${id}`);
  staticIds.add(id);
}
console.log(`PASS: Verified ${staticIds.size} static HTML IDs with zero duplicates.`);

// 2. Required View Switcher IDs
assert.ok(staticIds.has('viewCratesBtn'), 'viewCratesBtn must exist in HTML');
assert.ok(staticIds.has('viewSetsBtn'), 'viewSetsBtn must exist in HTML');
console.log('PASS: viewCratesBtn and viewSetsBtn exist in primary view switcher.');

// 3. Extract and check syntax of inline scripts
const scriptRegex = /<script(?:\s+type="([^"]*)")?>([\s\S]*?)<\/script>/gi;
const scripts = [];
while ((match = scriptRegex.exec(rawHtml)) !== null) {
  const type = (match[1] || '').trim().toLowerCase();
  const content = match[2];
  if (!type || type === 'text/javascript' || type === 'application/javascript') {
    scripts.push(content);
  }
}

scripts.forEach((code, i) => {
  try {
    new vm.Script(code);
  } catch (err) {
    assert.fail(`Syntax error in <script> block ${i + 1}: ${err.message}`);
  }
});
console.log(`PASS: Syntax checked ${scripts.length} inline scripts with zero errors.`);

// 4. Test Sandbox Execution
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
    remove: function () {},
    setAttribute: () => {},
    getAttribute: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
    scrollIntoView: () => {},
    click: () => {},
    focus: () => {},
    select: () => {}
  };
}

const toastMessages = [];
const sandbox = {
  console,
  setTimeout: (fn) => fn(),
  clearTimeout: () => {},
  setInterval: () => {},
  clearInterval: () => {},
  localStorage: mockLocalStorage,
  window: {
    location: { origin: 'http://localhost', pathname: '/catalogue/' },
    addEventListener: () => {},
    dispatchEvent: () => true,
    scrollTo: () => {},
    open: () => {}
  },
  document: {
    getElementById: (id) => {
      if (!domRegistry.has(id)) domRegistry.set(id, makeEl(id));
      return domRegistry.get(id);
    },
    querySelector: (sel) => null,
    querySelectorAll: (sel) => {
      if (sel === '.record-box-count') {
        return [domRegistry.get('recordBoxBadgeCount'), domRegistry.get('mobileRecordBoxBadge'), domRegistry.get('mobileQuickStripBoxBadge')].filter(Boolean);
      }
      return [];
    },
    addEventListener: () => {},
    createElement: (tag) => makeEl('', tag.toUpperCase()),
    body: makeEl('body', 'BODY')
  },
  CustomEvent: class { constructor(type, detail) { this.type = type; this.detail = detail; } },
  showToast: (msg) => { toastMessages.push(msg); }
};

vm.createContext(sandbox);
vm.runInContext(mainScript, sandbox);

// Seed records, crates, and saved sets
vm.runInContext(`
  records = [
    {
      id: 'rec_1',
      artist: 'Massive Attack',
      title: 'Blue Lines',
      format: '12" LP (Album)',
      speed: '33 1/3 RPM',
      year: 1991,
      tracklist: [
        { position: 'A1', title: 'Safe from Harm', duration: '05:18' },
        { position: 'A2', title: 'One Love', duration: '04:48' }
      ]
    },
    {
      id: 'rec_2',
      artist: 'Portishead',
      title: 'Dummy',
      format: '12" LP (Album)',
      speed: '33 1/3 RPM',
      year: 1994,
      tracklist: [
        { position: 'A1', title: 'Mysterons', duration: '05:02' },
        { position: 'A2', title: 'Sour Times', duration: '04:11' }
      ]
    }
  ];
`, sandbox);

// Create sample crate
const testCrate = sandbox.createQmcCrate('Bristol Downtempo', 'Trip-hop essentials', ['rec_1', 'rec_2']);
assert.ok(testCrate.crate_id);

// Create sample saved set
const testSet = sandbox.saveActiveSet('Friday Night Vinyl Session', [
  { position: 1, record_id: 'rec_1', artist: 'Massive Attack', title: 'Safe from Harm', side_index: 'A1', duration: '05:18', rpm: '33 1/3 RPM', cue_note: 'Intro cue' },
  { position: 2, record_id: 'rec_2', artist: 'Portishead', title: 'Sour Times', side_index: 'A2', duration: '04:11', rpm: '33 1/3 RPM', cue_note: 'Crossfade at 4:30' }
]);
assert.ok(testSet.set_id);

// 5. Test switchView('crates') and renderCratesView
sandbox.switchView('crates');
assert.equal(vm.runInContext('currentView', sandbox), 'crates');
const cratesContainer = sandbox.document.getElementById('recordsViewContainer');
assert.ok(cratesContainer.innerHTML.includes('Bristol Downtempo'), 'Crates view must render Bristol Downtempo');
assert.ok(cratesContainer.innerHTML.includes('Trip-hop essentials'), 'Crates view must render crate description');
assert.ok(cratesContainer.innerHTML.includes('packCrateIntoRecordBox'), 'Crates view must include packCrateIntoRecordBox action');

// Test packCrateIntoRecordBox
sandbox.packCrateIntoRecordBox(testCrate.crate_id);
assert.equal(sandbox.isRecordInBox('rec_1'), true, 'rec_1 must be in Record Box after packing crate');
assert.equal(sandbox.isRecordInBox('rec_2'), true, 'rec_2 must be in Record Box after packing crate');
console.log('PASS: Thematic Crates dashboard view & 1-click pack into Record Box verified.');

// 6. Test switchView('sets') and renderSetsView
sandbox.switchView('sets');
assert.equal(vm.runInContext('currentView', sandbox), 'sets');
const setsContainer = sandbox.document.getElementById('recordsViewContainer');
assert.ok(setsContainer.innerHTML.includes('Friday Night Vinyl Session'), 'Sets view must render Friday Night Vinyl Session');
assert.ok(setsContainer.innerHTML.includes('Safe from Harm'), 'Sets view must preview track sequence');
assert.ok(setsContainer.innerHTML.includes('loadSavedSetIntoBuilder'), 'Sets view must include loadSavedSetIntoBuilder action');
console.log('PASS: Saved Sets dashboard view & track sequence previews verified.');

// 7. Test loadSavedSetIntoBuilder
sandbox.loadSavedSetIntoBuilder(testSet.set_id);
const activeSet = vm.runInContext('activeSetState', sandbox);
assert.equal(activeSet.title, 'Friday Night Vinyl Session');
assert.equal(activeSet.tracks.length, 2);
assert.equal(sandbox.document.getElementById('recordBoxDrawer').classList.contains('hidden'), false, 'loadSavedSetIntoBuilder must open drawer');
console.log('PASS: Loading saved set into Set Builder workspace verified.');

// 8. Test exportSetToSpotify
mockStorage.set('spotify_demo_connected', 'true');
mockStorage.set('spotify_access_token', 'demo_token_123');
mockStorage.set('spotify_token_expires_at', String(Date.now() + 3600000));

const exportResult = await sandbox.exportSetToSpotify(testSet.set_id);
assert.ok(exportResult, 'exportSetToSpotify must return result');
assert.ok(exportResult.spotify_playlist_url, 'Exported set must have spotify_playlist_url');

const updatedSets = sandbox.getQmcSavedSets();
const verifiedExportedSet = updatedSets.find(s => s.set_id === testSet.set_id);
assert.ok(verifiedExportedSet.spotify_playlist_url, 'Persisted set must retain spotify_playlist_url');
console.log('PASS: Spotify Set export pipeline verified.');

console.log('=== ALL PHASE 4 & PHASE 5 VERIFICATIONS PASSED 100% ===');
