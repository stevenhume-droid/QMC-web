# Master Specification Prompt: Music Media Archive (MMA) — Archival, Valuation & DJ Studio Web Application

Copy and paste the prompt block below into any AI coding agent, design system generator, or full-stack builder to architect and build a clean-sheet, production-grade version of the **Music Media Archive (MMA)** platform with optimal information architecture, responsive UI, deduplication guarantees, and deep API integrations.

---

```markdown
# ROLE & OBJECTIVE
You are a Principal Product Designer, UX Architect, and Lead Full-Stack Web Engineer specializing in high-craft music archival platforms, audiophile tools, and DJ workflow software (combining the tactile precision of Teenage Engineering, the editorial depth of Discogs/Criterion Collection, and the fluid dark-mode performance of Rekordbox/Spotify).

Your task is to design and build the **Music Media Archive (MMA)**—a comprehensive, offline-first, cloud-synced web application for vinyl and physical music collectors, archivists, and DJs to catalogue, value, deduplicate, research, curate, and perform with their physical music collection.

---

# 1. DESIGN SYSTEM & VISUAL LANGUAGE ("WARM ARCHIVAL STUDIO")

## 1.1 Aesthetic & Theme Architecture
- **Dual-Mode Palette with High-Contrast Opaque Surfaces**:
  - **Studio Dark (Default)**: Deep obsidian canvas (`#0B0C10`), elevated slate cards (`#12151C`), solid opaque modal/drawer surfaces (`#161922`—never transparent over background watermarks/logos when expanded), hairline borders (`rgba(255,255,255,0.08)`), warm amber/gold primary accent (`#D97706` / `#F59E0B`), emerald valuation/success accent (`#10B981`), and crimson grail/alert accent (`#F43F5E`).
  - **Archival Light ("Warm Paper")**: Warm parchment background (`#F6F3EC`), ivory cards (`#FFFDF9`), ink typography (`#18181B`), and burnt sienna accents (`#B45309`).
- **Typography**:
  - **Display / Editorial Headers**: High-character serif or geometric display (`Playfair Display` or `Space Grotesk`) for album titles, artist dossiers, and KPI hero figures.
  - **UI & Controls**: Clean grotesk sans-serif (`Inter` or `Plus Jakarta Sans`) for navigation, filters, and forms.
  - **Technical / Archival Metadata**: Tabular monospace (`JetBrains Mono`) for catalog numbers (`CAT#`), matrix/runout etchings, BPM, Camelot keys (`8A`, `11B`), track durations, and currency valuations (`£`, `$`, `€`).

## 1.2 Spatial Architecture & Z-Index Layering Contract
To eliminate modal collisions and "screen behind screen" bugs, enforce a strict, centralized **6-Tier Z-Index Token System**:
1. **Tier 0 (`z-0` to `z-10`)**: Base canvas, ambient MMA background watermark, and primary view containers.
2. **Tier 1 (`z-30` to `z-40`)**: Sticky command header, filter rail, bulk-selection action bar, and mobile bottom navigation dock.
3. **Tier 2 (`z-50` to `z-60`)**: Slide-over utility drawers when invoked from the main workspace (Now Playing queue, Quick Filter drawer).
4. **Tier 3 (`z-70`)**: **Record Dossier (`#detailModal`)** — Primary full-detail inspection view.
  - *Navigation Rule*: Switching any top-level workspace view (`Archive`, `Crates`, `Box & Set Studio`, `Wishlist`, `Insights`, `Calendar`) MUST automatically close the Dossier so views never render behind an open modal.
5. **Tier 4 (`z-85`)**: **Contextual Action Modals & Drawers launched FROM inside the Dossier or Workspace** — Record Editor (`#recordModal`), Box & Set Drawer (`#recordBoxDrawer`), Crate Assignment (`#crateAssignModal`), Extended Archival Metadata (`#extendedArchivalModal`), Wishlist Editor (`#wishlistModal`), and Duplicate Resolution Modal (`#duplicateResolutionModal`).
6. **Tier 5 (`z-90` to `z-100`)**: **Nested Pickers, Lightboxes & System Confirmations** — Sleeve/Artwork Chooser (`#artworkChooserModal`), Artist Bio Editor (`#bioEditorModal`), Barcode/Matrix Camera Scanner, Pop-Out Set Window Controller, and Toast Notifications.
- *Mobile Rule*: Never apply a blanket CSS `z-index: !important` override on mobile breakpoints that flattens Tier 3, Tier 4, and Tier 5 modals onto the same plane.

---

# 2. INFORMATION ARCHITECTURE & NAVIGATION

## 2.1 Desktop Layout
- **Top Command Header**:
  - **Music Media Archive (MMA)** brand identity + Active Member/Cloud Sync status pill + Global Command Palette trigger (`Cmd/Ctrl + K`).
  - **Primary Workspace Switcher**:
    1. **Archive** (with sub-view toggles: *Grid*, *Data Table*, *3D/Tactile Shelf*, *Full-Bleed Gallery*)
    2. **Crates** (Thematic collections & smart crates)
    3. **Box & Set Studio** (Active DJ Record Box + Setlist Builder, with badge count)
    4. **Wishlist** (Target pressings, Grails, budget tracker & marketplace hunter, with badge count)
    5. **Insights** (Collection valuation, genre/decade distribution, label breakdown, price history)
    6. **Calendar** (Acquisition timeline & release anniversaries)
  - **Primary CTA**: `+ Add Media` button + Quick Barcode Scan trigger + `BOX` slide-over toggle.
- **Collapsible Filter & Search Bar**:
  - Instant search across Artist, Title, Label, Catalog #, Matrix/Runout, Genre, Year, and Notes.
  - Multi-facet pills: Genre, Decade, Format (`LP`, `2xLP`, `12"`, `7"`, `10"`, `Box Set`, `CD`, `Cassette`), Condition (`M`, `NM`, `VG+`, `VG`), Crate, Valuation Tier, and Sort Order (Artist A–Z, Date Added, Year, Highest Value, Last Played, Random Shuffle).

## 2.2 Mobile-First Ergonomics (`< 640px`)
- **Clean Top Bar**: **Music Media Archive** title, live item/valuation counter, search bar, and view-mode icons (no redundant top `+ Add` button).
- **Thumb-Zone Bottom Navigation Dock (5 Slots)**:
  1. **Archive** (Home collection view)
  2. **Crates** (Collections)
  3. **`+ Add` (Central Elevated FAB)** — Opens manual entry, barcode scanner, or AI sleeve recognition.
  4. **Box** (Active DJ Box & Setlist drawer)
  5. **`...` (More Sheet)** — Opens a clean bottom sheet containing:
     - **Primary Tools**: *Wishlist*, *Spotify Gap Scanner*, *Duplicate Scanner & Merger*, *Insights*, *Calendar*, *Shelf/Gallery Views*, *Cloud Sync*, *Export/Import Backup*.
     - **Destructive Actions Safety Rule**: Place low-risk utilities (*Hard Reload App*, *Theme Toggle*) in the easy thumb zone, and isolate destructive actions (*Clear Archive*) at the far top/guarded edge with a two-step confirmation so they are never accidentally thumbed.

---

# 3. CORE FUNCTIONAL MODULES

## 3.1 Module A: The Archive & Multi-Mode Browser
- **Grid View**: High-resolution square sleeve cards with hover/tap quick-actions (Play Preview, Add to Active Box, Assign to Crate, Condition badge, Valuation pill, Copy Count badge if `copies > 1`).
- **Table View**: High-density spreadsheet view with sortable columns (Sleeve thumb, Artist, Title, Label, Cat#, Year, Format, Media/Sleeve Grading, Est. Value, Box/Crate tags) and inline bulk selection.
- **Shelf / Spine View**: Virtual spine browser grouped alphabetically, by genre, or by chronological release.
- **Gallery / Attract Mode**: Full-screen kinetic sleeve wall for big-screen display while playing records.

## 3.2 Module B: Record Dossier ("Back to Archive" Deep View)
- **Header Bar**: `← Back to Archive` navigation button (left), quick prev/next record arrows, and contextual action toolbar (right):
  - `Edit`, `Sleeves` (Artwork Chooser), `Crate` (Assign Crates), `BOX` (Add/Remove from Active DJ Box), `Archival` (Extended Matrix/Pressing Details), and `Delete`.
- **Two-Column Editorial Layout**:
  - **Left Column**: High-res interactive cover artwork (front/back/label gallery + 1-click *Sleeves* online artwork chooser via iTunes/MusicBrainz/Discogs/Spotify), physical format specs, vinyl color/weight variant, and Media/Sleeve Goldmine grading badges (`M`, `NM`, `VG+`, etc.).
  - **Right Column**:
    - Artist, Title, Label, Catalog #, Country, Release Year, Original vs. Reissue indicator.
    - **Opaque Valuation & Market Panel**: Solid opaque card (preventing any MMA background logo bleed-through) showing Estimated Value, Low/Median/High market range, Purchase Price, ROI delta, Price History sparkline, and 1-click **Refresh Valuation** + direct marketplace links (Discogs Release/Master, eBay Active, eBay Sold, Popsike).
    - **Interactive Tracklist & DJ Audio Metadata**: Side-by-side track listing (`A1`, `A2`, `B1`...) with track durations, individual BPM, musical key / Camelot notation, and embedded Spotify/audio preview player.
    - **Artist Biography & Liner Notes**: Rich editorial bio (with *Bio Editor* modal and Wikipedia/Last.fm/Discogs auto-fetch) plus personal collector notes and provenance.

## 3.3 Module C: Multi-Source Media Ingestion & Real-Time Duplicate Guard
- **Manual & Assisted Entry Modal (`#recordModal`)**:
  - **Smart Auto-Fill**: Type Artist + Title or Catalog # or scan/enter EAN/UPC Barcode to query Discogs, MusicBrainz, iTunes, and Spotify simultaneously.
  - **Pressing Disambiguation Picker**: Choose exact country, year, label, catalog number, and format from matching pressings.
- **Ingest Duplicate Detection Engine (Pre-Save & Bulk Import)**:
  - **Live Typing / Pre-Save Check**: As the user enters or auto-fills a record (or acquires from Wishlist / imports via CSV/JSON/Discogs), compute a **Canonical Release Fingerprint**:
    1. *Exact External ID Match*: Same `discogsReleaseId`, `musicbrainzId`, or non-empty `barcode` (EAN/UPC).
    2. *Exact Pressing Match*: Normalized `artist + title + catNo` (stripping punctuation, articles like "The", and whitespace).
    3. *Fuzzy Album Match*: Normalized `artist + title + format` (Levenshtein / token similarity `>= 0.90`).
  - **Interactive Duplicate Resolution Prompt (`#duplicateResolutionModal`)**:
    - Side-by-side diff comparing the **Incoming Item** vs. the **Existing Archive Record** (highlighting differences in Cat#, Year, Condition, Valuation, Cover Art, and Crates).
    - **3 Clear Resolution Actions**:
      1. **Merge & Enrich Existing Record (Recommended)**: Keeps a single record, backfilling any missing metadata, higher-res artwork, tracklist, or updated valuation without duplicating the entry.
      2. **Add as Additional Copy / Pressing Variant**: Increments `quantity` or saves as a linked pressing variant (e.g., UK 1st Press vs. Japanese Reissue) with an explicit `variantNote`.
      3. **Skip / Cancel Ingest**: Discards the duplicate entry.

## 3.4 Module D: DJ Record Box & Setlist Studio (`BOX` & `SET`)
Designed for live gig preparation, radio shows, and listening sessions:
- **Multi-Box Picker & Active Box Management**:
  - Create, rename, duplicate, and delete multiple named Record Boxes.
  - Clicking any Box card immediately makes it the **Active Box** (visually highlighted with an `ACTIVE` badge and emerald/amber border) so all quick `+ BOX` buttons across the Archive and Dossier route records directly into that selected box.
  - Physical capacity meter (e.g., 50 LP / 80 7" fill bar and estimated carry weight).
- **Dual-Pane Box & Setlist Workspace**:
  - **Box Pool (Left/Top)**: Records packed in the active box, filterable and sortable by BPM, Key, Genre, or Energy.
  - **Setlist Timeline (Right/Bottom)**: Ordered track-by-track performance sequence with specific Side/Track selection (`A1`, `B2`), transition notes, BPM delta warnings, Camelot harmonic compatibility indicator, and cumulative set runtime timer.
- **Dedicated Display Modes**:
  1. **Drawer Mode**: Slide-over panel (`z-index: 85`) accessible from anywhere, including on top of an open Dossier.
  2. **Full-Screen Box Mode**: Expands the entire Box & Set Studio to 100% viewport width/height.
  3. **Full-Screen Set Mode (Booth Performance View)**: High-contrast, large-type live DJ prompt showing Current Track, Next Track, Side/Track index (`A2 → B1`), BPM, Key, and gig timer.
  4. **Pop-Out Set Window (`↗ New Window`)**: Opens a standalone, live-synced browser window (`BroadcastChannel` + `localStorage` sync) for a secondary booth display.

## 3.5 Module E: Wishlist / Wantlist & Acquisition Engine
- **Dedicated Wishlist Workspace**:
  - **Summary KPI Strip**: *Total Wanted*, *Grails Count*, *High Priority Count*, and *Estimated Hunt Budget*.
  - **Priority Tiers**: `Grail` (rose/crimson badge), `High` (amber), `Medium` (sky), `Low` (slate), with 1-click filter pills and instant search.
  - **Wishlist Duplicate Check**: Prevents adding an item to the Wishlist if it already exists in the Wishlist OR warns if the user already owns that album in the main **Archive**.
- **Add / Edit Wishlist Modal (`#wishlistModal`)**:
  - Artist, Album/Release Title, Format, Year, Priority Tier, Label, Catalog #, Target/Max Price, Cover Artwork URL, Pressing Notes, and 1-click **Online Auto-Fill**.
- **Marketplace Hunt Links & 1-Click Acquisition**:
  - Direct outbound hunt buttons: **Discogs**, **eBay Active**, **eBay Sold**, and **Spotify**.
  - **`Acquired → Move to Archive` Workflow**: Transfers a Wishlist item into the main Archive (running through the Ingest Duplicate Guard so if the record already exists in the Archive, it merges cleanly rather than creating a duplicate), removes it from the Wishlist, updates counters, and opens the Record Dossier.

## 3.6 Module F: Spotify Integration & Collection Gap Scanner
- **OAuth 2.0 PKCE Client-Side Authentication**: Serverless Spotify login supporting user profile, saved tracks, saved albums, and playlists.
- **Complete Playlist Pagination**:
  - Fetch ALL user and collaborative playlists (`limit=50` loop until `next === null`), plus a manual **Paste Spotify Playlist URL/URI** fallback.
- **Collection Gap Scanner**:
  - Cross-references tracks/albums from selected Spotify playlist(s) against the physical Archive.
  - Highlights **Missing Albums ("Gaps")** ranked by track frequency, with 1-click **`+ Wishlist`** (deduplicated against existing Wishlist entries).

---

# 4. DATA ARCHITECTURE, CLOUD SYNC DEDUPLICATION & INTEGRATIONS

## 4.1 Deterministic Identity & Cloud Sync Reconciliation Engine
A critical failure mode in local-first + cloud-synced apps is record duplication when syncing across multiple devices, browser sessions, or re-imports. **Music Media Archive (MMA)** must enforce a strict **Idempotent Sync & Deduplication Protocol**:

1. **Dual-Key Identity Schema on Every Record**:
   - `id`: Immutable UUID v4 assigned at creation.
   - `fingerprint`: Deterministic canonical hash generated from `normalize(artist) + "::" + normalize(title) + "::" + normalize(catNo || discogsReleaseId || barcode || format)`.
   - `updatedAt`: ISO-8601 modification timestamp + monotonic `revision` counter.
   - `deletedAt`: Soft-delete tombstone timestamp so deleted records are not resurrected as duplicates during two-way cloud sync.

2. **Two-Way Cloud Sync Deduplication Pipeline (Pre-Merge & Post-Merge)**:
   - When syncing local state (`IndexedDB` / `localStorage`) with the Cloud store (per Member ID):
     - **Step 1 (ID Match)**: Match records sharing the same `id` and resolve field-level conflicts using Last-Write-Wins (`updatedAt`) while union-merging non-destructive arrays (`crates`, `tags`, `boxIds`, `priceHistory`).
     - **Step 2 (Fingerprint / Semantic Match for Different IDs)**: If a local record and a cloud record have *different* `id` values (e.g., added independently on phone and desktop, or re-imported before sync) but share the same `discogsReleaseId`, non-empty `barcode`, or canonical `artist + title + catNo` fingerprint (unless explicitly marked `isIntentionalDuplicateCopy: true`):
       - **Auto-Consolidate into a Single Canonical Record**: Retain the earliest `dateAdded` and primary `id`, keep the richest/non-empty metadata fields (preferring custom uploaded/chosen artwork over generic placeholders, preserving highest-completeness tracklists, and merging all Crate and DJ Box references so no Box or Setlist link breaks).
     - **Step 3 (Sync Audit Summary)**: Display a non-intrusive sync toast or log (e.g., *"Cloud Sync complete: 342 records synced, 3 cloud duplicates automatically merged"*).

3. **On-Demand "Find & Merge Duplicates" Utility**:
   - Accessible from the Archive toolbar and Mobile `...` menu.
   - Scans the entire Archive for Exact Matches (same Cat#/Barcode) and Fuzzy Matches (same Artist + Title with different/missing Cat#).
   - Provides a batch **"Merge All Exact Duplicates"** button and an interactive side-by-side picker for fuzzy matches where the user can choose which sleeve art, grading, and notes to keep, or mark two records as **Keep Both (Distinct Pressings)**.

## 4.2 Offline-First Storage Keys
- **Primary Store**: IndexedDB with synchronous mirror to versioned keys:
  - `mma_catalogue_records_v1` (with automatic migration from legacy `qmc_vinyl_catalogue_v2`)
  - `mma_crates_v1`
  - `mma_record_boxes_v1` & `mma_active_box_id_v1`
  - `mma_wantlist_v1`
  - `mma_sync_tombstones_v1` (tracks deleted IDs/fingerprints so cloud sync never re-adds deleted records)
- **Atomic Full-State JSON Backup & Restore**: Bundles `records`, `crates`, `boxes`, `activeBoxId`, `wantlist`, and `tombstones` with an option on import to **Smart Merge & Deduplicate** or **Replace Entire Archive**.

---

# 5. QUALITY, ACCESSIBILITY & VERIFICATION REQUIREMENTS
1. **Unique DOM IDs**: Every static and dynamically rendered interactive element must maintain unique DOM IDs across the entire document.
2. **Opaque Elevated Surfaces**: All expanded valuation panels, member authentication overlays, and modals must use solid opaque backgrounds with proper contrast ratios (`>= 4.5:1`) so the MMA background logo or underlying grid artwork never bleeds through.
3. **Keyboard & Screen Reader Support**: `Esc` closes only the topmost active modal/drawer in the z-index stack (`Tier 5 → Tier 4 → Tier 3`), arrow keys navigate between records in the Dossier, and `/` or `Cmd+K` focuses search.
4. **Automated Verification Suite**: Include a headless DOM/VM verification test suite validating:
   - Static HTML ID uniqueness.
   - Modal z-index hierarchy (`Dossier < Action Drawers/Modals < Pickers`).
   - Auto-closing Dossier when switching top-level views.
   - Active Box switching, Full-Screen Box/Set toggles, and Pop-Out Set window payload generation.
   - Full Wishlist CRUD, CSV/JSON export, and `Acquired → Move to Archive` state transition.
   - **Ingest & Cloud Sync Deduplication**: Verify that ingesting or cloud-syncing two records with different UUIDs but identical `Artist + Title + Cat#` (or `discogsReleaseId`) merges their metadata and crate/box memberships into a single record without data loss.
```
