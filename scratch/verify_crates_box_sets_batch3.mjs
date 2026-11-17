import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('c:/Users/steve/QMC-web/catalogue/index.html', 'utf8');

// 11. Set templates & Duplicate set
assert.ok(html.includes('const SET_TEMPLATES = {'), 'SET_TEMPLATES should be defined');
assert.ok(html.includes('function duplicateSet('), 'duplicateSet should be defined');
assert.ok(html.includes('function applySetTemplate('), 'applySetTemplate should be defined');
assert.ok(html.includes('id="btnDuplicateActiveSet"'), 'btnDuplicateActiveSet should exist in Set Builder header');
assert.ok(html.includes('id="setTemplateSelect"'), 'setTemplateSelect should exist in Set Builder header');
assert.ok(html.includes("onclick=\"duplicateSet('${safeSetId}')\""), 'Saved Set cards should have Clone/Duplicate button');

// 12. Smart crates
assert.ok(html.includes('function evaluateSmartCrateIds('), 'evaluateSmartCrateIds should be defined');
assert.ok(html.includes('function getCrateEffectiveRecordIds('), 'getCrateEffectiveRecordIds should be defined');
assert.ok(html.includes('function saveCurrentFiltersAsSmartCrate('), 'saveCurrentFiltersAsSmartCrate should be defined');
assert.ok(html.includes('onclick="saveCurrentFiltersAsSmartCrate()"'), 'Save Smart Crate button should be wired in Crates view and Active Filter Pills');

// 13. Mobile merged Box·Set bottom nav & segmented switch
assert.ok(html.includes('id="mobileBoxSetSegmentedSwitch"'), 'mobileBoxSetSegmentedSwitch should exist in #recordBoxDrawer');
assert.ok(html.includes('id="mobSegBtn-box"'), 'mobSegBtn-box should exist');
assert.ok(html.includes('id="mobSegBtn-set"'), 'mobSegBtn-set should exist');
assert.ok(html.includes('id="mobSegBtn-split"'), 'mobSegBtn-split should exist');
assert.ok(html.includes('<span>Box · Set</span>'), 'mobileBottomNav should merge Box and Sets into Box · Set');

// 14. Touch swipe actions on cards
assert.ok(html.includes('function handleCardTouchStart('), 'handleCardTouchStart should be defined');
assert.ok(html.includes('function handleCardTouchMove('), 'handleCardTouchMove should be defined');
assert.ok(html.includes('function handleCardTouchEnd('), 'handleCardTouchEnd should be defined');
assert.ok(html.includes('ontouchstart="handleCardTouchStart(event,'), 'Grid cards should wire touch swipe handlers');

// Static HTML ID uniqueness
const idMatches = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const counts = {};
for (const id of idMatches) {
  if (!id.includes('${')) counts[id] = (counts[id] || 0) + 1;
}
const dupes = Object.entries(counts).filter(([, c]) => c > 1);
assert.deepEqual(dupes, [], `Duplicate HTML IDs found: ${JSON.stringify(dupes)}`);

console.log('ALL CHECKS PASSED: Crates / Box / Sets usability batch 11-14 verified.');
