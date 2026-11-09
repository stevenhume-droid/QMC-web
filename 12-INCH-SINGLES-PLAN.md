# Implementation Plan for Claude: First-Class 12" Singles, Cassette & MiniDisc Categories, Metadata Refresh, Barcode Scanner, Auto-Minimising UI, Expanded Vinyl Search & Streaming Lookups (Spotify / Apple Music / YouTube / Bandcamp)

**Target File:** `catalogue/index.html`

---

## 1. First-Class Format Categories: `12" Maxi / Single`, `Cassette Tape` & `MiniDisc`

### 1.1 Format Selectors (`#filterFormat` ~line 402, `#autofillFormatFilter` ~line 899, `#formFormat` ~line 993)
* **Add `<option>` entries across all three format dropdowns**:
  * In `#filterFormat` (main toolbar) and `#formFormat` (Add/Edit modal):
    * `12" LP (Album)`
    * `2xLP Gatefold (Album)`
    * `Box Set (Vinyl / Multi-Disc)`
    * `12" Maxi / Single`
    * `7" Single (45 RPM)`
    * `10" Vinyl`
    * `Cassette Tape` *(new)*
    * `MiniDisc` *(new)*
    * `CD / Other`
  * In `#autofillFormatFilter` (Quick Lookup bar):
    * `ALL` → `Any Format`
    * `12` → `12" Vinyl / LP`
    * `12S` → `12" Single / Maxi` *(new)*
    * `BOX` → `Vinyl Box Set`
    * `7` → `7" Single (45 RPM)`
    * `10` → `10" Vinyl`
    * `CASSETTE` → `Cassette Tape` *(new)*
    * `MINIDISC` → `MiniDisc` *(new)*
    * `CD` → `CD / Other`

### 1.2 Top Summary Counter Conflation (`renderStats`, ~line 3969 & HTML ~line 319)
* **Current Problem**:
  ```javascript
  const lpCount = records.filter(r => r.format && r.format.includes('LP')).length;
  const singleCount = records.filter(r => r.format && (r.format.includes('7"') || r.format.includes('Single'))).length;
  ```
  Because `"12\" Maxi / Single"` contains `"Single"`, 12" singles are lumped into the `7"` counter (`#statTotalSingles`).
* **Fix**:
  * Separate into distinct counters in the top **Collection** summary card:
    * `#statTotalLPs`: `12" LP (Album)` / `2xLP Gatefold (Album)` / `Box Set (Vinyl / Multi-Disc)`
    * `#statTotal12Singles`: `12" Maxi / Single` (`r.format.includes('12"') && (r.format.includes('Maxi') || r.format.includes('Single'))`)
    * `#statTotalSingles`: `7" Single (45 RPM)` (`r.format.includes('7"')`)
  * Update the HTML subline in the first summary card (~line 319) to display:
    `<span id="statTotalLPs" class="text-amber-400 font-semibold">0</span> LP · <span id="statTotal12Singles" class="text-purple-400 font-semibold">0</span> 12" · <span id="statTotalSingles" class="text-cyan-400 font-semibold">0</span> 7"`

### 1.3 Format Badges (`getFormatBadge`, ~line 4242) & Generic Covers (`getDefaultCover`)
* Update `getFormatBadge(format)` to style each format distinctly:
  * `Box Set`: Indigo (`bg-indigo-500/20 text-indigo-300 border-indigo-500/30`, icon `fa-box-archive`)
  * `12" Maxi / Single`: Purple (`bg-purple-500/20 text-purple-300 border-purple-500/30`, icon `fa-circle-dot`)
  * `7" Single`: Cyan (`bg-cyan-500/20 text-cyan-300 border-cyan-500/30`, icon `fa-record-vinyl`)
  * `10" Vinyl`: Pink (`bg-pink-500/20 text-pink-300 border-pink-500/30`, icon `fa-record-vinyl`)
  * `Cassette Tape`: Emerald/Teal (`bg-teal-500/20 text-teal-300 border-teal-500/30`, icon `fa-tape`)
  * `MiniDisc`: Rose/Fuchsia (`bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30`, icon `fa-floppy-disk`)
  * `CD / Other`: Sky (`bg-sky-500/20 text-sky-300 border-sky-500/30`, icon `fa-compact-disc`)
  * `12" LP` / `2xLP`: Amber (`bg-amber-500/20 text-amber-400 border-amber-500/30`, icon `fa-compact-disc`)
* Update `getDefaultCover(format, artist, title)` so `12" Maxi / Single`, `Cassette Tape`, and `MiniDisc` each render a tailored SVG fallback label when no sleeve photo is set.

### 1.4 Collection Analytics Format Breakdown Bug (`renderAnalyticsView`, ~lines 4791–4799)
* **Current Problem**:
  In `formatCategories`, the `7" Single` matcher (`r => (r.format || '').includes('7"') || (r.format || '').toLowerCase().includes('single')`) runs *before* `12" Maxi / EP`, swallowing every `"12\" Maxi / Single"` item so `12" Maxi / EP` always shows `0`!
* **Fix**:
  Update `formatCategories` order and matchers to include `12" Maxi / Single`, `Cassette Tape`, `MiniDisc`, and `CD / Other`:
  ```javascript
  const formatCategories = [
    { key: '12" LP', label: '12" LP (Album)', icon: 'fa-solid fa-compact-disc', color: 'text-amber-400', barBg: 'bg-amber-400', count: 0, val: 0, matcher: r => (r.format || '').includes('LP') && !(r.format || '').includes('2x') && !(r.format || '').toLowerCase().includes('box') },
    { key: '2xLP Gatefold', label: '2xLP Gatefold', icon: 'fa-solid fa-book-open', color: 'text-purple-400', barBg: 'bg-purple-400', count: 0, val: 0, matcher: r => (r.format || '').includes('2x') || (r.format || '').toLowerCase().includes('gatefold') },
    { key: 'Box Set', label: 'Box Set', icon: 'fa-solid fa-box-archive', color: 'text-brass-400', barBg: 'bg-brass-400', count: 0, val: 0, matcher: r => (r.format || '').toLowerCase().includes('box') },
    { key: '12" Single', label: '12" Maxi / Single', icon: 'fa-solid fa-circle-dot', color: 'text-sky-400', barBg: 'bg-sky-400', count: 0, val: 0, matcher: r => (r.format || '').toLowerCase().includes('maxi') || ((r.format || '').includes('12"') && (r.format || '').toLowerCase().includes('single')) || (r.format || '').toLowerCase().includes('ep') },
    { key: '7" Single', label: '7" Single (45 RPM)', icon: 'fa-solid fa-record-vinyl', color: 'text-emerald-400', barBg: 'bg-emerald-400', count: 0, val: 0, matcher: r => (r.format || '').includes('7"') || ((r.format || '').toLowerCase().includes('single') && !(r.format || '').includes('12"')) },
    { key: '10" Vinyl', label: '10" Vinyl', icon: 'fa-solid fa-circle', color: 'text-pink-400', barBg: 'bg-pink-400', count: 0, val: 0, matcher: r => (r.format || '').includes('10"') },
    { key: 'Cassette', label: 'Cassette Tape', icon: 'fa-solid fa-tape', color: 'text-teal-400', barBg: 'bg-teal-400', count: 0, val: 0, matcher: r => (r.format || '').toLowerCase().includes('cassette') || (r.format || '').toLowerCase().includes('tape') },
    { key: 'MiniDisc', label: 'MiniDisc', icon: 'fa-solid fa-floppy-disk', color: 'text-fuchsia-400', barBg: 'bg-fuchsia-400', count: 0, val: 0, matcher: r => (r.format || '').toLowerCase().includes('minidisc') },
    { key: 'CD / Other', label: 'CD / Other', icon: 'fa-solid fa-compact-disc', color: 'text-slate-400', barBg: 'bg-slate-400', count: 0, val: 0, matcher: () => true }
  ];
  ```

### 1.5 Discogs Search & Valuation Bug (`getDiscogsSearchUrl` ~line 4294, `queryDiscogsMarketValue` ~line 6346, `queryEbayMarketValue` ~line 6646)
* **Current Problem**:
  `const is7Inch = (format || '').includes('7"') || (format || '').toLowerCase().includes('single');` evaluates to `true` for `"12\" Maxi / Single"` before `isMaxi` is checked!
* **Fix**:
  ```javascript
  const fmtLow = (format || '').toLowerCase();
  const is12Single = fmtLow.includes('maxi') || (fmtLow.includes('12"') && (fmtLow.includes('single') || fmtLow.includes('ep')));
  const is7Inch = fmtLow.includes('7"') || (fmtLow.includes('single') && !fmtLow.includes('12"'));
  const isCassette = fmtLow.includes('cassette') || fmtLow.includes('tape');
  const isMiniDisc = fmtLow.includes('minidisc');
  ```
  * Pass `format=12"` (for `is12Single`), `format=Cassette` (for `isCassette`), and `format=MiniDisc` (for `isMiniDisc`) to Discogs search & `getDiscogsSearchUrl`.
  * In `queryEbayMarketValue` fallback model (~line 6646) and `getCleanSearchTerms`:
    * Do not append `' vinyl'` to eBay search queries when the format is `Cassette Tape`, `MiniDisc`, or `CD / Other` (append `' cassette'`, `' minidisc'`, or `' cd'` respectively!).
    * Set calibrated fallback base values: `Cassette Tape` = `10.0`, `MiniDisc` = `22.0`, `12" Maxi / Single` = `12.5`.

### 1.6 Quick Lookup & MusicBrainz Autofill (`executeMusicBrainzSearch` ~line 7243 & `applySelectedRelease` ~line 7407)
* In `executeMusicBrainzSearch`:
  * `12S` → `format:"12\" Vinyl" AND (primarytype:single OR primarytype:ep)`
  * `CASSETTE` → `format:Cassette`
  * `MINIDISC` → `format:MiniDisc`
* In `applySelectedRelease`:
  * Request `+release-groups` in the MusicBrainz release detail fetch (`?inc=recordings+artist-credits+labels+genres+tags+release-groups&fmt=json`).
  * Map `searchFormatChoice === '12S'` or 12" vinyl with `release-group['primary-type']` of `'Single'`/`'EP'` (or `<= 4` tracks on a single 12" disc) → `'12" Maxi / Single'`.
  * Map `searchFormatChoice === 'CASSETTE'` or `formatName.includes('cassette')` → `'Cassette Tape'`.
  * Map `searchFormatChoice === 'MINIDISC'` or `formatName.includes('minidisc')` → `'MiniDisc'`.

### 1.7 Form Format Change Handler (`handleFormatChange`, ~line 5789)
* Add branches in `handleFormatChange()` for:
  * `12" Maxi / Single`: sets `formSpeed` to `'45 RPM'`, shows multi-track editor (`tracksAlbumContainer`), sets hint to `'12-inch single / maxi-single (45 or 33⅓ RPM, extended mixes & B-sides).'`.
  * `Cassette Tape`: shows multi-track editor, sets hint to `'Compact audio cassette tape (Side A / Side B program).'`.
  * `MiniDisc`: shows multi-track editor, sets hint to `'Magneto-optical MiniDisc release.'`.

### 1.8 Discogs CSV & Batch Import Parser (`parseDiscogsFormat`, ~line 7984)
* Update `parseDiscogsFormat(rawFormat)`:
  * **Cassette**: `if (f.includes('cassette') || f.includes('tape')) return 'Cassette Tape';` (must run *before* `CD / Other`!).
  * **MiniDisc**: `if (f.includes('minidisc') || /\bmd\b/.test(f)) return 'MiniDisc';` (must run *before* `CD / Other`!).
  * **12" Maxi / Single**: `if (f.includes('12"') && (f.includes('single') || f.includes('maxi') || f.includes('ep') || f.includes('45 rpm') || f.includes('promo') || (!f.includes('lp') && !f.includes('album')))) return '12" Maxi / Single';`

---

## 2. Batch Archive Metadata & Format Refresh Tool (For Titles Already in the Archive)

Many 12" singles, cassettes, or MiniDiscs already in the archive may currently be stored as `12" LP (Album)` or `CD / Other` (from earlier Discogs CSV imports or MusicBrainz lookups) or have missing/outdated genres, tracklists, years, or valuations.

### New Feature: **"Refresh Archive Metadata & Formats"** Modal (`#batchMetadataRefreshModal`)
* **Where to Trigger**:
  * In the desktop `⋮` menu (`#moreActionsPanel`) under **Enrichment & Metadata** → **Refresh Formats & Metadata**.
  * In the mobile **More** bottom sheet (`#mobileMoreSheet`).
* **What It Does (Per Record)**:
  1. **Queries Discogs Release API** (by `rec.discogsId` if present, or by `artist + title + catNo` search) and/or **MusicBrainz**:
     * **Format Re-Classification**: Inspects Discogs `formats` array (`name`, `descriptions` like `"12\""`, `"Single"`, `"Maxi-Single"`, `"EP"`, `"45 RPM"`, `"Cassette"`, `"MiniDisc"`, `"LP"`, `"Album"`, `"7\""`) and tracklist count:
       * Automatically re-classifies 12" singles that were mistakenly saved as `12" LP (Album)` → `12" Maxi / Single` (and updates `speed` to `'45 RPM'` if indicated on Discogs).
       * Automatically re-classifies `Cassette` and `MiniDisc` items that were previously grouped under `CD / Other` → `Cassette Tape` / `MiniDisc`.
     * **Metadata Backfill**:
       * Backfills missing `genres` (combining Discogs `genres` + `styles`, with iTunes fallback).
       * Backfills missing `year`, `country`, `label`, `catNo`, `discogsId`, and `tracks` (if empty).
     * **Optional Re-Valuation Checkbox**:
       * Checkbox (enabled by default): *"Re-fetch Discogs market valuation for any record whose format changed"*.
  2. **Live Progress & Summary Log**:
     * Shows progress bar, count of records re-classified (`12" Maxi / Single`, `Cassette Tape`, `MiniDisc`, etc.), count of records with backfilled metadata, and a live log of changes.
  3. **Persistence**:
     * Calls `saveRecordsToStorage()`, `renderStats()`, `renderRecords()`, and batch-upserts modified rows to Supabase Cloud (`supabaseClient.from('records').upsert(dbRows)`).

---

## 3. Barcode Scanner Audit & Mobile Fixes (`#scannerModal`, `openScannerModal`, `startScannerStream`, `handleBarcodeScanned`)

### 3.1 Missing Barcode Scan Triggers on Phones
* **Current Problem**:
  * `#quickScanBtn` in the top header was given `hidden md:flex`, and `#mobileBottomNav` / `#mobileMoreSheet` have no Barcode Scan button!
  * Inside `#recordModal`, the Barcode field (`#formBarcode`, ~line 1164) only has a "Lookup Online via MusicBrainz" button, with no button to launch the camera scanner.
  * As a result, there is currently **no way to open the barcode scanner on a phone**.
* **Fix**:
  * Add a **Scan** button directly in `#recordModal` (both in the top Quick Lookup bar and next to `#formBarcode`: `<button type="button" onclick="openScannerModal()" ...><i class="fa-solid fa-barcode"></i> Scan</button>`).
  * Add **Scan Barcode** to `#mobileMoreSheet` (as the first tile) and/or in the mobile header next to Sign In so it is 1-tap accessible from the main view.

### 3.2 Stop Auto-Focusing `#manualBarcodeInput` on Mobile (`openScannerModal`, ~line 7743)
* **Current Problem**:
  ```javascript
  setTimeout(() => {
    document.getElementById('manualBarcodeInput')?.focus();
  }, 250);
  ```
  On phones, calling `.focus()` immediately pops up the on-screen virtual keyboard, covering half the screen and pushing the camera viewfinder out of view right when the user is trying to aim their camera at a barcode.
* **Fix**:
  * Only focus `#manualBarcodeInput` on desktop (`if (window.innerWidth >= 640)`), never on mobile touch screens.
  * Hide or collapse the long "Vinyl pressed before ~1979 has no barcode" warning banner on phones so the camera viewfinder (`#qr-reader`) gets maximum vertical space immediately.

### 3.3 Camera Startup Order & Discogs Barcode Fallback (`startScannerStream` ~line 7604 & `handleBarcodeScanned` ~line 7758)
* **Camera Startup**: In `openScannerModal()`, start `startScannerStream(currentScannerCameraId)` *first* (using `{ facingMode: "environment" }`) and call `populateScannerCameras()` *after* the stream starts, avoiding double permission prompts or stalled enumeration on iOS Safari.
* **Discogs Barcode Fallback**:
  * Currently, `handleBarcodeScanned(code)` only calls `executeMusicBrainzSearch(cleanCode, true)`. Many UK/EU 12" singles, cassettes, and indie pressings have their barcode indexed on Discogs (`https://api.discogs.com/database/search?barcode=${encodeURIComponent(cleanCode)}&type=release`) even when MusicBrainz lacks the barcode.
  * When MusicBrainz barcode search returns 0 releases, automatically fall back to Discogs barcode search, populate the form fields (Artist, Title, Label, Cat#, Year, Discogs ID, Genres, Cover Art), and use `parseDiscogsFormat` on the Discogs `format` array so 12" singles, cassettes, and MiniDiscs scanned by barcode are automatically set to their proper format.

---

## 4. Auto-Minimise Quick Lookup Bar & "Save & Close" Footer in `#recordModal`

### 4.1 Current Problem (~lines 141–148, 890–955 & 1391–1411)
* **Quick Lookup Bar (~lines 890–955)**: On phones, the Quick Lookup bar (`#autofillFormatFilter`, `#searchArtistInput`, `#searchTitleInput`, `Search`, `Clear Entry`) wraps into 3–4 rows (~170–190px tall) and stays permanently expanded at the top of `#recordModal` even after a release is selected, when editing an existing record, or when the user is typing manually into the form fields below.
* **Save & Close Footer (`.rec-footer`, ~lines 141–148 & 1391–1411)**: On phones (`@media (max-width: 639px)`), `#recordForm .rec-footer` is pinned with `position: sticky; bottom: -1px;` and contains 4 buttons (`Cancel`, `Clear Entry`, `Save & Add Next`, `Save & Close`) that wrap into two rows (~95–110px tall).
* Together, the permanently expanded Quick Lookup bar + sticky `.rec-footer` consume nearly 300px of vertical height on phones, leaving almost no room for the form fields when the mobile keyboard is up.

### 4.2 Fix A: Auto-Minimising Quick Lookup Bar (`#quickLookupBar`)
1. **Collapsible Quick Lookup Header Strip**:
   * Give the Quick Lookup container `id="quickLookupBar"` with a compact summary header bar (`#quickLookupCollapsedBar`) that shows:
     * `✨ Quick Lookup & Barcode Scan` + a status badge (e.g. `"Matched: Artist – Title"` when applied, or `"Tap to search online"`) + `[▼ Expand]` / `[▲ Hide]` toggle button + a 1-tap `Scan` icon button.
2. **Automatic Collapse Triggers (`setQuickLookupCollapsed(true)`)**:
   * **After Search Selection**: Call `setQuickLookupCollapsed(true)` at the end of `applySelectedRelease(index)` so as soon as a release is chosen from MusicBrainz/Discogs, the lookup drawer and search inputs fold away into a slim single line.
   * **On Manual Input / Form Focus**: Attach a `focusin` / `input` listener on `#recordForm` (or when the user starts typing into `#formArtist`, `#formTitle`, `#formLabel`, `#formCatNo`, etc. or scrolls `#recordForm`) that automatically collapses `#quickLookupBar` (provided `#autofillResultsContainer` is not actively open).
   * **When Editing an Existing Record**: In `editRecord(id)`, start `#quickLookupBar` collapsed (`setQuickLookupCollapsed(true)`) since the record's fields are already populated.
   * **When Opening a Blank New Entry**: In `openAddEditModal()`, start expanded (`setQuickLookupCollapsed(false)`), and allow toggling anytime by tapping the bar or clicking `Lookup Online` (`quickLookupFromForm()`).

### 4.3 Fix B: Auto-Minimising Footer (`.rec-footer`) + Compact Header Save Button
1. **Compact Header "Save" Action**:
   * In the `#recordModal` top header (~line 841, right beside the `×` close button), add a compact primary **Save** button (`onclick="document.getElementById('recordForm').requestSubmit()"`). This ensures 1-tap saving is always available at the top without eating any extra vertical space.
2. **Auto-Minimise `.rec-footer` on New Entries & While Typing / Scrolling**:
   * Add a collapsed/minimised state to `.rec-footer` (`rec-footer-minimised`):
     * **When opening a New Entry** (`openAddEditModal` with empty `recordId`), or **whenever an `<input>`, `<textarea>`, or `<select>` inside `#recordForm` is focused** (i.e. when the mobile keyboard is up), or **while scrolling down**, automatically minimise `.rec-footer` into a slim, unobtrusive single-line pill bar (or keep it non-sticky at the bottom of the form on mobile until the user scrolls to the bottom or taps a small `▲ Actions` pill).
     * When the user scrolls to the bottom of `#recordForm` or taps the `▲` expand pill, smoothly reveal the full action bar (`Save & Close`, `Save & Add Next`, `Clear Entry`, `Cancel`).

---

## 5. Expanded Vinyl-First Multi-Source Search (`executeMusicBrainzSearch`, ~lines 7192–7275)

### 5.1 Why Vinyl Releases Are Currently Missed
1. **Top-15 Cap Swallowed by CDs & Digital Releases**:
   * `executeMusicBrainzSearch` queries `https://musicbrainz.org/ws/2/release/?query=artist:"..." AND (release:"..." OR releaseaccent:"...")&fmt=json&limit=15` **without** any format clause in the Lucene query.
   * For popular albums with 50–200 editions on MusicBrainz, the first 15 results returned by default relevance are frequently `CD` and `Digital Media`.
   * Post-filtering those 15 results in JavaScript (`lines 7243–7257`) means that if none of the top 15 happen to be Vinyl, zero Vinyl pressings are shown even when dozens of Vinyl pressings exist in MusicBrainz.
2. **Strict Phrase Quotes Block the Fallback Query**:
   * Because `artist:"..." AND release:"..."` uses strict phrase quotes, if even 1 CD or Digital edition matches the exact phrase (`releases.length > 0`), the relaxed keyword fallback (`lines 7232–7240`) never runs, and slight title variations (e.g. `"The Dark Side..."` vs `"Dark Side..."`, or subtitle/edition suffixes) miss the Vinyl pressing.
3. **Single-Database Limitation (MusicBrainz Release Search Only)**:
   * Quick Lookup currently only queries MusicBrainz `/ws/2/release/`. It never queries **MusicBrainz Release-Groups** (to find the master album and expand its Vinyl pressings) or **Discogs Database Search** (`https://api.discogs.com/database/search`), where many UK/EU vinyl LPs, 12" singles, white labels, and club pressings are catalogued.

### 5.2 Multi-Pronged Search Expansion Fix
1. **Pass Format Directly into the MusicBrainz Lucene Query & Run a Parallel Vinyl-Boosted Query**:
   * Increase `limit` from `15` to `25`.
   * Run parallel MusicBrainz queries via `Promise.allSettled`:
     * **Query A (Format-Targeted / Vinyl-First)**:
       * If `fmtChoice === 'ALL'` or `'12'` or `'7'` or `'10'`: append `AND (format:"Vinyl" OR format:"12\" Vinyl" OR format:"7\" Vinyl" OR format:"10\" Vinyl" OR format:"LP")` directly to the Lucene query so MusicBrainz returns Vinyl pressings from its index even when an album has 150 CD/Digital reissues.
       * If `fmtChoice === '12S'`: append `AND (format:"12\" Vinyl" OR format:"Vinyl") AND (primarytype:"Single" OR primarytype:"EP")`.
       * If `fmtChoice === 'CASSETTE'`: append `AND format:"Cassette"`.
       * If `fmtChoice === 'MINIDISC'`: append `AND format:"MiniDisc"`.
     * **Query B (Broad Unquoted + Quoted Release Search)**:
       * Query `artist:(${cleanA}) AND release:(${cleanT})` (unquoted token match alongside phrase match) so minor punctuation, `"The "`, or subtitle differences still match.
2. **MusicBrainz Release-Group Expansion Fallback**:
   * If the direct release queries return fewer than 3 Vinyl matches, automatically query `https://musicbrainz.org/ws/2/release-group/?query=artist:(${cleanA}) AND releasegroup:(${cleanT})&fmt=json&limit=3` and fetch the releases for the top matching release-group (`https://musicbrainz.org/ws/2/release?release-group=${rgId}&inc=labels+media+artist-credits&fmt=json&limit=50`), prioritizing Vinyl pressings.
3. **Discogs Parallel Search Integration**:
   * When a Discogs token is available (`localStorage.getItem('qmc_discogs_user_token') || localStorage.getItem('QMC_DISCOGS_TOKEN')`), run a parallel Discogs search (`https://api.discogs.com/database/search?artist=${encodeURIComponent(artist)}&release_title=${encodeURIComponent(title)}&format=Vinyl&type=release&per_page=10`) and merge Discogs results into `stagedOnlineReleases` (with a `SOURCE: DISCOGS` badge).
   * When the user clicks **Use This Pressing** on a Discogs result in `applySelectedRelease(index)`, fetch `https://api.discogs.com/releases/${match.discogsId}` to autofill the full tracklist, label, cat#, year, country, genres, Discogs ID, and cover artwork.
4. **Smart Deduplication & Vinyl-First Sorting**:
   * Merge and deduplicate candidates from Query A, Query B, Release-Group expansion, and Discogs.
   * Sort results so **Vinyl pressings (`12" Vinyl`, `LP`, `7" Vinyl`, `10" Vinyl`)** always appear at the top of `#autofillResultsContainer`, followed by Cassette/MiniDisc/CD, with a **"Search Broad / Include All Formats"** button at the bottom of the results list if the user wants to expand further.

---

## 6. Multi-Platform Streaming & Listening Lookups: Spotify, Apple Music, YouTube & Bandcamp

When archiving or exploring records, members often want to immediately audition the audio, verify mix versions (album cut vs 12" club mix vs 7" radio edit), or listen while browsing the archive.

### 6.1 Clean Search Terms Helper (`getStreamingSearchQuery(item, trackTitle)`)
* Clean up titles before building streaming URLs:
  * Remove release configuration parentheticals such as `(Album)`, `(45 RPM)`, `(Vinyl / Multi-Disc)`, `(Gatefold)`, `[Mono]`, `[Stereo]`.
  * For 7" and 12" singles where the release title is `"Side A / Side B"`, extract the primary track name for clean single-track streaming match.
  * If a specific `trackTitle` is passed, format as `${item.artist} ${trackTitle}`.

### 6.2 URL Generation Scheme (`getStreamingLinks(item, trackTitle)`)
Generate standardized, direct deep-search links for all 4 major listening platforms:
1. **Spotify**:
   * Web Search: `https://open.spotify.com/search/${encodeURIComponent(cleanQuery)}`
   * App URL Scheme (optional fallback): `spotify:search:${encodeURIComponent(cleanQuery)}`
   * Badge / Button: Green accent (`bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border-emerald-500/30`, icon `fa-brands fa-spotify`)
2. **Apple Music**:
   * Web Search: `https://music.apple.com/search?term=${encodeURIComponent(cleanQuery)}`
   * Badge / Button: Rose/Pink accent (`bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border-rose-500/30`, icon `fa-brands fa-apple`)
3. **YouTube / YouTube Music**:
   * Web Search: `https://www.youtube.com/results?search_query=${encodeURIComponent(cleanQuery)}`
   * YouTube Music alternative: `https://music.youtube.com/search?q=${encodeURIComponent(cleanQuery)}`
   * Badge / Button: Red accent (`bg-red-500/15 text-red-400 hover:bg-red-500/25 border-red-500/30`, icon `fa-brands fa-youtube`)
4. **Bandcamp**:
   * Web Search: `https://bandcamp.com/search?q=${encodeURIComponent(cleanQuery)}&item_type=a` (and `item_type=t` for singles/tracks)
   * Badge / Button: Cyan/Sky accent (`bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 border-cyan-500/30`, icon `fa-brands fa-bandcamp`)

### 6.3 Integration Points Across the Application
1. **Record Full Archival Dossier (`viewRecordDetail`, ~lines 5800–5980)**:
   * Directly below the **Market Valuation & Realized Pricing** card, add a dedicated **"Listen & Stream Online"** card:
     * Header: `<i class="fa-solid fa-headphones text-brass-400"></i> Stream & Audition Release`
     * 4 prominent branded 1-click pills:
       * **Spotify**: `fa-brands fa-spotify`
       * **Apple Music**: `fa-brands fa-apple`
       * **YouTube**: `fa-brands fa-youtube`
       * **Bandcamp**: `fa-brands fa-bandcamp`
   * Inside the **Tracklist Architecture** section:
     * Next to each track in the tracklist, add a compact `▶` or `fa-brands fa-youtube` / `fa-brands fa-spotify` 1-click icon button so the user can listen to that individual track/mix immediately.
2. **Add / Edit Modal (`#recordModal`)**:
   * In the top Quick Lookup bar and on Tab 4 (Research & Transfers), add a **"Listen / Test Audition"** link so the cataloguer can listen to mixes while inspecting deadwax etchings and catalog numbers.
3. **Gallery Card & Table Row Quick Actions**:
   * In Gallery cards and Table rows, add a compact `fa-headphones` popover or 1-click quick link to open Spotify/YouTube in a new tab.

---

## 7. Verification Checklist
- [ ] Verify `#statTotalLPs`, `#statTotal12Singles`, and `#statTotalSingles` all render and sum accurately in `renderStats()`.
- [ ] Confirm `getFormatBadge` renders distinct badges for `12" Maxi / Single` (purple), `Cassette Tape` (teal), and `MiniDisc` (fuchsia) in Gallery cards, Table rows, and the Record Dossier.
- [ ] Confirm `#filterFormat` in the main toolbar filters `12" Maxi / Single`, `Cassette Tape`, and `MiniDisc` cleanly.
- [ ] Confirm Collection Analytics (`renderAnalyticsView`, ~line 4791) fixes the `7" Single` vs `12" Maxi / Single` matcher order bug and displays dedicated rows for `12" Maxi / Single`, `Cassette Tape`, and `MiniDisc`.
- [ ] Verify `queryDiscogsMarketValue`, `getDiscogsSearchUrl`, and `queryEbayMarketValue` properly handle `12" Maxi / Single`, `Cassette Tape`, and `MiniDisc`.
- [ ] Verify barcode scanning is reachable on mobile (in header/More sheet and inside `#recordModal`), does not pop up the mobile keyboard on open, and falls back to Discogs when MusicBrainz has no barcode match.
- [ ] Verify `#quickLookupBar` auto-collapses once a search result is applied, when editing an existing record, or when typing manually into `#recordForm`, and can be re-expanded with 1 tap.
- [ ] Verify `.rec-footer` auto-minimises on new entries / while typing so form fields have maximum vertical screen space.
- [ ] Verify `executeMusicBrainzSearch` surfaces Vinyl pressings even for albums with dozens of CD/Digital reissues, supports unquoted/fuzzy title matching, and merges Discogs Vinyl matches when a token is configured.
- [ ] Verify **Streaming & Listening Lookups**:
  - Test 1-click buttons for **Spotify**, **Apple Music**, **YouTube**, and **Bandcamp** in the Record Dossier.
  - Test track-level listen buttons in the tracklist.
  - Verify query cleaner strips format suffixes like `(Album)` or `(45 RPM)` so streaming searches land on the exact song/album.
- [ ] Run brace and `<div>` balance checks before committing.
