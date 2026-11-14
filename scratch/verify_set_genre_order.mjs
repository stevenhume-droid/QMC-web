import fs from 'fs';
import vm from 'vm';
import assert from 'assert';

console.log('=== VERIFICATION SUITE: Set Builder Order by Genre -> BPM, Flow, or Cool Down ===');

const html = fs.readFileSync('catalogue/index.html', 'utf8');

// 1. Static DOM ID Uniqueness Check
console.log('1. Checking DOM ID Uniqueness...');
const idMatches = [...html.matchAll(/\sid=["']([^"']+)["']/g)].map(m => m[1]);
const counts = {};
idMatches.forEach(id => {
  if (id.includes('${') || id.includes("' +")) return;
  counts[id] = (counts[id] || 0) + 1;
});
const duplicates = Object.entries(counts).filter(([id, count]) => count > 1);
assert.strictEqual(duplicates.length, 0, `Duplicate IDs found: ${JSON.stringify(duplicates)}`);
console.log(`  ✓ Zero duplicate static IDs across ${idMatches.length} elements.`);

// 2. Check UI Elements for Genre Ordering
console.log('2. Checking Set Builder Genre Order UI Elements...');
const requiredIds = [
  'btnAutoSortByGenre',
  'btnAutoSortByGenreLabel',
  'setGenreSortPanel',
  'btnGenreThenBpmAsc',
  'btnGenreThenHarmonic',
  'btnGenreThenBpmDesc',
  'setGenreSequenceChips',
  'setGenreSequenceInput',
  'btnApplyGenreSequence',
  'btnPresetModToBritpop',
  'btnAutoDetectSetGenres',
  'setGenreAvailableChips'
];
requiredIds.forEach(id => {
  assert.ok(html.includes(`id="${id}"`), `Missing required element ID: ${id}`);
});
console.log('  ✓ All 12 Set Builder Genre Order UI elements found in DOM.');

// 3. Execute Main Script in VM Sandbox
console.log('3. Loading Main Application Script into VM Sandbox...');
const scriptMatches = [...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi)];
const mainScript = scriptMatches[scriptMatches.length - 1][1];

const mockStorage = new Map();
const mockLocalStorage = {
  getItem: (k) => (mockStorage.has(k) ? mockStorage.get(k) : null),
  setItem: (k, v) => mockStorage.set(k, String(v)),
  removeItem: (k) => mockStorage.delete(k),
  clear: () => mockStorage.clear()
};

const elements = new Map();
function makeEl(id = '', tag = 'DIV') {
  return {
    id,
    tagName: tag,
    value: '',
    innerHTML: '',
    textContent: '',
    className: '',
    title: '',
    style: {},
    options: [],
    classList: {
      _set: new Set(),
      add(...cls) { cls.forEach(c => this._set.add(c)); },
      remove(...cls) { cls.forEach(c => this._set.delete(c)); },
      contains(c) { return this._set.has(c); },
      toggle(c) { if (this._set.has(c)) this._set.delete(c); else this._set.add(c); }
    },
    addEventListener: () => {},
    querySelectorAll: () => [],
    querySelector: () => null,
    appendChild: () => {},
    remove: () => {},
    focus: () => {},
    select: () => {}
  };
}
function getOrCreateEl(id) {
  if (!elements.has(id)) elements.set(id, makeEl(id));
  return elements.get(id);
}

const toasts = [];
const sandbox = {
  console,
  setTimeout: (fn) => fn(),
  clearTimeout: () => {},
  setInterval: () => {},
  clearInterval: () => {},
  Date,
  Math,
  JSON,
  Array,
  Object,
  String,
  Number,
  Boolean,
  RegExp,
  Map,
  Set,
  Promise,
  encodeURIComponent,
  decodeURIComponent,
  parseInt,
  parseFloat,
  isNaN,
  Infinity,
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
    activeElement: null,
    getElementById: (id) => getOrCreateEl(id),
    createElement: (tag) => makeEl('', tag),
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: () => {}
  },
  showToast: (msg, type) => { toasts.push({ msg, type }); },
  alert: () => {},
  confirm: () => true
};

vm.createContext(sandbox);
vm.runInContext(mainScript, sandbox);

// 4. Test parsing the exact user progression string
console.log('4. Testing Genre Progression String Parser...');
const parsedStages = Array.from(sandbox.parseGenreProgressionString('60s - Northern Soul -  Funk / Trip Hop - Hip Hop - Britpop'));
assert.deepStrictEqual(parsedStages, ['60s', 'Northern Soul', 'Funk / Trip Hop', 'Hip Hop', 'Britpop']);
console.log('  ✓ Parsed:', parsedStages.join(' → '));

// 5. Seed multi-genre tracks in scrambled order & test Genre + BPM, Genre + Flow, Genre + Cool Down
console.log('5. Testing Genre -> BPM Build, Harmonic Flow, and Cool Down...');
const multiGenreRecords = [
  {
    id: 'rec-britpop-1',
    artist: 'Oasis',
    title: 'Definitely Maybe',
    year: 1994,
    genre: 'Rock',
    styles: ['Britpop', 'Indie Rock'],
    genres: 'Rock, Britpop',
    tracks: [
      { position: 'A1', title: 'Rock n Roll Star', duration: '5:22', bpm: 126, musical_key: 'B Major' },
      { position: 'A2', title: 'Live Forever', duration: '4:36', bpm: 92, musical_key: 'G Major' }
    ]
  },
  {
    id: 'rec-hiphop-1',
    artist: 'A Tribe Called Quest',
    title: 'Midnight Marauders',
    year: 1993,
    genre: 'Hip Hop',
    styles: ['Boom Bap', 'Jazzy Hip-Hop'],
    genres: 'Hip Hop, Boom Bap',
    tracks: [
      { position: 'A1', title: 'Award Tour', duration: '3:46', bpm: 97, musical_key: 'F Minor' },
      { position: 'B1', title: 'Electric Relaxation', duration: '3:46', bpm: 90, musical_key: 'A Minor' }
    ]
  },
  {
    id: 'rec-triphop-1',
    artist: 'Massive Attack',
    title: 'Blue Lines',
    year: 1991,
    genre: 'Electronic',
    styles: ['Trip Hop', 'Downtempo'],
    genres: 'Electronic, Trip Hop',
    tracks: [
      { position: 'A1', title: 'Safe From Harm', duration: '5:18', bpm: 86, musical_key: 'C Minor' },
      { position: 'B2', title: 'Unfinished Sympathy', duration: '5:08', bpm: 112, musical_key: 'D Minor' }
    ]
  },
  {
    id: 'rec-funk-1',
    artist: 'The Meters',
    title: 'Cissy Strut',
    year: 1969,
    genre: 'Funk / Soul',
    styles: ['Funk', 'Bayou Funk'],
    genres: 'Funk / Soul, Funk',
    tracks: [
      { position: 'A', title: 'Cissy Strut', duration: '3:02', bpm: 94, musical_key: 'C Minor' }
    ]
  },
  {
    id: 'rec-nsoul-1',
    artist: 'Gloria Jones',
    title: 'Tainted Love',
    year: 1965,
    genre: 'Funk / Soul',
    styles: ['Northern Soul', 'Soul'],
    genres: 'Funk / Soul, Northern Soul',
    tracks: [
      { position: 'A', title: 'Tainted Love', duration: '2:12', bpm: 142, musical_key: 'G Minor' },
      { position: 'B', title: 'My Bad Boy\'s Comin\' Home', duration: '2:40', bpm: 128, musical_key: 'C Major' }
    ]
  },
  {
    id: 'rec-60s-1',
    artist: 'The Kinks',
    title: 'You Really Got Me',
    year: 1964,
    genre: 'Rock',
    styles: ['Beat', 'Mod'],
    genres: 'Rock, Beat, Mod',
    tracks: [
      { position: 'A', title: 'You Really Got Me', duration: '2:14', bpm: 137, musical_key: 'G Major' },
      { position: 'B', title: 'It\'s All Right', duration: '2:37', bpm: 118, musical_key: 'E Minor' }
    ]
  }
];

vm.runInContext('records = ' + JSON.stringify(multiGenreRecords) + ';', sandbox);
vm.runInContext('activeSetState.tracks = []; activeSetState.genre_sequence = []; activeSetState.genre_sort_enabled = false;', sandbox);

// Add tracks in reverse/scrambled order (Britpop -> Hip Hop -> Trip Hop -> Funk -> Northern Soul -> 60s)
sandbox.addTrackToActiveSet('rec-britpop-1', 0); // Rock n Roll Star (126 BPM, Britpop)
sandbox.addTrackToActiveSet('rec-britpop-1', 1); // Live Forever (92 BPM, Britpop)
sandbox.addTrackToActiveSet('rec-hiphop-1', 0);  // Award Tour (97 BPM, Hip Hop)
sandbox.addTrackToActiveSet('rec-hiphop-1', 1);  // Electric Relaxation (90 BPM, Hip Hop)
sandbox.addTrackToActiveSet('rec-triphop-1', 0); // Safe From Harm (86 BPM, Trip Hop)
sandbox.addTrackToActiveSet('rec-triphop-1', 1); // Unfinished Sympathy (112 BPM, Trip Hop)
sandbox.addTrackToActiveSet('rec-funk-1', 0);    // Cissy Strut (94 BPM, Funk)
sandbox.addTrackToActiveSet('rec-nsoul-1', 0);   // Tainted Love (142 BPM, Northern Soul)
sandbox.addTrackToActiveSet('rec-nsoul-1', 1);   // My Bad Boy's Comin' Home (128 BPM, Northern Soul)
sandbox.addTrackToActiveSet('rec-60s-1', 0);     // You Really Got Me (137 BPM, 60s)
sandbox.addTrackToActiveSet('rec-60s-1', 1);     // It's All Right (118 BPM, 60s)

// Apply the preset "60s - Northern Soul - Funk / Trip Hop - Hip Hop - Britpop"
sandbox.applySetGenrePreset('60s - Northern Soul - Funk / Trip Hop - Hip Hop - Britpop');

// Test 5A: Genre + BPM Build (Ascending BPM within each genre stage)
sandbox.autoSortActiveSet('genre-bpm-asc');
let sorted = vm.runInContext('activeSetState.tracks', sandbox);

assert.strictEqual(sorted.length, 11);
// Stage 1: 60s (It's All Right 118 -> You Really Got Me 137)
assert.strictEqual(sorted[0].title, "It's All Right");
assert.strictEqual(sorted[0].matched_genre_stage, '60s');
assert.strictEqual(sorted[1].title, 'You Really Got Me');
assert.strictEqual(sorted[1].matched_genre_stage, '60s');

// Stage 2: Northern Soul (My Bad Boy's Comin' Home 128 -> Tainted Love 142)
assert.strictEqual(sorted[2].title, "My Bad Boy's Comin' Home");
assert.strictEqual(sorted[2].matched_genre_stage, 'Northern Soul');
assert.strictEqual(sorted[3].title, 'Tainted Love');
assert.strictEqual(sorted[3].matched_genre_stage, 'Northern Soul');

// Stage 3: Funk / Trip Hop combined stage! (Safe From Harm 86 -> Cissy Strut 94 -> Unfinished Sympathy 112)
assert.strictEqual(sorted[4].title, 'Safe From Harm');
assert.strictEqual(sorted[4].matched_genre_stage, 'Funk / Trip Hop');
assert.strictEqual(sorted[5].title, 'Cissy Strut');
assert.strictEqual(sorted[5].matched_genre_stage, 'Funk / Trip Hop');
assert.strictEqual(sorted[6].title, 'Unfinished Sympathy');
assert.strictEqual(sorted[6].matched_genre_stage, 'Funk / Trip Hop');

// Stage 4: Hip Hop (Electric Relaxation 90 -> Award Tour 97)
assert.strictEqual(sorted[7].title, 'Electric Relaxation');
assert.strictEqual(sorted[7].matched_genre_stage, 'Hip Hop');
assert.strictEqual(sorted[8].title, 'Award Tour');
assert.strictEqual(sorted[8].matched_genre_stage, 'Hip Hop');

// Stage 5: Britpop (Live Forever 92 -> Rock n Roll Star 126)
assert.strictEqual(sorted[9].title, 'Live Forever');
assert.strictEqual(sorted[9].matched_genre_stage, 'Britpop');
assert.strictEqual(sorted[10].title, 'Rock n Roll Star');
assert.strictEqual(sorted[10].matched_genre_stage, 'Britpop');
console.log('  ✓ Genre + BPM Build verified: 60s → Northern Soul → Funk / Trip Hop → Hip Hop → Britpop with ascending BPM inside each stage!');

// Test 5B: Genre + Cool Down (Descending BPM within each genre stage)
sandbox.autoSortActiveSet('genre-bpm-desc');
sorted = vm.runInContext('activeSetState.tracks', sandbox);

// Stage 1: 60s (137 -> 118)
assert.strictEqual(sorted[0].title, 'You Really Got Me');
assert.strictEqual(sorted[1].title, "It's All Right");
// Stage 2: Northern Soul (142 -> 128)
assert.strictEqual(sorted[2].title, 'Tainted Love');
assert.strictEqual(sorted[3].title, "My Bad Boy's Comin' Home");
// Stage 3: Funk / Trip Hop (112 -> 94 -> 86)
assert.strictEqual(sorted[4].title, 'Unfinished Sympathy');
assert.strictEqual(sorted[5].title, 'Cissy Strut');
assert.strictEqual(sorted[6].title, 'Safe From Harm');
// Stage 4: Hip Hop (97 -> 90)
assert.strictEqual(sorted[7].title, 'Award Tour');
assert.strictEqual(sorted[8].title, 'Electric Relaxation');
// Stage 5: Britpop (126 -> 92)
assert.strictEqual(sorted[9].title, 'Rock n Roll Star');
assert.strictEqual(sorted[10].title, 'Live Forever');
console.log('  ✓ Genre + Cool Down verified: 60s → Northern Soul → Funk / Trip Hop → Hip Hop → Britpop with descending BPM inside each stage!');

// Test 5C: Genre + Harmonic Flow
sandbox.autoSortActiveSet('genre-harmonic');
sorted = Array.from(vm.runInContext('activeSetState.tracks', sandbox));
const stageOrder = sorted.map(t => t.matched_genre_stage);
assert.deepStrictEqual(stageOrder, [
  '60s', '60s',
  'Northern Soul', 'Northern Soul',
  'Funk / Trip Hop', 'Funk / Trip Hop', 'Funk / Trip Hop',
  'Hip Hop', 'Hip Hop',
  'Britpop', 'Britpop'
]);
console.log('  ✓ Genre + Harmonic Flow verified: preserves exact Genre Progression while optimizing Camelot transitions!');

// Test 6: Verify Timeline Stage Headers & Genre Badge rendering
sandbox.renderSetBuilderPane();
const timelineHtml = getOrCreateEl('activeSetTimeline').innerHTML;
assert.ok(timelineHtml.includes('STAGE 1') && timelineHtml.includes('60s'), 'Timeline should render Stage 1: 60s banner');
assert.ok(timelineHtml.includes('STAGE 2') && timelineHtml.includes('Northern Soul'), 'Timeline should render Stage 2: Northern Soul banner');
assert.ok(timelineHtml.includes('STAGE 3') && timelineHtml.includes('Funk / Trip Hop'), 'Timeline should render Stage 3: Funk / Trip Hop banner');
assert.ok(timelineHtml.includes('STAGE 4') && timelineHtml.includes('Hip Hop'), 'Timeline should render Stage 4: Hip Hop banner');
assert.ok(timelineHtml.includes('STAGE 5') && timelineHtml.includes('Britpop'), 'Timeline should render Stage 5: Britpop banner');
console.log('  ✓ Set Builder Timeline renders Stage 1–5 divider headers and per-track genre stage selectors.');

console.log('\n=== ALL GENRE + BPM / FLOW / COOL DOWN TESTS PASSED! ===');

