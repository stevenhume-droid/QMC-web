import { readFileSync } from 'fs';
import { resolve } from 'path';
import assert from 'assert';

const htmlPath = resolve('catalogue/index.html');
const html = readFileSync(htmlPath, 'utf8');

console.log('=== VERIFYING EDIT RECORD ACQUISITION TOOLBAR HIDING ===\n');

// Test 1: Static HTML DOM ID uniqueness check
console.log('Test 1: Static HTML DOM ID uniqueness check...');
const idRegex = /\bid=["']([^"']+)["']/g;
const idCounts = {};
let match;
while ((match = idRegex.exec(html)) !== null) {
  const id = match[1];
  if (!id.includes('${')) {
    idCounts[id] = (idCounts[id] || 0) + 1;
  }
}
const duplicateIds = Object.entries(idCounts).filter(([_, count]) => count > 1);
assert.strictEqual(duplicateIds.length, 0, `Found duplicate IDs: ${JSON.stringify(duplicateIds)}`);
console.log(`  ✓ All ${Object.keys(idCounts).length} static DOM element IDs are 100% unique.`);

// Test 2: acquisitionToolbar element exists
console.log('\nTest 2: Verifying acquisitionToolbar element...');
assert.ok(html.includes('id="acquisitionToolbar"'), 'acquisitionToolbar ID must exist in index.html');
console.log('  ✓ id="acquisitionToolbar" exists in index.html.');

// Test 3: editRecord hides acquisitionToolbar and quickLookupBar
console.log('\nTest 3: Checking editRecord hides acquisitionToolbar...');
const editRecordMatch = html.match(/function editRecord\(id\) \{[\s\S]*?\n    \}/);
assert.ok(editRecordMatch, 'Could not locate editRecord implementation');
assert.ok(editRecordMatch[0].includes("document.getElementById('acquisitionToolbar')?.classList.add('hidden')"), 'editRecord must hide acquisitionToolbar');
assert.ok(editRecordMatch[0].includes("document.getElementById('quickLookupBar')?.classList.add('hidden')"), 'editRecord must hide quickLookupBar');
console.log('  ✓ editRecord hides both acquisitionToolbar and quickLookupBar.');

// Test 4: openAddEditModal reveals acquisitionToolbar for new additions
console.log('\nTest 4: Checking openAddEditModal unhides acquisitionToolbar...');
const addRecordMatch = html.match(/function openAddEditModal\(\) \{[\s\S]*?\n    \}/);
assert.ok(addRecordMatch, 'Could not locate openAddEditModal implementation');
assert.ok(addRecordMatch[0].includes("document.getElementById('acquisitionToolbar')?.classList.remove('hidden')"), 'openAddEditModal must reveal acquisitionToolbar');
console.log('  ✓ openAddEditModal reveals acquisitionToolbar when creating new records.');

// Test 5: closeAddEditModal resets acquisitionToolbar
console.log('\nTest 5: Checking closeAddEditModal resets acquisitionToolbar...');
const closeRecordMatch = html.match(/function closeAddEditModal\(\) \{[\s\S]*?\n    \}/);
assert.ok(closeRecordMatch, 'Could not locate closeAddEditModal implementation');
assert.ok(closeRecordMatch[0].includes("document.getElementById('acquisitionToolbar')?.classList.remove('hidden')"), 'closeAddEditModal must reset acquisitionToolbar');
console.log('  ✓ closeAddEditModal resets acquisitionToolbar.');

console.log('\n=== ALL EDIT RECORD ACQUISITION TESTS PASSED (5/5) ===');

