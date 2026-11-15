import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('c:/Users/steve/QMC-web/catalogue/index.html', 'utf8');

// 1. CSS rules present
assert.ok(html.includes('table:not(.mobile-actions-expanded) .table-action-buttons'), 'Collapsed CSS rule should hide .table-action-buttons on mobile');
assert.ok(html.includes('table.mobile-actions-expanded .table-action-collapsed-only'), 'Expanded CSS rule should hide .table-action-collapsed-only on mobile');
assert.ok(html.includes('table.mobile-actions-expanded .table-action-buttons'), 'Expanded CSS rule should show .table-action-buttons on mobile');

// 2. HTML/JS wiring in renderTableView
assert.ok(html.includes('id="catalogueDataTable"'), 'catalogueDataTable id should exist');
assert.ok(html.includes('function toggleMobileTableActions('), 'toggleMobileTableActions should be defined');
assert.ok(html.includes('let isMobileTableActionsExpanded = false;'), 'isMobileTableActionsExpanded should default to false');
assert.ok(html.includes('table-action-collapsed-only'), 'Collapsed-only trigger should exist');
assert.ok(html.includes('table-action-expanded-only'), 'Expanded-only label/chevron should exist');
assert.ok(html.includes('class="table-action-buttons flex items-center justify-end gap-1"'), 'Action buttons wrapper should exist');

// 3. Static HTML ID uniqueness
const idMatches = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
const counts = {};
for (const id of idMatches) {
  if (!id.includes('${')) counts[id] = (counts[id] || 0) + 1;
}
const dupes = Object.entries(counts).filter(([, c]) => c > 1);
assert.deepEqual(dupes, [], `Duplicate HTML IDs found: ${JSON.stringify(dupes)}`);

console.log('ALL CHECKS PASSED: mobile collapsible table Actions column verified.');

