# Project Plan & Assessment (PNA): Vinyl Store Radar Phase 2

**Project Name:** Vinyl Store Radar (Queensferry Music Collective Vinyl Directory)  
**Current Status:** Milestone 1 & 2 Completed • Live at `http://www.queensferrymusiccollective.co.uk/record-shops/`  
**Target Scope:** Forth & Lothian 20-Mile Catchment (Edinburgh, West Lothian, Fife, Falkirk)  

---

## 1. Executive Summary
Phase 1 successfully deployed a high-performance, mobile-responsive local directory featuring Haversine distance calculation from South Queensferry (EH30), Leaflet map integration, and structured digger reviews. 

**Phase 2** focuses on three core pillars:
1. **Granular Media & Resource Tracking:** Adding format filtering (`12"`, `7"`, `CDs`, `Cassettes`) and direct store website links. *(Completed - Milestone 1)*
2. **Live Field Geolocation:** Enabling users out on the road to sort store distances relative to their exact mobile GPS position. *(Completed - Milestone 2)*
3. **Cloud Persistence & Trust:** Hardening Supabase real-time review integration and adding basic submission anti-spam measures. *(Next - Milestone 3)*

---

## 2. Milestone Breakdown & Technical Specs

### Milestone 1: Formats & Official Links (`stores.json` / UI) [COMPLETED]
* **Objective:** Allow crate-diggers to filter stores by exact physical media formats.
* **Data Schema Updates:**
  * Add `formats: ["12\"", "7\"", "CDs", "Cassette"]` array to store records.
  * Add `website: "https://..."` string attribute.
* **UI Changes:**
  * Add format toggle pills to the header filter toolbar alongside existing feature chips.
  * Update `renderStores()` filter logic to enforce multi-format matching.
  * Render cyan-styled format badges and external web links on store cards.

### Milestone 2: Live Browser Geolocation [COMPLETED]
* **Objective:** Recalculate distance and re-sort store cards based on the user's live mobile coordinates.
* **Implementation Steps:**
  * Add a *"Near Me"* button to the header controls.
  * Invoke `navigator.geolocation.getCurrentPosition()`.
  * Dynamically recalculate Haversine distance across all stores, re-sort the sidebar array from closest to furthest, render user location pulse pin on map, and allow resetting to South Queensferry EH30 baseline.

### Milestone 3: Production Supabase Sync & Hygiene
* **Objective:** Ensure multi-user review synchronization with spam prevention.
* **Implementation Steps:**
  * Verify `reviews` table RLS policies on Supabase.
  * Implement client-side submission throttling (cooldown timer) and input validation in `submitReview()`.

---

## 3. Execution Roadmap

| Milestone | Task Items | Estimated Effort | Priority | Status |
| :--- | :--- | :--- | :--- | :--- |
| **M1: Formats & Links** | Update JSON schema, add filter buttons, style badges & web links | 1 Session | High | **Done** |
| **M2: Live Geolocation** | Implement `navigator.geolocation`, dynamic Haversine re-sorting, pulse pin | 1 Session | Medium | **Done** |
| **M3: DB & Hygiene** | Verify Supabase RLS, add submission rate-limiting / validation | 1 Session | High | Next |

---
*Prepared for Queensferry Music Collective / Vinyl Store Radar development.*