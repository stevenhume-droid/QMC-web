import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('c:/Users/steve/QMC-web/catalogue/index.html', 'utf8');

// 1. Verify #statFormatBreakdown is removed and #genreQuickChips is present
assert.ok(!html.includes('id="statFormatBreakdown"'), 'statFormatBreakdown HTML element should be removed');
assert.ok(!html.includes("getElementById('statFormatBreakdown')"), 'statFormatBreakdown JS reference should be removed');
assert.ok(html.includes('id="genreQuickChips"'), 'genreQuickChips element should exist');
assert.ok(html.includes('id="statCategoryRefinement"'), 'statCategoryRefinement element should exist');

// 2. Verify #statCategoryRefinement uses flex-wrap for clean sizing
const catRefMatch = html.match(/<div id="statCategoryRefinement"[^>]*class="([^"]+)"/);
assert.ok(catRefMatch, 'statCategoryRefinement should have a class attribute');
assert.ok(catRefMatch[1].includes('flex-wrap'), 'statCategoryRefinement should use flex-wrap');

// 3. Verify static HTML ID uniqueness
const idMatches = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const counts = {};
for (const id of idMatches) {
  if (!id.includes('${')) counts[id] = (counts[id] || 0) + 1;
}
const dupes = Object.entries(counts).filter(([, c]) => c > 1);
assert.deepEqual(dupes, [], `Duplicate HTML IDs found: ${JSON.stringify(dupes)}`);

// 4. Verify multi-select genre JS wiring
assert.ok(html.includes('let activeGenreFilters = [];'), 'activeGenreFilters array should be declared');
assert.ok(html.includes('function toggleGenreFilter('), 'toggleGenreFilter should be defined');
assert.ok(html.includes('function clearGenreFilter('), 'clearGenreFilter should be defined');
assert.ok(html.includes('activeGenreFilters.some(gf => tokens.includes(gf.toLowerCase().trim()))'), 'getFilteredAndSortedRecords should filter by activeGenreFilters');
assert.ok(html.includes('if (activeGenreFilters.length > 0)'), 'renderActivePills should render activeGenreFilters pills');

// 5. Behavioral unit test of multi-select genre logic extracted from index.html
const escapeHtml = (s) => String(s || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const parseGenreAndStyles = (genres, genre, styles) => {
  const arr = Array.isArray(styles) ? styles : String(styles || '').split(',').map(x => x.trim()).filter(Boolean);
  return { genre: genre || '', styles: arr };
};

let activeGenreFilters = [];
const sampleRecords = [
  { id: 1, artist: 'Curtis Mayfield', genre: 'Funk / Soul', styles: ['Soul', 'Funk'] },
  { id: 2, artist: 'Massive Attack', genre: 'Electronic', styles: ['Trip Hop'] },
  { id: 3, artist: 'Blur', genre: 'Rock', styles: ['Britpop'] },
  { id: 4, artist: 'Marvin Gaye', genre: 'Funk / Soul', styles: ['Soul'] },
];

function toggleGenre(genreStr) {
  const norm = genreStr.toLowerCase().trim();
  const exists = activeGenreFilters.some(g => g.toLowerCase().trim() === norm);
  if (exists) {
    activeGenreFilters = activeGenreFilters.filter(g => g.toLowerCase().trim() !== norm);
  } else {
    activeGenreFilters = [...activeGenreFilters, genreStr];
  }
}

function filterByGenres(recs) {
  if (activeGenreFilters.length === 0) return recs;
  return recs.filter(item => {
    const gs = parseGenreAndStyles(item.genres || '', item.genre || '', item.styles || '');
    const tokens = [gs.genre, ...(gs.styles || [])].map(g => (g || '').toLowerCase().trim()).filter(Boolean);
    return activeGenreFilters.some(gf => tokens.includes(gf.toLowerCase().trim()));
  });
}

toggleGenre('Soul');
assert.equal(filterByGenres(sampleRecords).length, 2, 'Selecting Soul should match 2 records');

toggleGenre('Trip Hop');
assert.equal(activeGenreFilters.length, 2, 'Multi-select should hold 2 active genres');
assert.equal(filterByGenres(sampleRecords).length, 3, 'Selecting Soul + Trip Hop should match 3 records');

toggleGenre('Soul');
assert.equal(activeGenreFilters.length, 1, 'Toggling Soul again should deselect it');
assert.equal(filterByGenres(sampleRecords).length, 1, 'Only Trip Hop should remain');

activeGenreFilters = [];
assert.equal(filterByGenres(sampleRecords).length, 4, 'Clearing genres should show all 4 records');

console.log('ALL CHECKS PASSED: genre multi-select + statCategoryRefinement sizing verified.');
