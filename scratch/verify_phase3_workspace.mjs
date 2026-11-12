// verify_phase3_workspace.mjs
// Verification suite for Phase 3: Record Box & Set Builder Workspace Drawer

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const htmlPath = path.resolve('c:/Users/steve/QMC-web/catalogue/index.html');
const rawHtml = fs.readFileSync(htmlPath, 'utf8');

console.log('=== VERIFYING PHASE 3: RECORD BOX & SET BUILDER WORKSPACE ===');

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

// 2. Phase 3 Essential IDs
const requiredPhase3Ids = [
  'recordBoxDrawer',
  'recordBoxDrawerContent',
  'recordBoxPane',
  'recordBoxList',
  'setBuilderPane',
  'activeSetTitleInput',
  'activeSetTimeline',
  'activeSetTrackCount',
  'activeSetRuntime'
];

requiredPhase3Ids.forEach(id => {
  assert.ok(staticIds.has(id), `Missing required Phase 3 DOM ID: ${id}`);
});
console.log('PASS: All required Phase 3 DOM elements exist.');

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
    remove: function () { },
    setAttribute: () => { },
    getAttribute: () => null,
    addEventListener: () => { },
    removeEventListener: () => { },
    scrollIntoView: () => { },
    click: () => { },
    focus: () => { }
  };
}

const toastMessages = [];
const sandbox = {
  console,
  setTimeout: (fn) => fn(),
  clearTimeout: () => { },
  setInterval: () => { },
  clearInterval: () => { },
  localStorage: mockLocalStorage,
  window: {
    location: { origin: 'http://localhost', pathname: '/catalogue/' },
    addEventListener: () => { },
    dispatchEvent: () => true,
    scrollTo: () => { }
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
    addEventListener: () => { },
    createElement: (tag) => makeEl('', tag.toUpperCase()),
    body: makeEl('body', 'BODY')
  },
  CustomEvent: class { constructor(type, detail) { this.type = type; this.detail = detail; } },
  showToast: (msg) => { toastMessages.push(msg); }
};

vm.createContext(sandbox);
vm.runInContext(mainScript, sandbox);

// Seed records in VM sandbox
vm.runInContext(`
  records = [
    {
      id: 'rec_davis',
      artist: 'Miles Davis',
      title: 'Kind of Blue',
      format: '12" LP (Album)',
      speed: '33 1/3 RPM',
      year: 1959,
      tracklist: [
        { position: 'A1', title: 'So What', duration: '09:22' },
        { position: 'A2', title: 'Freddie Freeloader', duration: '09:46' },
        { position: 'B1', title: 'Blue in Green', duration: '05:37' }
      ]
    },
    {
      id: 'rec_madness',
      artist: 'Madness',
      title: 'Wings Of A Dove',
      format: '7" Single (45 RPM)',
      speed: '45 RPM',
      year: 1983,
      tracklist: [
        { position: 'A', title: 'Wings Of A Dove', duration: '03:02' },
        { position: 'B', title: 'Behind The 8 Ball', duration: '03:00' }
      ]
    }
  ];
`, sandbox);

// 5. Test openRecordBoxDrawer / closeRecordBoxDrawer
sandbox.openRecordBoxDrawer();
const drawer = sandbox.document.getElementById('recordBoxDrawer');
assert.equal(drawer.classList.contains('hidden'), false, 'openRecordBoxDrawer must display #recordBoxDrawer');

// 6. Test Record Box packing & rendering
sandbox.addRecordToBox('rec_davis');
sandbox.addRecordToBox('rec_madness');
sandbox.renderRecordBoxDrawer();

const boxListHtml = sandbox.document.getElementById('recordBoxList').innerHTML;
assert.ok(boxListHtml.includes('Kind of Blue'), 'Record Box list must render Kind of Blue');
assert.ok(boxListHtml.includes('Wings Of A Dove'), 'Record Box list must render Wings Of A Dove');
assert.ok(boxListHtml.includes('45 RPM'), 'Record Box list must prominently display 45 RPM tag');
console.log('PASS: Record Box list rendering & RPM tags verified.');

// 7. Test tracklist expansion and adding tracks to Active Set
sandbox.toggleRecordBoxTracklist('rec_davis');
sandbox.renderRecordBoxDrawer();
const expandedBoxHtml = sandbox.document.getElementById('recordBoxList').innerHTML;
assert.ok(expandedBoxHtml.includes('So What'), 'Expanded release must show track title So What');

// Add track A1 to Set
const davisRecord = vm.runInContext('records', sandbox)[0];
sandbox.addTrackToActiveSet('rec_davis', davisRecord.tracklist[0]);
sandbox.addTrackToActiveSet('rec_madness', vm.runInContext('records', sandbox)[1].tracklist[0]);

const timelineHtml = sandbox.document.getElementById('activeSetTimeline').innerHTML;
assert.ok(timelineHtml.includes('So What'), 'Set timeline must render So What');
assert.ok(timelineHtml.includes('Wings Of A Dove'), 'Set timeline must render Wings Of A Dove');
assert.ok(timelineHtml.includes('A1'), 'Set timeline must show physical cue badge [A1]');
console.log('PASS: Pushing tracks from Record Box into Active Set timeline verified.');

// 8. Test Timeline Reordering & Cue Notes
sandbox.moveTrackInActiveSet(1, 0); // Move Madness to 1st position
let currentActiveSet = vm.runInContext('activeSetState', sandbox);
assert.equal(currentActiveSet.tracks[0].title, 'Wings Of A Dove', 'Wings Of A Dove must now be in position 1');

sandbox.updateTrackCueNote(0, 'Pitch +1.5%, watch 45 RPM speed switch!');
currentActiveSet = vm.runInContext('activeSetState', sandbox);
assert.equal(currentActiveSet.tracks[0].cue_note, 'Pitch +1.5%, watch 45 RPM speed switch!');
console.log('PASS: Reordering track timeline & inline cue notes verified.');

// 9. Test Runtime Calculation
const runtime = sandbox.calculateActiveSetRuntime();
// 03:02 + 09:22 = 12:24
assert.equal(runtime, '12:24', `Runtime calculation must equal 12:24, got ${runtime}`);
console.log('PASS: Active set dynamic runtime calculator verified.');

// 10. Test Save Set & Save Box as Crate
vm.runInContext("activeSetState.title = 'Weekend Vinyl Session'; document.getElementById('activeSetTitleInput').value = 'Weekend Vinyl Session';", sandbox);
sandbox.saveCurrentActiveSet();
const savedSets = sandbox.getQmcSavedSets();
assert.equal(savedSets.length, 1, 'saveCurrentActiveSet must persist 1 set');
assert.equal(savedSets[0].title, 'Weekend Vinyl Session');
assert.equal(savedSets[0].tracks.length, 2);

sandbox.saveRecordBoxAsCrate('Session Crate');
const crates = sandbox.getQmcCrates();
assert.ok(crates.some(c => c.name === 'Session Crate'), 'saveRecordBoxAsCrate must create new crate');
console.log('PASS: Set persistence & Save Box as Crate verified.');

// 11. Test closeAllModals includes recordBoxDrawer
sandbox.closeAllModals();
assert.ok(drawer.classList.contains('hidden'), 'closeAllModals must close recordBoxDrawer');

console.log('=== ALL PHASE 3 VERIFICATIONS PASSED 100% ===');
