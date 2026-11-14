import fs from 'node:fs';
import vm from 'node:vm';

const htmlPath = 'c:/Users/steve/QMC-web/catalogue/index.html';
const html = fs.readFileSync(htmlPath, 'utf8');

// 1. Verify all inline <script> blocks compile without syntax errors
const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
let match;
let idx = 0;
let mainScript = '';
while ((match = scriptRegex.exec(html)) !== null) {
  idx++;
  const code = match[1];
  if (!code.trim()) continue;
  new vm.Script(code, { filename: `catalogue-script-${idx}.js` });
  if (code.includes('function renderSetGenreSortPanel')) {
    mainScript = code;
  }
}
console.log(`PASS: All ${idx} <script> blocks in catalogue/index.html parsed with zero syntax errors.`);

// 2. Verify HTML structure for mobile decluttering & auto-hide elements
const requiredSnippets = [
  'id="boxTitleEditRow" class="hidden',
  'id="setTitleEditRow" class="hidden',
  'id="setGenreActiveSummaryBar"',
  'id="setGenreSummaryText"',
  'id="setGenreSummarySubMode"',
  'onclick="toggleSetTitleEdit()"',
  'onclick="toggleBoxTitleEdit()"',
  'onclick="toggleSetGenrePanelExpanded(true)"',
  'onclick="toggleSetGenrePanelExpanded(false)"',
  'onscroll="handleActiveSetTimelineScroll(this)"'
];
for (const snip of requiredSnippets) {
  if (!html.includes(snip)) {
    throw new Error(`Missing expected snippet in HTML: ${snip}`);
  }
}
if (html.includes('<span>+ New Set</span>') || html.includes('<span>+ New Box</span>')) {
  throw new Error('Found duplicate "+ + New Set" or "+ + New Box" label in HTML');
}
console.log('PASS: Mobile compact headers, collapsible title rows, and Genre Summary Bar markup verified.');

// 3. Extract and execute the auto-hide state machine in VM context
const startMarker = 'const CANONICAL_DJ_GENRE_FLOW =';
const endMarker = 'function calculateActiveSetRuntime(';
const startPos = mainScript.indexOf(startMarker);
const endPos = mainScript.indexOf(endMarker);
if (startPos === -1 || endPos === -1) {
  throw new Error('Could not locate Set Builder script slice markers');
}
const sliceCode = mainScript.slice(startPos, endPos);

const mockElements = {};
function makeEl(id, initialHidden = false) {
  const classes = new Set(initialHidden ? ['hidden'] : []);
  return {
    id,
    value: '',
    textContent: '',
    innerHTML: '',
    className: '',
    scrollTop: 0,
    tagName: 'DIV',
    classList: {
      add: (...c) => c.forEach(x => classes.add(x)),
      remove: (...c) => c.forEach(x => classes.delete(x)),
      contains: (x) => classes.has(x),
      toggle: (x, force) => {
        const shouldAdd = typeof force === 'boolean' ? force : !classes.has(x);
        if (shouldAdd) classes.add(x);
        else classes.delete(x);
      }
    },
    focus: () => {},
    select: () => {},
    closest: () => null
  };
}

[
  'setGenreSortPanel',
  'setGenreActiveSummaryBar',
  'setGenreSummaryText',
  'setGenreSummarySubMode',
  'btnAutoSortByGenre',
  'setGenreSequenceChips',
  'setGenreAvailableChips',
  'setGenreSequenceInput',
  'btnGenreThenBpmAsc',
  'btnGenreThenHarmonic',
  'btnGenreThenBpmDesc',
  'setTitleEditRow',
  'btnToggleSetRename',
  'activeSetTitleInput',
  'boxTitleEditRow',
  'btnToggleBoxRename',
  'activeBoxTitleInput',
  'activeSetSelectPicker',
  'activeBoxSelectPicker'
].forEach(id => {
  const initHidden = ['setGenreSortPanel', 'setGenreActiveSummaryBar', 'setTitleEditRow', 'boxTitleEditRow'].includes(id);
  mockElements[id] = makeEl(id, initHidden);
});

const sandbox = {
  console,
  setTimeout: (fn) => fn(),
  document: {
    getElementById: (id) => mockElements[id] || null,
    querySelectorAll: () => [],
    activeElement: null
  },
  window: { innerWidth: 390 },
  escapeHtml: (s) => String(s || ''),
  escapeJsString: (s) => String(s || ''),
  showToast: () => {},
  saveActiveSet: (s) => ({ set_id: s.id || 'set_1', ...s }),
  saveActiveBoxStateToStorage: () => {},
  saveQmcRecordBox: () => {},
  getQmcRecordBox: () => [],
  getQmcSavedBoxes: () => [],
  getQmcCrates: () => [],
  renderSetBuilderPane: () => sandbox.renderSetGenreSortPanel(),
  renderRecordBoxDrawer: () => sandbox.renderSetGenreSortPanel(),
  getQmcSavedSets: () => [
    {
      set_id: 'set_saved_1',
      title: 'Bumfluff the show',
      genre_sort_enabled: true,
      genre_sub_sort: 'bpm-asc',
      genre_sequence: ['60s', 'Northern Soul', 'Funk / Trip Hop', 'Hip Hop', 'Britpop'],
      tracks: [
        { record_id: 'r1', title: 'Track 1', artist: 'A1', genre: '60s', bpm: 118, key: '8A' },
        { record_id: 'r2', title: 'Track 2', artist: 'A2', genre: 'Britpop', bpm: 124, key: '9A' }
      ]
    }
  ],
  records: [],
  CAMELOT_KEY_MAP: { 'Am': '8A', 'Em': '9A' },
  activeBoxState: { id: 'box_1', title: 'Session Box', crate_id: null },
  qmcRecordBox: [],
  activeSetState: {
    id: 'set_1',
    title: 'Bumfluff the show',
    genre_sort_enabled: false,
    genre_sub_sort: 'harmonic',
    genre_sequence: [],
    tracks: [
      { record_id: 'r1', title: 'Track 1', artist: 'A1', genre: '60s', bpm: 118, camelot: '8A' },
      { record_id: 'r2', title: 'Track 2', artist: 'A2', genre: 'Northern Soul', bpm: 126, camelot: '9A' },
      { record_id: 'r3', title: 'Track 3', artist: 'A3', genre: 'Britpop', bpm: 112, camelot: '8A' }
    ]
  }
};

vm.createContext(sandbox);
vm.runInContext(sliceCode, sandbox);

// Test A: Tapping "By Genre" enables genre sort AND opens the configuration panel
sandbox.toggleSetGenreSortMode();
if (sandbox.activeSetState.genre_sort_enabled !== true) {
  throw new Error('Expected toggleSetGenreSortMode() to enable genre sort');
}
if (mockElements.setGenreSortPanel.classList.contains('hidden')) {
  throw new Error('Expected #setGenreSortPanel to be visible when expanded');
}
console.log('PASS: Tapping [By Genre] opens #setGenreSortPanel for selection.');

// Test B: Selecting a Preset auto-hides #setGenreSortPanel and shows compact #setGenreActiveSummaryBar
sandbox.applySetGenrePreset('60s - Northern Soul - Funk / Trip Hop - Hip Hop - Britpop');
if (!mockElements.setGenreSortPanel.classList.contains('hidden')) {
  throw new Error('Expected #setGenreSortPanel to have class "hidden" after preset selection');
}
if (mockElements.setGenreActiveSummaryBar.classList.contains('hidden')) {
  throw new Error('Expected #setGenreActiveSummaryBar to be visible after preset selection');
}
if (!mockElements.setGenreSummaryText.textContent.includes('60s → Northern Soul → Funk / Trip Hop → Hip Hop → Britpop')) {
  throw new Error(`Unexpected summary bar text: ${mockElements.setGenreSummaryText.textContent}`);
}
console.log('PASS: Selecting a genre preset auto-hides the full panel into the 1-line summary bar.');

// Test C: Re-opening panel with [Edit] and clicking [Genre + BPM] sorts & auto-hides panel again
sandbox.toggleSetGenrePanelExpanded(true);
if (mockElements.setGenreSortPanel.classList.contains('hidden')) {
  throw new Error('Expected toggleSetGenrePanelExpanded(true) to re-open #setGenreSortPanel');
}
sandbox.autoSortActiveSet('genre-bpm-asc');
if (!mockElements.setGenreSortPanel.classList.contains('hidden')) {
  throw new Error('Expected autoSortActiveSet("genre-bpm-asc") to auto-hide #setGenreSortPanel');
}
if (mockElements.setGenreSummarySubMode.textContent !== 'BPM ↑') {
  throw new Error(`Expected summary sub-mode badge to be "BPM ↑", got "${mockElements.setGenreSummarySubMode.textContent}"`);
}
console.log('PASS: Selecting [Genre + BPM] sorts the set and auto-hides #setGenreSortPanel.');

// Test D: Set Title Rename toggle & auto-hide on set selection
sandbox.toggleSetTitleEdit(true);
if (mockElements.setTitleEditRow.classList.contains('hidden')) {
  throw new Error('Expected toggleSetTitleEdit(true) to show #setTitleEditRow');
}
sandbox.chooseActiveSet('set_saved_1');
if (!mockElements.setTitleEditRow.classList.contains('hidden')) {
  throw new Error('Expected chooseActiveSet() to auto-hide #setTitleEditRow');
}
if (!mockElements.setGenreSortPanel.classList.contains('hidden')) {
  throw new Error('Expected chooseActiveSet() to keep #setGenreSortPanel auto-hidden');
}
console.log('PASS: Choosing an active set auto-hides #setTitleEditRow and #setGenreSortPanel.');
console.log('=== ALL MOBILE AUTO-HIDE VERIFICATION TESTS PASSED! ===');
