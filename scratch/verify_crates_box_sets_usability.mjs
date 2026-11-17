import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('c:/Users/steve/QMC-web/catalogue/index.html', 'utf8');

// 1. Crate <-> Box in one tap
assert.ok(html.includes('function appendCrateToRecordBox('), 'appendCrateToRecordBox should be defined');
assert.ok(html.includes('function packFilteredRecordsToBox('), 'packFilteredRecordsToBox should be defined');
assert.ok(html.includes('onclick="appendCrateToRecordBox('), 'Crate cards and modal should wire appendCrateToRecordBox');
assert.ok(html.includes('onclick="packFilteredRecordsToBox()"'), 'Active filter pills should wire packFilteredRecordsToBox');
assert.ok(html.includes('onclick="saveRecordBoxAsCrate()"'), 'Save Box as Crate button should remain wired');

// 2. Box -> Set in one tap
assert.ok(html.includes('function buildSetFromRecordBox('), 'buildSetFromRecordBox should be defined');
assert.ok(html.includes('function addAllRecordTracksToSet('), 'addAllRecordTracksToSet should be defined');
assert.ok(html.includes('id="btnBuildSetFromBox"'), 'btnBuildSetFromBox should exist in Record Box header');
assert.ok(html.includes('id="btnPullFromBoxToSet"'), 'btnPullFromBoxToSet should exist in Set Builder header');
assert.ok(html.includes("+ All to Set"), 'Record Box cards should have + All to Set button');

// 3. Multi-select with floating action bar
assert.ok(html.includes('id="multiSelectFloatingBar"'), 'multiSelectFloatingBar should exist');
assert.ok(html.includes('id="btnToggleMultiSelectMode"'), 'btnToggleMultiSelectMode should exist');
assert.ok(html.includes('function toggleRecordSelection('), 'toggleRecordSelection should be defined');
assert.ok(html.includes('function selectAllFilteredRecords('), 'selectAllFilteredRecords should be defined');
assert.ok(html.includes('function bulkAddSelectedToBox('), 'bulkAddSelectedToBox should be defined');
assert.ok(html.includes('function bulkAddSelectedToSet('), 'bulkAddSelectedToSet should be defined');

// 4. Unified "Add to..." sheet (Box · Crate · Set tabs)
assert.ok(html.includes('id="addToSheetTabs"'), 'addToSheetTabs should exist in #crateAssignModal');
assert.ok(html.includes('id="addToBoxSection"'), 'addToBoxSection should exist');
assert.ok(html.includes('id="addToCratesSection"'), 'addToCratesSection should exist');
assert.ok(html.includes('id="addToSetsSection"'), 'addToSetsSection should exist');
assert.ok(html.includes('function switchAddToModalTab('), 'switchAddToModalTab should be defined');
assert.ok(html.includes('function renderAddToBoxSection('), 'renderAddToBoxSection should be defined');
assert.ok(html.includes('function renderAddToSetsSection('), 'renderAddToSetsSection should be defined');

// 5. Membership chips on cards, table rows, and dossier
assert.ok(html.includes('function buildMembershipLookupMap('), 'buildMembershipLookupMap should be defined');
assert.ok(html.includes('function getRecordMemberships('), 'getRecordMemberships should be defined');
assert.ok(html.includes('function renderRecordMembershipChips('), 'renderRecordMembershipChips should be defined');
assert.ok(html.includes('function jumpToCrateFromChip('), 'jumpToCrateFromChip should be defined');
assert.ok(html.includes('function jumpToSetFromChip('), 'jumpToSetFromChip should be defined');

// 6. Static HTML ID uniqueness
const idMatches = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const counts = {};
for (const id of idMatches) {
  if (!id.includes('${')) counts[id] = (counts[id] || 0) + 1;
}
const dupes = Object.entries(counts).filter(([, c]) => c > 1);
assert.deepEqual(dupes, [], `Duplicate HTML IDs found: ${JSON.stringify(dupes)}`);

console.log('ALL CHECKS PASSED: Crates / Box / Sets usability batch 1-5 verified.');
