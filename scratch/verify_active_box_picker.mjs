// verify_active_box_picker.mjs
// Verification suite for Active Box Picker, Multi-Box Selection, and Crate-to-Box Activation

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const htmlPath = path.resolve('c:/Users/steve/QMC-web/catalogue/index.html');
const rawHtml = fs.readFileSync(htmlPath, 'utf8');

console.log('=== VERIFYING ACTIVE BOX PICKER & MULTI-BOX SELECTION ===');

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

// 2. Required Active Box Picker IDs
assert.ok(staticIds.has('activeBoxSelectPicker'), 'activeBoxSelectPicker must exist in HTML');
assert.ok(staticIds.has('btnRecordBoxNewBox'), 'btnRecordBoxNewBox must exist in HTML');
assert.ok(staticIds.has('activeBoxTitleInput'), 'activeBoxTitleInput must exist in HTML');
console.log('PASS: activeBoxSelectPicker, btnRecordBoxNewBox, and activeBoxTitleInput exist in Record Box pane.');

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

// 4. Test Multi-Box Switching & Crate Activation in Sandbox
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
    options: [{}],
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
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    createElement: (tag) => makeEl('', tag.toUpperCase()),
    body: makeEl('body', 'BODY')
  },
  CustomEvent: class { constructor(type, detail) { this.type = type; this.detail = detail; } },
  showToast: () => {}
};

vm.createContext(sandbox);
vm.runInContext(mainScript, sandbox);

// Seed sample records
vm.runInContext(`
  records = [
    { id: 'rec_1', artist: 'Massive Attack', title: 'Blue Lines', format: '12" LP (Album)', speed: '33 1/3 RPM', year: 1991, tracklist: [] },
    { id: 'rec_2', artist: 'Portishead', title: 'Dummy', format: '12" LP (Album)', speed: '33 1/3 RPM', year: 1994, tracklist: [] },
    { id: 'rec_3', artist: 'Aphex Twin', title: 'Selected Ambient Works', format: '12" LP (Album)', speed: '33 1/3 RPM', year: 1992, tracklist: [] }
  ];
`, sandbox);

// Create Box A and pack rec_1
const boxA = sandbox.createNewActiveBoxPrompt('Friday Club Box');
assert.equal(boxA.title, 'Friday Club Box');
const boxAId = boxA.id;
sandbox.addRecordToBox('rec_1');
assert.equal(sandbox.isRecordInBox('rec_1'), true, 'rec_1 should be in Box A');
assert.equal(sandbox.isRecordInBox('rec_2'), false, 'rec_2 should not be in Box A');

// Create Box B and pack rec_2
const boxB = sandbox.createNewActiveBoxPrompt('Sunday Chill Box');
assert.equal(boxB.title, 'Sunday Chill Box');
const boxBId = boxB.id;
assert.equal(sandbox.isRecordInBox('rec_1'), false, 'Switching to new Box B must make Box B active (rec_1 not in Box B)');
sandbox.addRecordToBox('rec_2');
assert.equal(sandbox.isRecordInBox('rec_2'), true, 'rec_2 should be in Box B');

// Switch back to Box A via handleActiveBoxPickerChange
sandbox.handleActiveBoxPickerChange(boxAId);
const activeAfterSwitch = vm.runInContext('activeBoxState', sandbox);
assert.equal(activeAfterSwitch.id, boxAId, 'Active box ID must be Box A');
assert.equal(activeAfterSwitch.title, 'Friday Club Box', 'Active box title must be Friday Club Box');
assert.equal(sandbox.isRecordInBox('rec_1'), true, 'rec_1 must be active again when Box A is selected');
assert.equal(sandbox.isRecordInBox('rec_2'), false, 'rec_2 must not be in Box A');
console.log('PASS: Multi-box creation and switching accurately swaps active Box records.');

// Test picking a Thematic Crate as the Active Box
const testCrate = sandbox.createQmcCrate('Ambient Classics', 'Late night ambient', ['rec_3']);
sandbox.handleActiveBoxPickerChange('CRATE::' + testCrate.crate_id);
const activeCrateBox = vm.runInContext('activeBoxState', sandbox);
assert.equal(activeCrateBox.crate_id, testCrate.crate_id, 'Active box must link to crate_id');
assert.equal(activeCrateBox.title, 'Ambient Classics', 'Active box title must match crate name');
assert.equal(sandbox.isRecordInBox('rec_3'), true, 'rec_3 from crate must be in active Box');
assert.equal(sandbox.isRecordInBox('rec_1'), false, 'rec_1 from previous box must not be in active Box');
console.log('PASS: Picking a Thematic Crate activates it as the selected Record Box.');

// Test adding a record while a Crate is active updates the linked Crate too
sandbox.addRecordToBox('rec_2');
const updatedCrate = sandbox.getQmcCrates().find(c => c.crate_id === testCrate.crate_id);
assert.ok(updatedCrate.record_ids.includes('rec_2'), 'Packing a record into an active Crate-linked Box updates the Crate');
console.log('PASS: Packing records into an active Crate-linked Box syncs with the Thematic Crate.');

console.log('=== ALL ACTIVE BOX PICKER VERIFICATIONS PASSED 100% ===');
