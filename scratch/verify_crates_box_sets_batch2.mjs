import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('c:/Users/steve/QMC-web/catalogue/index.html', 'utf8');

// 6. Persistent working context pill
assert.ok(html.includes('id="workingContextPill"'), 'workingContextPill should exist in top controls bar');
assert.ok(html.includes('id="workingContextBoxLabel"'), 'workingContextBoxLabel should exist');
assert.ok(html.includes('id="workingContextSetLabel"'), 'workingContextSetLabel should exist');
assert.ok(html.includes('function updateWorkingContextPill('), 'updateWorkingContextPill should be defined');

// 7. Filter by membership
assert.ok(html.includes('id="filterMembership"'), 'filterMembership dropdown should exist');
for (const opt of ['IN_BOX', 'NOT_IN_BOX', 'IN_ANY_CRATE', 'NOT_IN_CRATE', 'IN_ANY_SET', 'NOT_IN_SET']) {
  assert.ok(html.includes(`value="${opt}"`), `filterMembership should have option ${opt}`);
  assert.ok(html.includes(`membershipFilter === '${opt}'`), `getFilteredAndSortedRecords should handle ${opt}`);
}

// 8. Staging lifecycle stepper
assert.ok(html.includes('id="curationLifecycleStepper"'), 'curationLifecycleStepper should exist in #recordBoxDrawer');
assert.ok(html.includes('function renderCurationLifecycleStepper('), 'renderCurationLifecycleStepper should be defined');

// 9. Drag and drop + Move to...
for (const fn of [
  'handleBoxRecordDragStart',
  'handleBoxTrackDragStart',
  'handleSetTrackReorderDragStart',
  'handleSetTrackReorderDrop',
  'handleSetTimelineDragOver',
  'handleSetTimelineDrop',
  'handleBoxPaneDrop'
]) {
  assert.ok(html.includes(`function ${fn}(`), `${fn} should be defined`);
}
assert.ok(html.includes('Move to…'), 'Record Box cards should include Move to… quick action');

// 10. Undo toast
assert.ok(html.includes('function registerUndoAction('), 'registerUndoAction should be defined');
assert.ok(html.includes('function triggerLastUndo('), 'triggerLastUndo should be defined');
assert.ok(html.includes('function removeRecordFromBoxWithUndo('), 'removeRecordFromBoxWithUndo should be defined');
assert.ok(html.includes('function showToast(message, type = "success", undoCallback = null'), 'showToast should accept undoCallback');

// Static HTML ID uniqueness
const idMatches = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const counts = {};
for (const id of idMatches) {
  if (!id.includes('${')) counts[id] = (counts[id] || 0) + 1;
}
const dupes = Object.entries(counts).filter(([, c]) => c > 1);
assert.deepEqual(dupes, [], `Duplicate HTML IDs found: ${JSON.stringify(dupes)}`);

console.log('ALL CHECKS PASSED: Crates / Box / Sets usability batch 6-10 verified.');
