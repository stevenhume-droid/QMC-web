import { readFileSync } from 'fs';
import { resolve } from 'path';
import assert from 'assert';

const htmlPath = resolve('catalogue/index.html');
const html = readFileSync(htmlPath, 'utf8');

console.log('=== VERIFYING MEMBER AUTH TOP BAR & MODAL FRAME ===\n');

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

// Test 2: Elements existence
console.log('\nTest 2: Verifying required member auth DOM elements...');
const requiredElements = [
  'memberAuthContainer',
  'authNavBtn',
  'memberAuthBody',
  'authNavText',
  'authModal',
  'authModalTitle'
];
requiredElements.forEach(id => {
  assert.ok(html.includes(`id="${id}"`), `Element id="${id}" must exist in index.html`);
});
console.log('  ✓ All required member auth and portal elements exist.');

// Test 3: Direct 1-tap open of Member Portal frame
console.log('\nTest 3: Checking 1-tap open of Member Portal frame...');
assert.ok(html.includes('id="authNavBtn"'), 'authNavBtn must exist');
assert.ok(html.includes('onclick="openAuthModal()" id="authNavBtn"'), 'authNavBtn must directly trigger openAuthModal()');
assert.ok(/function handleAuthNavBtnClick\(\)\s*\{\s*openAuthModal\(\);?\s*\}/.test(html), 'handleAuthNavBtnClick must open Member Portal');
console.log('  ✓ Tapping member icon directly opens Member Portal frame (openAuthModal).');

// Test 4: Fully opaque background styling to guarantee logo never shows through
console.log('\nTest 4: Verifying 100% solid opaque CSS background...');
assert.ok(html.includes('#memberAuthContainer') && html.includes('#memberAuthBody'), 'Must target both container and body in CSS');
assert.ok(/#memberAuthContainer,\s*#memberAuthBody\s*\{\s*background-color:\s*#14171d\s*!important;/.test(html), 'Must have solid opaque dark background');
assert.ok(/html\.theme-light #memberAuthContainer,\s*html\.theme-light #memberAuthBody\s*\{\s*background-color:\s*#ffffff\s*!important;/.test(html), 'Must have solid opaque light background');
console.log('  ✓ Both dark and light themes enforce solid opaque backgrounds (#14171d and #ffffff). Zero transparency.');

console.log('\n=== ALL MEMBER AUTH TOP BAR VERIFICATIONS PASSED (4/4) ===');
