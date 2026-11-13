// scratch/verify_box_compaction.mjs
// Verification suite for:
// 1. Compacting Record Box when sorting a set for maximum screen real estate
// 2. View mode switching (Split vs Set Focus vs Box Focus)
// 3. Ensuring no duplicate static HTML element IDs in catalogue/index.html

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const htmlPath = path.resolve('c:/Users/steve/QMC-web/catalogue/index.html');
const rawHtml = fs.readFileSync(htmlPath, 'utf8');

console.log('=== VERIFYING RECORD BOX COMPACTION & SET SORTING SCREEN REAL ESTATE ===\n');

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

// Test 2: Check required elements exist in raw HTML
console.log('Test 2: Compaction UI DOM elements existence check...');
const requiredIds = [
  'recordBoxSplitBody',
  'recordBoxPane',
  'recordBoxList',
  'setBuilderPane',
  'activeSetTimeline',
  'btnDrawerModeSplit',
  'btnDrawerModeSetFocus',
  'btnCompactRecordBox',
  'btnSetBuilderMaximize'
];
requiredIds.forEach(id => {
  assert.ok(rawHtml.includes(`id="${id}"`), `Element id="${id}" must exist in HTML`);
});
console.log(`  ✓ All ${requiredIds.length} required compaction UI elements exist.`);

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
  showToast: () => {},
  alert: () => {},
  confirm: () => true
};

vm.createContext(sandbox);
vm.runInContext(mainScript, sandbox);

console.log('Test 3: Function availability checks...');
assert.equal(typeof sandbox.setRecordBoxDrawerMode, 'function', 'setRecordBoxDrawerMode must be defined');
assert.equal(typeof sandbox.toggleRecordBoxCompaction, 'function', 'toggleRecordBoxCompaction must be defined');
assert.equal(typeof sandbox.applyRecordBoxDrawerMode, 'function', 'applyRecordBoxDrawerMode must be defined');
console.log('  ✓ setRecordBoxDrawerMode, toggleRecordBoxCompaction, and applyRecordBoxDrawerMode are defined.');

console.log('Test 4: Compacting Record Box to maximize Set Builder space...');
// Seed DOM elements
const splitBody = getOrCreateEl('recordBoxSplitBody');
const boxPane = getOrCreateEl('recordBoxPane');
const boxList = getOrCreateEl('recordBoxList');
const setPane = getOrCreateEl('setBuilderPane');
const subhead = getOrCreateEl('recordBoxPaneSubheading');
const compactBtn = getOrCreateEl('btnCompactRecordBox');
const compactLabel = getOrCreateEl('btnCompactRecordBoxLabel');
const setMaxBtn = getOrCreateEl('btnSetBuilderMaximize');
const setMaxLabel = getOrCreateEl('btnSetBuilderMaximizeLabel');

// Switch to 'set-focus' mode (compact record box)
sandbox.setRecordBoxDrawerMode('set-focus');

assert.ok(boxList.classList.contains('hidden'), 'Record Box list must be hidden when compacted');
assert.ok(boxPane.className.includes('h-auto shrink-0'), 'Record Box pane must shrink to header height');
assert.ok(setPane.className.includes('flex-1'), 'Set Builder pane must expand to fill 100% remaining space');
assert.equal(compactLabel.textContent, 'Expand', 'Compact button label should become Expand');
assert.equal(setMaxLabel.textContent, 'Split', 'Set Builder maximize button should indicate return to Split');
console.log('  ✓ Set Focus successfully compacts Record Box and maximizes Set Builder real estate.');

console.log('Test 5: Toggling back to Split View...');
sandbox.toggleRecordBoxCompaction();

assert.ok(!boxList.classList.contains('hidden'), 'Record Box list must be visible in split mode');
assert.ok(boxPane.className.includes('h-full min-h-0'), 'Record Box pane must restore full height in split view');
assert.ok(splitBody.className.includes('grid-cols-1 lg:grid-cols-2'), 'Split body must restore 2-column grid layout');
assert.equal(compactLabel.textContent, 'Compact', 'Compact button label should read Compact');
assert.equal(setMaxLabel.textContent, 'Maximize', 'Set Builder button label should read Maximize');
console.log('  ✓ Toggle cleanly restores Split View.');

console.log('Test 6: openRecordBoxDrawer("sets") automatically opens in Set Focus mode...');
getOrCreateEl('recordBoxDrawer');
sandbox.openRecordBoxDrawer('sets');

const currentMode = vm.runInContext('recordBoxDrawerMode', sandbox);
assert.equal(currentMode, 'set-focus', 'openRecordBoxDrawer("sets") must default to set-focus mode');
assert.ok(boxList.classList.contains('hidden'), 'Record Box list must be compacted on sets launch');
console.log('  ✓ Launching Set Builder automatically sets Set Focus mode for maximum sorting space.');

console.log('\n=== ALL RECORD BOX COMPACTION TESTS PASSED (6/6) ===');
