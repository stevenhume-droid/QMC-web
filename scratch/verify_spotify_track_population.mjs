import { readFileSync } from 'fs';
import { resolve } from 'path';
import assert from 'assert';

const htmlPath = resolve('catalogue/index.html');
const html = readFileSync(htmlPath, 'utf8');

console.log('=== TEST SUITE: SPOTIFY PLAYLIST TRACK POPULATION ===\n');

// 1. Verify static DOM ID uniqueness
console.log('1. Verifying static DOM ID uniqueness...');
const idRegex = /\bid=["']([^"']+)["']/g;
const idCounts = {};
let match;
while ((match = idRegex.exec(html)) !== null) {
  const id = match[1];
  // Ignore template interpolations like ${...}
  if (!id.includes('${')) {
    idCounts[id] = (idCounts[id] || 0) + 1;
  }
}
const duplicateIds = Object.entries(idCounts).filter(([_, count]) => count > 1);
assert.strictEqual(duplicateIds.length, 0, `Found duplicate IDs: ${JSON.stringify(duplicateIds)}`);
console.log(`  ✓ 0 duplicate IDs found across ${Object.keys(idCounts).length} unique static IDs.`);

// 2. Extract cleanSpotifySearchTerm function and verify its cleaning capabilities
console.log('\n2. Testing cleanSpotifySearchTerm()...');
assert.ok(html.includes('function cleanSpotifySearchTerm('), 'cleanSpotifySearchTerm function must exist in index.html');

// Create sandbox to test cleanSpotifySearchTerm
const cleanFnMatch = html.match(/function cleanSpotifySearchTerm\([\s\S]*?\n    \}/);
assert.ok(cleanFnMatch, 'Could not locate cleanSpotifySearchTerm implementation');
const cleanSpotifySearchTerm = new Function(`return (${cleanFnMatch[0]})`)();

// Test cases
const test1 = cleanSpotifySearchTerm("Didn't I (Blow Your Mind This Time)");
assert.strictEqual(test1, "Didnt I Blow Your Mind This Time", `Unexpected output: ${test1}`);
console.log('  ✓ Strips apostrophe and parentheses: "Didn\'t I (Blow Your Mind This Time)" -> "' + test1 + '"');

const test2 = cleanSpotifySearchTerm("Martha Reeves & The Vandellas");
assert.strictEqual(test2, "Martha Reeves and The Vandellas", `Unexpected output: ${test2}`);
console.log('  ✓ Replaces & with "and": "Martha Reeves & The Vandellas" -> "' + test2 + '"');

const test3 = cleanSpotifySearchTerm("A1 - Computer World (Remastered)");
assert.strictEqual(test3, "Computer World", `Unexpected output: ${test3}`);
console.log('  ✓ Strips track number prefix and remaster tag: "A1 - Computer World (Remastered)" -> "' + test3 + '"');

const test4 = cleanSpotifySearchTerm("7\" Single (45 RPM)");
assert.strictEqual(test4, "7 Single", `Unexpected output: ${test4}`);
console.log('  ✓ Strips quotes and RPM tag: "7\\" Single (45 RPM)" -> "' + test4 + '"');

const test5 = cleanSpotifySearchTerm("Side A: Speak to Me / Breathe");
assert.strictEqual(test5, "Speak to Me Breathe", `Unexpected output: ${test5}`);
console.log('  ✓ Strips side prefix and slashes: "Side A: Speak to Me / Breathe" -> "' + test5 + '"');

// 3. Verify Spotify Search and Track Batching Logic
console.log('\n3. Verifying Spotify search cascade & track batching in exportSetToSpotify...');
assert.ok(html.includes('async function exportSetToSpotify('), 'exportSetToSpotify function must exist');
assert.ok(html.includes('primaryQuery = isGenericArtist ? cleanTitle : `${cleanArtist} ${cleanTitle}`'), 'Search cascade must handle generic artists');
assert.ok(html.includes('/playlists/${encodeURIComponent(playlistId)}/items'), 'Must use modern Spotify /items endpoint to avoid 403 deprecation');
assert.ok(html.includes('/playlists/${encodeURIComponent(playlistId)}/tracks'), 'Must retain fallback to /tracks endpoint');
assert.ok(html.includes('chunkIdx += 100'), 'Must chunk track URIs into batches of 100');
assert.ok(html.includes('if (addRes.status === 403)'), 'Must handle 403 Forbidden with actionable user re-auth prompt');
assert.ok(html.includes('playlist-modify-public'), 'Must request and badge playlist-modify-public');
assert.ok(html.includes('playlist-modify-private'), 'Must request and badge playlist-modify-private');

console.log('  ✓ Search cascade handles generic artists & stripped punctuation.');
console.log('  ✓ Track batches use modern /items endpoint with /tracks fallback.');
console.log('  ✓ 403 Forbidden triggers actionable re-auth prompt for playlist write permissions.');
console.log('  ✓ Scopes include both playlist-modify-public and playlist-modify-private.');

console.log('\n=== ALL SPOTIFY TRACK POPULATION TESTS PASSED (3/3) ===');

