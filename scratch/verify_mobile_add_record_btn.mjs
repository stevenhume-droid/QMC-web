import { readFileSync } from 'fs';
import { resolve } from 'path';
import assert from 'assert';

const htmlPath = resolve('catalogue/index.html');
const html = readFileSync(htmlPath, 'utf8');

console.log('=== VERIFYING MOBILE ADD RECORD MANUAL BUTTONS ===\n');

// Test 1: Static HTML DOM ID uniqueness
console.log('Test 1: Static HTML DOM ID uniqueness check...');
const htmlWithoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, '');
const idRegex = /\bid=["']([^"']+)["']/g;
const idCounts = {};
let match;
while ((match = idRegex.exec(htmlWithoutScripts)) !== null) {
  const id = match[1];
  if (!id.includes('${')) {
    idCounts[id] = (idCounts[id] || 0) + 1;
  }
}
const duplicateIds = Object.entries(idCounts).filter(([_, count]) => count > 1);
assert.strictEqual(duplicateIds.length, 0, `Found duplicate IDs: ${JSON.stringify(duplicateIds)}`);
console.log(`  ✓ All ${Object.keys(idCounts).length} static DOM element IDs are 100% unique.`);

// Test 2: Mobile bottom nav has mnav-add AND mnav-box
console.log('\nTest 2: Verifying #mobileBottomNav has both + Add (mnav-add) and Box (mnav-box)...');
const bottomNavMatch = html.match(/<nav id="mobileBottomNav"[\s\S]*?<\/nav>/);
assert.ok(bottomNavMatch, '#mobileBottomNav must exist');
assert.ok(bottomNavMatch[0].includes('id="mnav-add"'), '#mobileBottomNav must contain id="mnav-add"');
assert.ok(bottomNavMatch[0].includes("mobileNav('add')"), '#mobileBottomNav must trigger mobileNav(\'add\')');
assert.ok(bottomNavMatch[0].includes('id="mnav-box"'), '#mobileBottomNav must also retain id="mnav-box"');
assert.ok(bottomNavMatch[0].includes('id="mobileRecordBoxBadge"'), '#mobileBottomNav must retain id="mobileRecordBoxBadge"');
console.log('  ✓ #mobileBottomNav includes elevated + Add button and Box button.');

// Test 3: Mobile header has quick + Add button
console.log('\nTest 3: Verifying mobile header + Add button (#mobileHeaderAddBtn)...');
assert.ok(html.includes('id="mobileHeaderAddBtn"'), 'mobileHeaderAddBtn must exist in top header');
console.log('  ✓ Mobile header + Add button verified.');

// Test 4: Mobile More Sheet has Add Record Manually button
console.log('\nTest 4: Verifying #mobileMoreSheet has Add Record Manually button...');
assert.ok(html.includes('id="mobileMoreAddRecordBtn"'), 'mobileMoreAddRecordBtn must exist in #mobileMoreSheet');
console.log('  ✓ Mobile More sheet Add Record Manually button verified.');

// Test 5: mobileNav('add') calls openAddEditModal()
console.log('\nTest 5: Verifying mobileNav("add") routes to openAddEditModal()...');
const mobileNavMatch = html.match(/function mobileNav\(target\) \{[\s\S]*?\n    \}/);
assert.ok(mobileNavMatch, 'mobileNav function must exist');
assert.ok(mobileNavMatch[0].includes("target === 'add'") && mobileNavMatch[0].includes('openAddEditModal()'), 'mobileNav("add") must invoke openAddEditModal()');
console.log('  ✓ mobileNav("add") routes to openAddEditModal().');

console.log('\n=== ALL MOBILE ADD RECORD BUTTON TESTS PASSED (5/5) ===');
