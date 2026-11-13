import { readFileSync } from 'fs';
import { resolve } from 'path';
import assert from 'assert';

const htmlPath = resolve('catalogue/index.html');
const html = readFileSync(htmlPath, 'utf8');

console.log('=== VERIFYING GAP SCANNER PLAYLIST LISTING & DOSSIER BACK LINK ===\n');

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

// Test 2: SPOTIFY_SCOPES includes playlist-read-private and playlist-read-collaborative
console.log('\nTest 2: Verifying SPOTIFY_SCOPES includes playlist read scopes...');
const scopesMatch = html.match(/const SPOTIFY_SCOPES = \[([\s\S]*?)\]\.join/);
assert.ok(scopesMatch, 'SPOTIFY_SCOPES definition must exist');
assert.ok(scopesMatch[1].includes("'playlist-read-private'"), 'SPOTIFY_SCOPES must include playlist-read-private');
assert.ok(scopesMatch[1].includes("'playlist-read-collaborative'"), 'SPOTIFY_SCOPES must include playlist-read-collaborative');
console.log('  ✓ SPOTIFY_SCOPES includes playlist-read-private and playlist-read-collaborative.');

// Test 3: Gap Scanner UI elements for Sync & Authorize Playlists
console.log('\nTest 3: Verifying Gap Scanner Sync & Authorize UI...');
assert.ok(html.includes('id="gapPlaylistRefreshBtn"'), 'gapPlaylistRefreshBtn must exist');
assert.ok(html.includes('id="gapPlaylistScopeNotice"'), 'gapPlaylistScopeNotice must exist');
assert.ok(html.includes('id="gapPlaylistScopeNoticeText"'), 'gapPlaylistScopeNoticeText must exist');
console.log('  ✓ Gap Scanner playlist sync button and scope authorization banner verified.');

// Test 4: loadUserSpotifyPlaylists pagination, token refresh, and QMC set integration
console.log('\nTest 4: Verifying loadUserSpotifyPlaylists implementation...');
const loadFnMatch = html.match(/async function loadUserSpotifyPlaylists\([\s\S]*?\n    \}/);
assert.ok(loadFnMatch, 'loadUserSpotifyPlaylists must exist');
assert.ok(loadFnMatch[0].includes('refreshSpotifyAccessToken'), 'loadUserSpotifyPlaylists must proactively refresh expired tokens');
assert.ok(loadFnMatch[0].includes('data.next'), 'loadUserSpotifyPlaylists must paginate through all playlists');
assert.ok(loadFnMatch[0].includes('getQmcSavedSets'), 'loadUserSpotifyPlaylists must also surface exported QMC Sets');
console.log('  ✓ loadUserSpotifyPlaylists token refresh, pagination, and QMC Sets fallback verified.');

// Test 5: Dossier top-left button says "Back to Archive"
console.log('\nTest 5: Verifying Dossier back button text...');
assert.ok(!html.includes('Back to Crate'), 'Must not contain "Back to Crate"');
assert.ok(html.includes('<span>Back to Archive</span>'), 'Dossier back button must say "Back to Archive"');
console.log('  ✓ Dossier top-left link updated to "Back to Archive".');

console.log('\n=== ALL GAP SCANNER & DOSSIER BACK LINK TESTS PASSED (5/5) ===');
