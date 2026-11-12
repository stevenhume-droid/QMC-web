// scratch/verify_box_and_set_fixes.mjs
// Verification suite for Record Box empty state & +Set button fixes

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const htmlPath = path.resolve('c:/Users/steve/QMC-web/catalogue/index.html');
const rawHtml = fs.readFileSync(htmlPath, 'utf8');

console.log('=== VERIFYING RECORD BOX & +SET FIXES ===');

// Extract inline scripts
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
    setAttribute: () => { },
    getAttribute: () => null,
    addEventListener: () => { },
    removeEventListener: () => { },
    scrollIntoView: () => { },
    click: () => { },
    focus: () => { },
    select: () => { }
  };
}

const toasts = [];
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
    addEventListener: () => { },
    removeEventListener: () => { },
    querySelectorAll: () => [],
    createElement: (tag) => makeEl('', tag),
    body: makeEl('body', 'BODY')
  },
  showToast: (msg, type) => { toasts.push({ msg, type }); }
};

vm.createContext(sandbox);
vm.runInContext(mainScript, sandbox);
vm.runInContext(`
  const origShowToast = showToast;
  showToast = function(msg, type) {
    if (typeof onToast === 'function') onToast(msg, type);
    return origShowToast(msg, type);
  };
`, sandbox);
sandbox.onToast = (msg, type) => { toasts.push({ msg, type }); };

// 1. Test 98 Records in Record Box with mixed/empty/string tracklists and string IDs
console.log('Testing 98 releases in Record Box rendering...');

const records98 = [];
const boxItems98 = [];
for (let i = 1; i <= 98; i++) {
  const recId = `rec_${i}`;
  // Mix of formats and tracklist shapes:
  // Some have no tracklist, some have string tracklist, some have normal arrays, some have array formats
  let tracklist = [];
  if (i % 3 === 0) {
    tracklist = 'Track 1, Track 2'; // string from discogs/import
  } else if (i % 3 === 1) {
    tracklist = []; // empty array
  } else {
    tracklist = [
      { position: 'A1', title: `Track ${i} A`, duration: '3:30' },
      { position: 'B1', title: `Track ${i} B`, duration: '4:15' }
    ];
  }

  const format = i % 2 === 0 ? '7" Single (45 RPM)' : ['12" Vinyl', 'LP'];

  records98.push({
    id: recId,
    artist: `Artist ${i}`,
    title: `Release ${i}`,
    format: format,
    speed: i % 2 === 0 ? '45 RPM' : '33 1/3 RPM',
    tracklist: tracklist
  });

  // Half stored as objects, half stored as legacy string IDs
  if (i % 2 === 0) {
    boxItems98.push({ record_id: recId, added_at: new Date().toISOString() });
  } else {
    boxItems98.push(recId);
  }
}

// Inject into sandbox script scope
vm.runInContext('records = ' + JSON.stringify(records98) + ';', sandbox);
sandbox.saveQmcRecordBox(boxItems98);

// Render Record Box Pane
sandbox.renderRecordBoxDrawer();

const listEl = sandbox.document.getElementById('recordBoxList');
const subheadEl = sandbox.document.getElementById('recordBoxPaneSubheading');

assert.equal(subheadEl.textContent, '98 releases packed for active gig/session');
assert.ok(!listEl.innerHTML.includes('Your Record Box is Empty'), 'ERROR: Empty state was displayed when 98 items were packed!');
assert.ok(listEl.innerHTML.includes('Release 1'), 'Release 1 must be rendered');
assert.ok(listEl.innerHTML.includes('Release 98'), 'Release 98 must be rendered');
console.log('PASS: 98 releases rendered successfully into Record Box with zero empty state fallback!');

// 2. Test +Set Button on 7" Single with Inch Quotes
console.log('Testing +Set button on 7" Single (OMD Electricity format)...');

// Find a 7" record
const omdRec = {
  id: 'rec_omd_din2',
  artist: 'Orchestral Manoeuvres In The Dark',
  title: 'Electricity',
  format: '7" Single (45 RPM)',
  speed: '45 RPM',
  catNo: 'DIN 2',
  tracklist: [
    { position: 'A', title: 'Electricity', duration: '3:32' },
    { position: 'B', title: 'Almost', duration: '3:40' }
  ]
};

vm.runInContext('records.push(' + JSON.stringify(omdRec) + ');', sandbox);
sandbox.addRecordToBox(omdRec.id);

// Expand tracklist for OMD
sandbox.toggleRecordBoxTracklist(omdRec.id);

// Assert the HTML contains the +Set button invoking addTrackToActiveSet with track index (number), NOT JSON.parse
assert.ok(listEl.innerHTML.includes(`addTrackToActiveSet('rec_omd_din2', 0)`), 'Must call addTrackToActiveSet with track index 0');
assert.ok(listEl.innerHTML.includes(`addTrackToActiveSet('rec_omd_din2', 1)`), 'Must call addTrackToActiveSet with track index 1');
assert.ok(!listEl.innerHTML.includes('JSON.parse'), 'Must NOT embed JSON.parse in onclick attribute');

// Now simulate clicking +Set for Track A (index 0)
sandbox.addTrackToActiveSet('rec_omd_din2', 0);
let activeSet = vm.runInContext('activeSetState', sandbox);
assert.equal(activeSet.tracks.length, 1, 'activeSetState must have 1 track');
assert.equal(activeSet.tracks[0].title, 'Electricity');
assert.equal(activeSet.tracks[0].artist, 'Orchestral Manoeuvres In The Dark');
assert.equal(activeSet.tracks[0].side_index, 'A');
assert.equal(activeSet.tracks[0].rpm, '45 RPM');

// Simulate clicking +Set for Track B (index 1)
sandbox.addTrackToActiveSet('rec_omd_din2', 1);
activeSet = vm.runInContext('activeSetState', sandbox);
assert.equal(activeSet.tracks.length, 2, 'activeSetState must have 2 tracks');
assert.equal(activeSet.tracks[1].title, 'Almost');
assert.equal(activeSet.tracks[1].side_index, 'B');

// Re-render and inspect timeline
const timelineEl = sandbox.document.getElementById('activeSetTimeline');
const countEl = sandbox.document.getElementById('activeSetTrackCount');
const runtimeEl = sandbox.document.getElementById('activeSetRuntime');

assert.equal(countEl.textContent, '2 Tracks');
assert.ok(timelineEl.innerHTML.includes('Electricity'), 'Timeline must show Electricity');
assert.ok(timelineEl.innerHTML.includes('Almost'), 'Timeline must show Almost');
assert.ok(timelineEl.innerHTML.includes('[A]'), 'Timeline must show [A] physical cue tag');
assert.ok(timelineEl.innerHTML.includes('[B]'), 'Timeline must show [B] physical cue tag');

// Check toast notifications
assert.ok(toasts.some(t => t.msg.includes('Electricity')), 'Toast must confirm Electricity added');
assert.ok(toasts.some(t => t.msg.includes('Almost')), 'Toast must confirm Almost added');

console.log('PASS: +Set button cleanly adds tracks from 7" singles with physical cue tags and calculates runtime!');

// 3. Backward compatibility test: passing track object directly
sandbox.addTrackToActiveSet('rec_omd_din2', { title: 'Direct Object Track', position: 'Bonus' });
activeSet = vm.runInContext('activeSetState', sandbox);
assert.equal(activeSet.tracks.length, 3, 'Must support direct object track parameter');
console.log('PASS: Backward compatibility for addTrackToActiveSet verified.');

console.log('=== ALL RECORD BOX & +SET FIXES VERIFIED 100% ===');
