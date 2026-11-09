# Implementation Plan for Claude: First-Class 12" Singles, Archive Metadata Refresh, Barcode Scanner & Auto-Minimising Save Bar

**Target File:** `catalogue/index.html`

---

## 1. First-Class 12" Singles Category (Root-Cause Audit & Fixes)

### 1.1 Top Summary Counter Conflation (`renderStats`, ~line 3969 & HTML ~line 319)
* **Current Problem**:
  ```javascript
  const lpCount = records.filter(r => r.format && r.format.includes('LP')).length;
  const singleCount = records.filter(r => r.format && (r.format.includes('7"') || r.format.includes('Single'))).length;
  ```
  Because `"12\" Maxi / Single"` contains `"Single"`, 12" singles are lumped into the `7"` counter (`#statTotalSingles`).
* **Fix**:
  * Separate into three distinct counters in the top **Collection** summary card:
    * `#statTotalLPs`: `12" LP (Album)` / `2xLP Gatefold (Album)` / `Box Set (Vinyl / Multi-Disc)`
    * `#statTotal12Singles`: `12" Maxi / Single` (`r.format.includes('12"') && (r.format.includes('Maxi') || r.format.includes('Single'))`)
    * `#statTotalSingles`: `7" Single (45 RPM)` (`r.format.includes('7"')`)
  * Update the HTML subline in the first summary card (~line 319) to display:
    `<span id="statTotalLPs" class="text-amber-400 font-semibold">0</span> LP · <span id="statTotal12Singles" class="text-purple-400 font-semibold">0</span> 12" · <span id="statTotalSingles" class="text-cyan-400 font-semibold">0</span> 7"`

### 1.2 Discogs Search & Valuation Bug (`getDiscogsSearchUrl` ~line 4294 & `queryDiscogsMarketValue` ~line 6346)
* **Current Problem**:
  ```javascript
  const is7Inch = (format || '').includes('7"') || (format || '').toLowerCase().includes('single');
  ```
  Because `"12\" Maxi / Single"` includes `'single'`, `is7Inch` evaluates to `true` before `isMaxi` is ever checked! As a result, 12" singles are priced and searched on Discogs as `7"` singles (`format=7"`).
* **Fix**:
  * Define:
    ```javascript
    const fmtLow = (format || '').toLowerCase();
    const is12Single = fmtLow.includes('12"') && (fmtLow.includes('single') || fmtLow.includes('maxi') || fmtLow.includes('ep'));
    const is7Inch = fmtLow.includes('7"') || (fmtLow.includes('single') && !fmtLow.includes('12"'));
    ```
  * In `getDiscogsSearchUrl` and `queryDiscogsMarketValue`, check `is12Single` (`isMaxi`) properly and pass `format_exact=12%22` / `format=12"`.

### 1.3 Quick Lookup & MusicBrainz Autofill Missing 12" Single Option (`#autofillFormatFilter` ~line 899, `executeMusicBrainzSearch` ~line 7243, `applySelectedRelease` ~line 7407)
* **Current Problem**:
  * `#autofillFormatFilter` only has `12" Vinyl / LP` (`value="12"`) and `7" Single` (`value="7"`), with no `12" Single / Maxi` (`value="12S"`) option.
  * In `applySelectedRelease` (~line 7420), when inspecting a MusicBrainz release, if `media[0].format` is `12" Vinyl`, it always defaults to `'12" LP (Album)'` even when `release-group['primary-type']` is `'Single'` or `'EP'`, or when the release has `<= 4` tracks.
* **Fix**:
  * Add `<option value="12S">12" Single / Maxi</option>` to `#autofillFormatFilter`.
  * In `executeMusicBrainzSearch`, map `12S` to `format:"12\" Vinyl" AND (primarytype:single OR primarytype:ep)`.
  * In `applySelectedRelease`:
    * Include `+release-groups` in the MusicBrainz detail fetch URL (`?inc=recordings+artist-credits+labels+genres+tags+release-groups&fmt=json`).
    * Auto-assign `'12" Maxi / Single'` when `searchFormatChoice === '12S'`, or when a 12" vinyl release has `release-group['primary-type']` of `'Single'` or `'EP'`, title includes `'12"'` / `'maxi'` / `'extended'`, or total tracks on a single 12" disc is `<= 4`.

### 1.4 Form Format Change Handler (`handleFormatChange`, ~line 5789)
* **Current Problem**:
  * Only checks `isSingle = format.includes('7"')` and `isBoxSet`, treating `12" Maxi / Single` as a 33⅓ RPM LP.
* **Fix**:
  * Add an `is12Single = format.includes('Maxi') || format.includes('12" Single')` branch:
    * Default `formSpeed` to `'45 RPM'` (most 12" singles are 45 RPM, while still allowing 33⅓ RPM).
    * Show the multi-track editor (`tracksAlbumContainer`) since 12" singles often have 2–4 mixes (e.g., `A1. Extended Mix`, `B1. Dub`, `B2. Instrumental`).
    * Update `#formatHintText` to: `'12-inch single / maxi-single (45 or 33⅓ RPM, extended mixes & B-sides).'`.

### 1.5 Discogs CSV Import Parser (`parseDiscogsFormat`, ~line 7984)
* **Current Problem**:
  * On Discogs, 12" singles are often tagged as `"Vinyl, 12\", 45 RPM"` or `"Vinyl, 12\", Promo"` without the word `"Single"` or `"Maxi"` (whereas LPs always include `"LP"` or `"Album"`).
  * Currently, those fall through to line 7993 (`f.includes('12"')`) and get misclassified as `'12" LP (Album)'`.
* **Fix**:
  * In `parseDiscogsFormat`, classify as `'12" Maxi / Single'` whenever `f.includes('12"')` AND (`f.includes('single') || f.includes('maxi') || f.includes('ep') || f.includes('45 rpm') || f.includes('promo') || (!f.includes('lp') && !f.includes('album'))`).

### 1.6 Cover Art & Default Sleeve Badge (`getDefaultCover` & `applySelectedRelease`)
* Ensure `findOnlineCoverArtwork` remains enabled for `12" Maxi / Single` (since 12" singles usually have picture sleeves).
* In `getDefaultCover`, give `12" Maxi / Single` a distinct label/accent when falling back to a generic sleeve so it is visually distinguishable from a 12" LP and a 7" single.

---

## 2. Batch Archive Metadata & Format Refresh Tool (For Titles Already in the Archive)

Many 12" singles already in the archive may currently be stored as `12" LP (Album)` (from earlier Discogs CSV imports or MusicBrainz lookups) or have missing/outdated genres, tracklists, years, or valuations.

### New Feature: **"Refresh Archive Metadata & Formats"** Modal (`#batchMetadataRefreshModal`)
* **Where to Trigger**:
  * In the desktop `⋮` menu (`#moreActionsPanel`) under **Enrichment & Metadata** → **Refresh Formats & Metadata**.
  * In the mobile **More** bottom sheet (`#mobileMoreSheet`).
* **What It Does (Per Record)**:
  1. **Queries Discogs Release API** (by `rec.discogsId` if present, or by `artist + title + catNo` search) and/or **MusicBrainz**:
     * **Format Re-Classification**: Inspects Discogs `formats` array (`name`, `descriptions` like `"12\""`, `"Single"`, `"Maxi-Single"`, `"EP"`, `"45 RPM"`, `"LP"`, `"Album"`, `"7\""`) and tracklist count:
       * Automatically re-classifies 12" singles that were mistakenly saved as `12" LP (Album)` → `12" Maxi / Single` (and updates `speed` to `'45 RPM'` if indicated on Discogs).
       * Also fixes any `7"` or `2xLP Gatefold` or `Box Set` mismatches if detected from the official Discogs release entry.
     * **Metadata Backfill**:
       * Backfills missing `genres` (combining Discogs `genres` + `styles`, with iTunes fallback).
       * Backfills missing `year`, `country`, `label`, `catNo`, `discogsId`, and `tracks` (if empty).
     * **Optional Re-Valuation Checkbox**:
       * Checkbox (enabled by default): *"Re-fetch Discogs market valuation for any record whose format changed (e.g. LP/7" → 12" Single)"*.
  2. **Live Progress & Summary Log**:
     * Shows progress bar, count of records re-classified to `12" Maxi / Single`, count of records with backfilled metadata, and a live log of changes.
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
* **Discogs Barcode Fallback (Especially for 12" Singles)**:
  * Currently, `handleBarcodeScanned(code)` only calls `executeMusicBrainzSearch(cleanCode, true)`. Many UK/EU 12" singles and indie pressings have their barcode indexed on Discogs (`https://api.discogs.com/database/search?barcode=${encodeURIComponent(cleanCode)}&type=release`) even when MusicBrainz lacks the barcode.
  * When MusicBrainz barcode search returns 0 releases, automatically fall back to Discogs barcode search, populate the form fields (Artist, Title, Label, Cat#, Year, Discogs ID, Genres, Cover Art), and use `parseDiscogsFormat` on the Discogs `format` array so 12" singles scanned by barcode are automatically set to `12" Maxi / Single`.

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

## 5. Verification Checklist
- [ ] Verify `#statTotalLPs`, `#statTotal12Singles`, and `#statTotalSingles` all render and sum accurately in `renderStats()`.
- [ ] Confirm `getFormatBadge('12" Maxi / Single')` renders a distinct purple badge in Gallery cards, Table rows, and the Record Dossier.
- [ ] Confirm `#filterFormat` in the main toolbar filters `12" Maxi / Single` cleanly without matching `12" LP (Album)` or `7" Single (45 RPM)`.
- [ ] Confirm Collection Analytics (`renderAnalyticsView`, ~line 4796) matches all `12" Maxi / Single` records in the format breakdown chart.
- [ ] Verify `queryDiscogsMarketValue` and `getDiscogsSearchUrl` no longer misidentify `12" Maxi / Single` as `is7Inch`.
- [ ] Verify barcode scanning is reachable on mobile (in header/More sheet and inside `#recordModal`), does not pop up the mobile keyboard on open, and falls back to Discogs when MusicBrainz has no barcode match.
- [ ] Verify `#quickLookupBar` auto-collapses once a search result is applied, when editing an existing record, or when typing manually into `#recordForm`, and can be re-expanded with 1 tap.
- [ ] Verify `.rec-footer` auto-minimises on new entries / while typing so form fields have maximum vertical screen space.
- [ ] Run brace and `<div>` balance checks before committing.
