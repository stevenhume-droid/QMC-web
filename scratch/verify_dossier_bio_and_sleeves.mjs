import { readFileSync } from 'fs';
import { resolve } from 'path';
import assert from 'assert';

const htmlPath = resolve('catalogue/index.html');
const html = readFileSync(htmlPath, 'utf8');

console.log('=== VERIFYING DOSSIER BIOGRAPHY, SLEEVES, WHOSAMPLED & EDIT BAR ===\n');

// 1. Static DOM ID uniqueness
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

// 2. Sample records sleeves and bios
console.log('\nTest 2: Verifying SAMPLE_RECORDS canonical sleeves and bios...');
const sampleRecordsMatch = html.match(/const SAMPLE_RECORDS = (\[[\s\S]*?\n    \]);/);
assert.ok(sampleRecordsMatch, 'SAMPLE_RECORDS definition not found');
const sampleRecords = eval(sampleRecordsMatch[1]);
assert.strictEqual(sampleRecords.length, 5, 'SAMPLE_RECORDS must have 5 entries');

sampleRecords.forEach(rec => {
  assert.ok(rec.coverImage && rec.coverImage.startsWith('http'), `Record ${rec.id} (${rec.artist}) must have high-res coverImage`);
  assert.ok(!rec.coverImage.includes('unsplash.com'), `Record ${rec.id} must not use unsplash`);
  assert.ok(rec.artistBio && rec.artistBio.length > 20, `Record ${rec.id} must have artistBio`);
  assert.ok(rec.albumBio && rec.albumBio.length > 20, `Record ${rec.id} must have albumBio`);
  console.log(`  ✓ ${rec.artist} - ${rec.title}: Sleeve & Bio verified`);
});

// 3. Dossier Bio Section & Tabs
console.log('\nTest 3: Checking Dossier Bio Section markup & functions...');
assert.ok(html.includes('id="dossierBioSection"'), 'dossierBioSection must exist in viewRecordDetail');
assert.ok(html.includes('id="btnDossierBioTabArtist"'), 'btnDossierBioTabArtist must exist');
assert.ok(html.includes('id="btnDossierBioTabAlbum"'), 'btnDossierBioTabAlbum must exist');
assert.ok(html.includes('id="dossierArtistBioPane"'), 'dossierArtistBioPane must exist');
assert.ok(html.includes('id="dossierAlbumBioPane"'), 'dossierAlbumBioPane must exist');
assert.ok(html.includes('function switchDossierBioTab('), 'switchDossierBioTab must be defined');
assert.ok(html.includes('function updateDossierBioPanes('), 'updateDossierBioPanes must be defined');
assert.ok(html.includes('function autoFetchBioForRecord('), 'autoFetchBioForRecord must be defined');
console.log('  ✓ Dossier Bio section and tab functions verified.');

// 4. Bio Editor Modal
console.log('\nTest 4: Checking Bio Editor Modal...');
assert.ok(html.includes('id="bioEditorModal"'), 'bioEditorModal must exist');
assert.ok(html.includes('id="bioEditorArtistInput"'), 'bioEditorArtistInput must exist');
assert.ok(html.includes('id="bioEditorAlbumInput"'), 'bioEditorAlbumInput must exist');
assert.ok(html.includes('function openBioEditorModal('), 'openBioEditorModal must be defined');
assert.ok(html.includes('function closeBioEditorModal('), 'closeBioEditorModal must be defined');
assert.ok(html.includes('function autoFetchSpecificBio('), 'autoFetchSpecificBio must be defined');
assert.ok(html.includes('function saveBioEditorModal('), 'saveBioEditorModal must be defined');
console.log('  ✓ Bio Editor modal and handlers verified.');

// 5. WhoSampled DNA Links
console.log('\nTest 5: Checking WhoSampled DNA integration...');
assert.ok(html.includes('whosampled.com/search/?q='), 'whosampled search deep link must be present');
assert.ok(html.includes('Sample DNA') || html.includes('WhoSampled'), 'Sample DNA or WhoSampled label must be present');
assert.ok(html.includes('fa-dna'), 'fa-dna icon must be present');
console.log('  ✓ WhoSampled Sample DNA links verified in Dossier and tracklist.');

// 6. Acquisition Toolbar Hiding on Edit
console.log('\nTest 6: Checking Acquisition toolbar hiding on edit...');
const editRecordMatch = html.match(/function editRecord\(id\) \{[\s\S]*?\n    \}/);
assert.ok(editRecordMatch[0].includes("document.getElementById('acquisitionToolbar')?.classList.add('hidden')"), 'editRecord must hide acquisitionToolbar');
assert.ok(editRecordMatch[0].includes("document.getElementById('quickLookupBar')?.classList.add('hidden')"), 'editRecord must hide quickLookupBar');

const goToFormPageMatch = html.match(/function goToFormPage\(pageNum\) \{[\s\S]*?\n    \}/);
assert.ok(goToFormPageMatch[0].includes("document.getElementById('acquisitionToolbar')?.classList.add('hidden')"), 'goToFormPage must ensure acquisitionToolbar stays hidden when editing');
console.log('  ✓ Acquisition toolbar hidden during record editing.');

console.log('\n=== ALL DOSSIER BIO, SLEEVE, WHOSAMPLED & EDIT TESTS PASSED (6/6) ===');
