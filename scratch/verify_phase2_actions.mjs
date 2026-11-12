import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const htmlPath = 'c:/Users/steve/QMC-web/catalogue/index.html';
const html = fs.readFileSync(htmlPath, 'utf8');

console.log('=== VERIFYING PHASE 2: CRATES & RECORD BOX ACTIONS ===');

// 1. Static HTML ID uniqueness and presence of Phase 2 DOM elements
const htmlWithoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, '');
const idAttrRegex = /\bid\s*=\s*["']([^"']+)["']/gi;
const htmlIds = new Map();
let match;
while ((match = idAttrRegex.exec(htmlWithoutScripts)) !== null) {
  const id = match[1];
  htmlIds.set(id, (htmlIds.get(id) || 0) + 1);
}
const dupIds = [...htmlIds.entries()].filter(([, cnt]) => cnt > 1);
assert.equal(dupIds.length, 0, `Duplicate static HTML IDs found: ${JSON.stringify(dupIds)}`);
console.log(`PASS: Verified ${htmlIds.size} static HTML IDs with zero duplicates.`);

const requiredPhase2Ids = [
  'crateAssignModal', 'crateAssignModalContent', 'crateAssignRecordStrip',
  'crateAssignList', 'newCrateNameInput', 'recordBoxBadgeCount',
  'mobileRecordBoxBadge', 'mobileQuickStripBoxBadge', 'btnRecordBoxDrawer',
  'mnav-crate', 'mnav-crates', 'mnav-box', 'mnav-sets', 'mnav-more'
];
for (const reqId of requiredPhase2Ids) {
  assert.ok(htmlIds.has(reqId), `Missing expected Phase 2 HTML ID: #${reqId}`);
}
console.log('PASS: All required Phase 2 DOM elements and mobile navigation buttons exist.');

// 2. Syntax check all inline scripts
const scriptRegex = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
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

// 3. VM Sandbox Logic Verification
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
    title: '',
    style: {},
    classList: {
      add: (...c) => c.forEach(x => clsSet.add(x)),
      remove: (...c) => c.forEach(x => clsSet.delete(x)),
      contains: (c) => clsSet.has(c),
      toggle: (c, force) => {
        const has = clsSet.has(c);
        const shouldHave = force !== undefined ? !!force : !has;
        if (shouldHave) clsSet.add(c); else clsSet.delete(c);
        return shouldHave;
      }
    },
    setAttribute: (k, v) => { attrs[k] = v; },
    getAttribute: (k) => attrs[k] ?? null,
    appendChild: () => {},
    remove: () => {},
    click: () => {},
    focus: () => {}
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
    scrollTo: () => {}
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

const toastMessages = [];
vm.createContext(sandbox);
vm.runInContext(mainScript, sandbox);

// Seed sample records in VM sandbox
vm.runInContext(`
  records = [
    { id: 'rec_test_1', artist: 'Miles Davis', title: 'Kind of Blue', format: '12" LP (Album)', year: 1959, estimatedValue: 120.00 },
    { id: 'rec_test_2', artist: 'Pink Floyd', title: 'Meddle', format: '12" LP (Album)', year: 1971, estimatedValue: 65.00 }
  ];
`, sandbox);

// 4. Test toggleBoxForRecord
assert.equal(sandbox.isRecordInBox('rec_test_1'), false);
sandbox.toggleBoxForRecord('rec_test_1');
assert.equal(sandbox.isRecordInBox('rec_test_1'), true, 'toggleBoxForRecord must pack record into box');
assert.equal(sandbox.getQmcRecordBox().length, 1);
assert.equal(sandbox.document.getElementById('recordBoxBadgeCount').textContent, '1', 'Badge count must be 1');

// Toggle again to unpack
sandbox.toggleBoxForRecord('rec_test_1');
assert.equal(sandbox.isRecordInBox('rec_test_1'), false, 'Second toggle must unpack record from box');
assert.equal(sandbox.getQmcRecordBox().length, 0);
assert.equal(sandbox.document.getElementById('recordBoxBadgeCount').textContent, '0', 'Badge count must be 0');

console.log('PASS: toggleBoxForRecord packs, unpacks, and updates badges synchronously.');

// 5. Test Crate Assignment Modal and Membership Toggling
sandbox.openCrateAssignModal('rec_test_2');
assert.ok(!sandbox.document.getElementById('crateAssignModal').classList.contains('hidden'), 'openCrateAssignModal must reveal modal');

// Create crate and add
sandbox.document.getElementById('newCrateNameInput').value = 'Late Night Jazz';
sandbox.handleCreateAndAddCrate();
let crates = sandbox.getQmcCrates();
assert.equal(crates.length, 1);
assert.equal(crates[0].name, 'Late Night Jazz');
assert.ok(crates[0].record_ids.includes('rec_test_2'), 'New crate must contain target record');

// Toggle membership off
sandbox.toggleRecordCrateMembership(crates[0].crate_id);
crates = sandbox.getQmcCrates();
assert.equal(crates[0].record_ids.includes('rec_test_2'), false, 'toggleRecordCrateMembership must remove record');

// Toggle membership back on
sandbox.toggleRecordCrateMembership(crates[0].crate_id);
crates = sandbox.getQmcCrates();
assert.equal(crates[0].record_ids.includes('rec_test_2'), true, 'toggleRecordCrateMembership must re-add record');

sandbox.closeCrateAssignModal();
assert.ok(sandbox.document.getElementById('crateAssignModal').classList.contains('hidden'), 'closeCrateAssignModal must hide modal');

console.log('PASS: Thematic Crates modal, inline creation & membership toggling verified.');

// 6. Test Card View, Table View, and Dossier View Action Rendering
const testRecords = vm.runInContext('records', sandbox);
const gridContainer = sandbox.document.createElement('div');
sandbox.renderGridView(testRecords, gridContainer);
assert.ok(gridContainer.innerHTML.includes('toggleBoxForRecord'), 'Grid cards must include toggleBoxForRecord button');
assert.ok(gridContainer.innerHTML.includes('openCrateAssignModal'), 'Grid cards must include openCrateAssignModal button');

const tableContainer = sandbox.document.createElement('div');
sandbox.renderListView(testRecords, tableContainer);
assert.ok(tableContainer.innerHTML.includes('tableBoxBtn-rec_test_1'), 'Table view rows must include tableBoxBtn');
assert.ok(tableContainer.innerHTML.includes('openCrateAssignModal'), 'Table view rows must include openCrateAssignModal');

sandbox.viewRecordDetail('rec_test_1');
const dossierHtml = sandbox.document.getElementById('detailModalContent').innerHTML;
if (!dossierHtml.includes('dossierBoxBtn-rec_test_1')) {
  console.log('DEBUG dossierHtml length:', dossierHtml.length);
  console.log('DEBUG dossierHtml preview:', dossierHtml.slice(0, 300));
}
assert.ok(dossierHtml.includes('dossierBoxBtn-rec_test_1'), 'Dossier modal footer must include dossierBoxBtn');
assert.ok(dossierHtml.includes('openCrateAssignModal'), 'Dossier modal footer must include openCrateAssignModal');

console.log('PASS: Grid cards, Table rows, and Main Dossier render + Box and + Crate actions cleanly.');

// 7. Test Mobile Navigation Routing
sandbox.mobileNav('crates');
assert.ok(!sandbox.document.getElementById('crateAssignModal').classList.contains('hidden'), 'mobileNav("crates") must open thematic crates');
sandbox.closeAllModals();
assert.ok(sandbox.document.getElementById('crateAssignModal').classList.contains('hidden'), 'closeAllModals must close crateAssignModal');

console.log('PASS: Mobile navigation routing verified.');
console.log('=== ALL PHASE 2 VERIFICATIONS PASSED 100% ===');
