import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const htmlPath = 'c:/Users/steve/QMC-web/catalogue/index.html';
const html = fs.readFileSync(htmlPath, 'utf8');

console.log('=== VERIFYING PHASE 1: TERMINOLOGY & SCHEMA FOUNDATIONS ===');

// 1. Terminology check
const lowerHtml = html.toLowerCase();
assert.ok(!lowerHtml.includes('total crate'), 'Term "Total Crate" must be replaced with "Total Archive"');
assert.ok(!lowerHtml.includes('cloud crate'), 'Term "Cloud Crate" / "cloud crate" must be replaced with "Cloud Archive"');
assert.ok(html.includes('Total Archive'), 'UI must include "Total Archive"');
assert.ok(html.includes('Cloud Archive'), 'UI must include "Cloud Archive"');
console.log('PASS: Terminology check — zero "Total Crate" or "cloud crate" references found.');

// 2. Syntax check inline scripts
const scriptRegex = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let match;
const inlineScripts = [];
let scriptIdx = 0;
while ((match = scriptRegex.exec(html)) !== null) {
  scriptIdx++;
  const code = match[1];
  inlineScripts.push({ idx: scriptIdx, code });
  try {
    new vm.Script(code, { filename: `inline-script-${scriptIdx}.js` });
  } catch (err) {
    console.error(`SYNTAX ERROR in inline script #${scriptIdx}:`, err);
    process.exit(1);
  }
}
console.log(`PASS: Syntax checked ${inlineScripts.length} inline scripts with zero errors.`);

// 3. Execution & logic test in VM sandbox
const mainScript = inlineScripts[inlineScripts.length - 1].code;
const store = new Map();
const mockLocalStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => { store.clear(); }
};

const domRegistry = new Map();
function makeEl(id = '', tagName = 'DIV') {
  const clsSet = new Set();
  const attrs = {};
  return {
    id,
    tagName,
    value: '',
    checked: true,
    innerText: '',
    textContent: '',
    innerHTML: '',
    style: {},
    classList: {
      add: (...c) => c.forEach(x => clsSet.add(x)),
      remove: (...c) => c.forEach(x => clsSet.delete(x)),
      contains: (c) => clsSet.has(c)
    },
    setAttribute: (k, v) => { attrs[k] = v; },
    getAttribute: (k) => attrs[k] ?? null,
    appendChild: () => { },
    remove: () => { },
    click: () => { }
  };
}

const sandbox = {
  console,
  setTimeout: () => { },
  clearTimeout: () => { },
  setInterval: () => { },
  clearInterval: () => { },
  localStorage: mockLocalStorage,
  window: {
    location: { origin: 'http://localhost', pathname: '/catalogue/' },
    addEventListener: () => { },
    dispatchEvent: () => true
  },
  document: {
    getElementById: (id) => {
      if (!domRegistry.has(id)) domRegistry.set(id, makeEl(id));
      return domRegistry.get(id);
    },
    querySelectorAll: () => [],
    addEventListener: () => { },
    createElement: (tag) => makeEl('', tag.toUpperCase()),
    body: makeEl('body', 'BODY')
  },
  CustomEvent: class { constructor(type, detail) { this.type = type; this.detail = detail; } },
  showToast: () => { }
};

vm.createContext(sandbox);
vm.runInContext(mainScript, sandbox);

// 4. Test Crates engine
assert.equal(typeof sandbox.getQmcCrates, 'function', 'getQmcCrates must exist');
assert.equal(typeof sandbox.createQmcCrate, 'function', 'createQmcCrate must exist');
assert.equal(typeof sandbox.addRecordToCrate, 'function', 'addRecordToCrate must exist');
assert.equal(typeof sandbox.removeRecordFromCrate, 'function', 'removeRecordFromCrate must exist');
assert.equal(typeof sandbox.deleteQmcCrate, 'function', 'deleteQmcCrate must exist');

const crate1 = sandbox.createQmcCrate('90s Trip-Hop', 'Bristol & London sounds', ['rec_1', 'rec_2']);
assert.ok(crate1.crate_id, 'crate must have unique crate_id');
assert.equal(crate1.name, '90s Trip-Hop');
assert.equal(crate1.record_ids.length, 2);

sandbox.addRecordToCrate(crate1.crate_id, 'rec_3');
let loadedCrates = sandbox.getQmcCrates();
let targetCrate = loadedCrates.find(c => c.crate_id === crate1.crate_id);
assert.equal(targetCrate.record_ids.length, 3, 'addRecordToCrate must append record');

sandbox.removeRecordFromCrate(crate1.crate_id, 'rec_2');
loadedCrates = sandbox.getQmcCrates();
targetCrate = loadedCrates.find(c => c.crate_id === crate1.crate_id);
assert.equal(targetCrate.record_ids.length, 2, 'removeRecordFromCrate must remove record');
assert.ok(!targetCrate.record_ids.includes('rec_2'));

console.log('PASS: Thematic Crates engine verified.');

// 5. Test Active Record Box engine
assert.equal(typeof sandbox.getQmcRecordBox, 'function', 'getQmcRecordBox must exist');
assert.equal(typeof sandbox.addRecordToBox, 'function', 'addRecordToBox must exist');
assert.equal(typeof sandbox.removeRecordFromBox, 'function', 'removeRecordFromBox must exist');
assert.equal(typeof sandbox.isRecordInBox, 'function', 'isRecordInBox must exist');
assert.equal(typeof sandbox.clearRecordBox, 'function', 'clearRecordBox must exist');

sandbox.addRecordToBox('rec_10', 'Bring 45 RPM adapter');
assert.ok(sandbox.isRecordInBox('rec_10'), 'isRecordInBox must return true');
assert.ok(!sandbox.isRecordInBox('rec_999'), 'isRecordInBox must return false for missing record');

let box = sandbox.getQmcRecordBox();
assert.equal(box.length, 1);
assert.equal(box[0].box_note, 'Bring 45 RPM adapter');

sandbox.removeRecordFromBox('rec_10');
assert.ok(!sandbox.isRecordInBox('rec_10'), 'removeRecordFromBox must clear record');
assert.equal(sandbox.getQmcRecordBox().length, 0);

console.log('PASS: Active Record Box working bag engine verified.');

// 6. Test Saved Sets engine
assert.equal(typeof sandbox.getQmcSavedSets, 'function', 'getQmcSavedSets must exist');
assert.equal(typeof sandbox.saveActiveSet, 'function', 'saveActiveSet must exist');
assert.equal(typeof sandbox.deleteSavedSet, 'function', 'deleteSavedSet must exist');

const savedSet = sandbox.saveActiveSet('Warmup Vinyl Set', [
  { position: 1, record_id: 'rec_1', artist: 'Portishead', title: 'Mysterons', side_index: 'A1', duration: '5:02', bpm: '76', rpm: '33 1/3 RPM' },
  { position: 2, record_id: 'rec_2', artist: 'Massive Attack', title: 'Teardrop', side_index: 'A3', duration: '5:31', bpm: '77', rpm: '33 1/3 RPM' }
], 'Sub-bass test');

assert.ok(savedSet.set_id, 'Set must receive unique set_id');
assert.equal(savedSet.tracks.length, 2);
assert.equal(savedSet.tracks[0].position, 1);
assert.equal(savedSet.tracks[1].position, 2);

const loadedSets = sandbox.getQmcSavedSets();
assert.equal(loadedSets.length, 1);

console.log('PASS: Saved Sets sequencing engine verified.');

// 7. Test Export / Import JSON Envelope
let exportedJsonString = null;
sandbox.document.createElement = (tag) => {
  const el = makeEl('', tag.toUpperCase());
  if (tag.toUpperCase() === 'A') {
    el.setAttribute = (k, v) => {
      if (k === 'href' && v.startsWith('data:text/json;charset=utf-8,')) {
        exportedJsonString = decodeURIComponent(v.replace('data:text/json;charset=utf-8,', ''));
      }
    };
  }
  return el;
};

sandbox.exportToJSON();
assert.ok(exportedJsonString, 'exportToJSON must generate data URL');
const parsedBackup = JSON.parse(exportedJsonString);
assert.equal(parsedBackup.version, 2, 'Backup must have version 2');
assert.ok(Array.isArray(parsedBackup.records), 'Backup must include records array');
assert.ok(Array.isArray(parsedBackup.crates), 'Backup must include crates array');
assert.ok(Array.isArray(parsedBackup.recordBox), 'Backup must include recordBox array');
assert.ok(Array.isArray(parsedBackup.savedSets), 'Backup must include savedSets array');
assert.equal(parsedBackup.savedSets.length, 1);

console.log('PASS: JSON v2 Backup envelope verified.');
console.log('=== ALL PHASE 1 VERIFICATIONS PASSED 100% ===');
