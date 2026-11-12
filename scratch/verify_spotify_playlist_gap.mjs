// scratch/verify_spotify_playlist_gap.mjs
// Verification suite for Spotify Playlist Gap Finder

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const htmlPath = path.resolve('c:/Users/steve/QMC-web/catalogue/index.html');
const rawHtml = fs.readFileSync(htmlPath, 'utf8');

console.log('=== VERIFYING SPOTIFY PLAYLIST GAP FINDER ===');

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

const requiredIds = [
  'gapModal',
  'gapModalContent',
  'gapSourceAlbumsBtn',
  'gapSourcePlaylistBtn',
  'gapPlaylistSection',
  'gapPlaylistUrlInput',
  'gapUserPlaylistsSelect',
  'gapSaveCrateBtn',
  'gapScannerSummary',
  'gapTabMissingBtn',
  'gapTabOwnedBtn',
  'gapCountMissingBadge',
  'gapCountOwnedBadge',
  'gapListContainer'
];

requiredIds.forEach(id => {
  assert.ok(staticIds.has(id), `Missing required DOM ID: ${id}`);
});
console.log(`PASS: All ${requiredIds.length} Spotify Playlist Gap Finder DOM elements exist with zero duplicates.`);

// 2. Extract and check syntax of inline scripts
const scriptRegex = /<script(?:\s+type="([^"]*)")?>([\s\S]*?)<\/script>/gi;
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
  prompt: (msg, def) => def
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

// 3. Test Playlist ID Extractor
console.log('Testing Spotify Playlist ID Extraction...');
assert.equal(sandbox.extractSpotifyPlaylistId('https://open.spotify.com/playlist/6fRQLuqUxcXCgekTO5Lq1H?si=abc'), '6fRQLuqUxcXCgekTO5Lq1H');
assert.equal(sandbox.extractSpotifyPlaylistId('spotify:playlist:3n5WQyLxxhTK7JuzSTLoPp'), '3n5WQyLxxhTK7JuzSTLoPp');
assert.equal(sandbox.extractSpotifyPlaylistId('6fRQLuqUxcXCgekTO5Lq1H'), '6fRQLuqUxcXCgekTO5Lq1H');
assert.equal(sandbox.extractSpotifyPlaylistId('invalid-url'), null);
console.log('PASS: extractSpotifyPlaylistId handles URLs, URIs, and direct IDs accurately.');

// 4. Test Source Switching
console.log('Testing Source Switching between Albums and Playlist...');
sandbox.setGapScannerSource('playlist');
assert.equal(vm.runInContext('gapScannerSource', sandbox), 'playlist');
const pSec = sandbox.document.getElementById('gapPlaylistSection');
assert.ok(!pSec.classList.contains('hidden'), 'Playlist section must be visible');

sandbox.setGapScannerSource('albums');
assert.equal(vm.runInContext('gapScannerSource', sandbox), 'albums');
assert.ok(pSec.classList.contains('hidden'), 'Playlist section must be hidden when albums active');
console.log('PASS: setGapScannerSource toggles modes and UI sections smoothly.');

// 5. Test Playlist Scanning & Collection Cross-Referencing
console.log('Testing Playlist Gap Scanning against physical collection...');

// Seed physical archive with OMD Electricity and Thievery Corporation Culture of Fear
const testRecords = [
  {
    id: 'rec_omd_1',
    artist: 'Orchestral Manoeuvres In The Dark',
    title: 'Electricity',
    format: '7" Single (45 RPM)',
    speed: '45 RPM',
    estimatedValue: '25.00',
    tracklist: [
      { position: 'A', title: 'Electricity' },
      { position: 'B', title: 'Almost' }
    ]
  },
  {
    id: 'rec_thievery_2',
    artist: 'Thievery Corporation',
    title: 'Culture of Fear',
    format: '12" LP',
    speed: '33 1/3 RPM',
    estimatedValue: '35.00',
    tracklist: [
      { position: 'A1', title: 'Web Of Deception' },
      { position: 'A2', title: 'Culture of Fear' },
      { position: 'A3', title: 'Take My Soul' }
    ]
  }
];

vm.runInContext('records = ' + JSON.stringify(testRecords) + ';', sandbox);

// Switch to playlist mode and scan QMC Los Hermanos Picks playlist
sandbox.setGapScannerSource('playlist');
await sandbox.scanSpotifyPlaylistGaps('6fRQLuqUxcXCgekTO5Lq1H', 'QMC Los Hermanos Picks');

const gapData = vm.runInContext('cachedGapData', sandbox);
assert.ok(gapData.owned.length >= 2, 'Must match at least 2 owned physical vinyl releases (OMD & Thievery Corporation)');
assert.ok(gapData.missing.length >= 3, 'Must identify remaining tracks as missing gaps');

// Check Badges & Summary
const missBadge = sandbox.document.getElementById('gapCountMissingBadge');
const ownBadge = sandbox.document.getElementById('gapCountOwnedBadge');
const summary = sandbox.document.getElementById('gapScannerSummary');

assert.equal(parseInt(ownBadge.textContent), gapData.owned.length);
assert.equal(parseInt(missBadge.textContent), gapData.missing.length);
assert.ok(summary.innerHTML.includes('held in physical archive'), 'Summary must report held releases');

// Check list container rendering for missing items
sandbox.switchGapTab('missing');
const listContainer = sandbox.document.getElementById('gapListContainer');
assert.ok(listContainer.innerHTML.includes('Discogs'), 'Missing gap cards must have Discogs action link');
assert.ok(listContainer.innerHTML.includes('+ Wantlist'), 'Missing gap cards must have + Wantlist button');

// Check list container rendering for owned items
sandbox.switchGapTab('owned');
assert.ok(listContainer.innerHTML.includes('Archived in Collection'), 'Owned items must indicate physical holding');
assert.ok(listContainer.innerHTML.includes('Dossier'), 'Owned items must include 1-click Dossier inspection button');
assert.ok(listContainer.innerHTML.includes('Box'), 'Owned items must include 1-click Pack into Record Box button');
console.log('PASS: Playlist gap scanning cross-references physical holdings with 1-click Dossier & Box actions.');

// 6. Test Save Missing Gaps as Thematic Crate
console.log('Testing Save Missing Gaps as Thematic Crate...');
const initialCratesCount = sandbox.getQmcCrates().length;
const initialWantlistCount = sandbox.getMMAWantlist().length;

sandbox.savePlaylistGapsAsCrate();

const afterCrates = sandbox.getQmcCrates();
const afterWantlist = sandbox.getMMAWantlist();

assert.equal(afterCrates.length, initialCratesCount + 1, 'Must create a new Thematic Crate');
assert.ok(afterCrates[afterCrates.length - 1].name.includes('Los Hermanos'), 'Crate name must reference the playlist');
assert.ok(afterWantlist.length > initialWantlistCount, 'Must populate physical Wantlist with missing gaps');

console.log('PASS: savePlaylistGapsAsCrate successfully creates Thematic Crate & populates Wantlist.');
console.log('=== ALL SPOTIFY PLAYLIST GAP FINDER VERIFICATIONS PASSED 100% ===');
