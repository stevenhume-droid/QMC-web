import fs from 'node:fs';
import vm from 'node:vm';

const htmlPath = 'c:/Users/steve/QMC-web/catalogue/index.html';
const lazyLibsPath = 'c:/Users/steve/QMC-web/catalogue/js/lazy-libs.js';
const syncDedupPath = 'c:/Users/steve/QMC-web/catalogue/js/sync-dedup.js';

const html = fs.readFileSync(htmlPath, 'utf8');
const lazyLibsCode = fs.readFileSync(lazyLibsPath, 'utf8');
const syncDedupCode = fs.readFileSync(syncDedupPath, 'utf8');

// 1. Parse all JS files and inline <script> blocks
new vm.Script(lazyLibsCode, { filename: 'lazy-libs.js' });
new vm.Script(syncDedupCode, { filename: 'sync-dedup.js' });
const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let idx = 0;
while ((match = scriptRegex.exec(html)) !== null) {
  idx++;
  if (!match[1].trim()) continue;
  new vm.Script(match[1], { filename: `catalogue-inline-${idx}.js` });
}
console.log(`PASS: lazy-libs.js, sync-dedup.js, and all ${idx} inline <script> blocks parsed cleanly.`);

// 2. Verify eager heavy CDN tags were removed from <head> & modular scripts wired
if (html.includes('src="https://unpkg.com/html5-qrcode"') || html.includes('src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"')) {
  throw new Error('Eager html5-qrcode or xlsx <script> still present in index.html');
}
if (!html.includes('src="js/lazy-libs.js"') || !html.includes('src="js/sync-dedup.js"')) {
  throw new Error('Missing js/lazy-libs.js or js/sync-dedup.js script tag in index.html');
}
console.log('PASS: Heavy scanner & XLSX libraries removed from <head> and modular scripts wired.');

// 3. Verify no action modals remain at z-50
const z50Modals = html.match(/id="[^"]*Modal"\s+class="[^"]*\bz-50\b/g) || [];
if (z50Modals.length > 0) {
  throw new Error(`Found modals still at z-50: ${z50Modals.join(', ')}`);
}
if (!html.includes('id="duplicateResolutionModal"')) {
  throw new Error('Missing #duplicateResolutionModal');
}
console.log('PASS: Zero modals at z-50 and #duplicateResolutionModal is present.');

// 4. Verify sync-dedup.js behavior (tombstones, consolidation, duplicate matching)
const store = {};
const sandbox = {
  console,
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; }
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(syncDedupCode, sandbox);

// Test tombstones
const deletedRec = { id: 'rec_del_1', artist: 'The Specials', title: 'Ghost Town', duplicateHash: 'specials::ghosttown::chs12' };
sandbox.addSyncTombstone(deletedRec);
if (!sandbox.isRecordTombstoned(deletedRec)) {
  throw new Error('Expected deleted record to be marked tombstoned');
}
console.log('PASS: Soft-delete tombstone prevents deleted record resurrection.');

// Test semantic consolidation across different UUIDs
const cloudAndLocal = [
  {
    id: 'uuid_cloud_1',
    artist: 'Curtis Mayfield',
    title: 'Superfly',
    catNo: 'CRS 8014-ST',
    duplicateHash: 'curtismayfield::superfly::crs8014st',
    coverImage: '',
    tracks: [],
    dateAdded: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'uuid_local_2',
    artist: 'Curtis Mayfield',
    title: 'Superfly',
    catNo: 'CRS 8014-ST',
    duplicateHash: 'curtismayfield::superfly::crs8014st',
    coverImage: 'https://img.example.com/superfly.jpg',
    tracks: [{ pos: 'A1', title: 'Little Child Runnin Wild' }],
    estimatedValue: 45,
    dateAdded: '2026-02-01T00:00:00.000Z'
  }
];
const consolidated = sandbox.consolidateDuplicateRecords(cloudAndLocal);
if (consolidated.records.length !== 1 || consolidated.mergedCount !== 1) {
  throw new Error(`Expected 1 consolidated record and mergedCount=1, got len=${consolidated.records.length}, merged=${consolidated.mergedCount}`);
}
if (consolidated.records[0].coverImage !== 'https://img.example.com/superfly.jpg' || consolidated.records[0].tracks.length !== 1) {
  throw new Error('Expected consolidated record to retain enriched coverImage and tracklist');
}
console.log('PASS: Semantic cloud consolidation merged two UUIDs with identical pressing fingerprint & preserved richest metadata.');

// Test pre-save duplicate match
const dupMatch = sandbox.findDuplicateRecordMatch(
  { id: 'new_1', artist: 'The Curtis Mayfield', title: 'Superfly', catNo: 'CRS-8014-ST' },
  consolidated.records,
  'new_1'
);
if (!dupMatch || dupMatch.record.id !== 'uuid_cloud_1') {
  throw new Error('Expected findDuplicateRecordMatch() to detect normalized Artist+Title+Cat# duplicate');
}
console.log('PASS: Pre-save duplicate detector catches normalized Artist + Title + Cat# match.');
console.log('=== ALL OPTIMISATION & SYNC SAFETY TESTS PASSED! ===');
