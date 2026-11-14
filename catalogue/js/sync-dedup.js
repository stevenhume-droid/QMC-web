/**
 * Sync Tombstones & Semantic Deduplication Engine for QMC Music Media Archive.
 * Implements soft-delete tombstones (mma_sync_tombstones_v1) and canonical
 * fingerprint reconciliation across local and cloud records.
 */
(function (global) {
  const TOMBSTONES_KEY = 'mma_sync_tombstones_v1';
  const TOMBSTONE_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000; // 180 days

  function normalizeTextToken(val) {
    return String(val || '')
      .toLowerCase()
      .replace(/^the\s+/i, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  function getSyncTombstones() {
    try {
      const raw = localStorage.getItem(TOMBSTONES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      const cutoff = Date.now() - TOMBSTONE_MAX_AGE_MS;
      return parsed.filter(t => t && (!t.deletedAt || Date.parse(t.deletedAt) >= cutoff));
    } catch (_) {
      return [];
    }
  }

  function saveSyncTombstones(list) {
    try {
      localStorage.setItem(TOMBSTONES_KEY, JSON.stringify(Array.isArray(list) ? list : []));
    } catch (_) { }
  }

  function addSyncTombstone(record) {
    if (!record || !record.id) return;
    const list = getSyncTombstones();
    const idStr = String(record.id);
    if (list.some(t => String(t.id) === idStr)) return;
    list.push({
      id: idStr,
      duplicateHash: record.duplicateHash || '',
      discogsId: record.discogsId ? String(record.discogsId).trim() : '',
      deletedAt: new Date().toISOString()
    });
    saveSyncTombstones(list);
  }

  function removeSyncTombstoneById(id) {
    if (!id) return;
    const idStr = String(id);
    const list = getSyncTombstones().filter(t => String(t.id) !== idStr);
    saveSyncTombstones(list);
  }

  function isRecordTombstoned(record, tombstones) {
    if (!record) return false;
    const list = Array.isArray(tombstones) ? tombstones : getSyncTombstones();
    if (list.length === 0) return false;
    const recId = String(record.id || '');
    return list.some(t => String(t.id) === recId);
  }

  function mergeRecordMetadata(primary, incoming) {
    if (!primary) return incoming;
    if (!incoming) return primary;

    const merged = { ...primary };
    const fillIfEmpty = (field) => {
      const cur = merged[field];
      const inc = incoming[field];
      const isEmpty = cur === undefined || cur === null || String(cur).trim() === '';
      const hasInc = inc !== undefined && inc !== null && String(inc).trim() !== '';
      if (isEmpty && hasInc) {
        merged[field] = inc;
      }
    };

    [
      'label', 'catNo', 'year', 'seriesName', 'seriesNumber', 'discogsId',
      'barcode', 'country', 'speed', 'centerHole', 'vinylColor', 'vinylWeight',
      'matrixA', 'matrixB', 'mastering', 'pressingPlant', 'genre', 'genres',
      'producer', 'provenance', 'researchNotes', 'artistBio', 'albumBio',
      'sideATitle', 'sideADuration', 'sideBTitle', 'sideBDuration'
    ].forEach(fillIfEmpty);

    // Prefer real artwork over empty or inline SVG placeholder
    const isPlaceholder = (src) => !src || String(src).startsWith('data:image/svg+xml');
    if (isPlaceholder(merged.coverImage) && !isPlaceholder(incoming.coverImage)) {
      merged.coverImage = incoming.coverImage;
    }
    if (!merged.labelAImage && incoming.labelAImage) merged.labelAImage = incoming.labelAImage;
    if (!merged.labelBImage && incoming.labelBImage) merged.labelBImage = incoming.labelBImage;

    // Prefer richer tracklist
    const curTracks = Array.isArray(merged.tracks) ? merged.tracks : [];
    const incTracks = Array.isArray(incoming.tracks) ? incoming.tracks : [];
    if (incTracks.length > curTracks.length) {
      merged.tracks = incTracks;
      merged.tracklist = incTracks;
    }

    // Prefer non-empty styles array
    if ((!Array.isArray(merged.styles) || merged.styles.length === 0) && Array.isArray(incoming.styles) && incoming.styles.length > 0) {
      merged.styles = incoming.styles;
    }

    // Prefer explicit valuation over missing/zero
    if ((!merged.estimatedValue || Number(merged.estimatedValue) <= 0) && incoming.estimatedValue && Number(incoming.estimatedValue) > 0) {
      merged.estimatedValue = incoming.estimatedValue;
      merged.priceLow = incoming.priceLow ?? merged.priceLow;
      merged.priceMedian = incoming.priceMedian ?? merged.priceMedian;
      merged.priceHigh = incoming.priceHigh ?? merged.priceHigh;
      merged.priceSource = incoming.priceSource || merged.priceSource;
    }

    // Keep earliest dateAdded
    if (incoming.dateAdded && (!merged.dateAdded || new Date(incoming.dateAdded) < new Date(merged.dateAdded))) {
      merged.dateAdded = incoming.dateAdded;
    }

    return merged;
  }

  function getRecordSemanticKeys(rec) {
    const keys = [];
    if (!rec || rec.isIntentionalDuplicateCopy) return keys;
    const discogsId = String(rec.discogsId || '').trim();
    if (discogsId) keys.push(`discogs::${discogsId}`);
    const barcode = String(rec.barcode || '').replace(/[^0-9A-Za-z]/g, '').trim();
    if (barcode.length >= 8) keys.push(`barcode::${barcode}`);
    const dupHash = String(rec.duplicateHash || '').trim();
    if (dupHash) {
      keys.push(`hash::${dupHash}`);
    } else {
      const a = normalizeTextToken(rec.artist);
      const t = normalizeTextToken(rec.title);
      const c = normalizeTextToken(rec.catNo);
      if (a && t && c) keys.push(`atc::${a}::${t}::${c}`);
    }
    return keys;
  }

  function consolidateDuplicateRecords(list) {
    if (!Array.isArray(list) || list.length <= 1) {
      return { records: Array.isArray(list) ? list : [], mergedCount: 0 };
    }

    const result = [];
    const byId = new Map();
    const byKey = new Map();
    let mergedCount = 0;

    for (const item of list) {
      if (!item) continue;
      const idStr = String(item.id || '');
      if (idStr && byId.has(idStr)) {
        const idx = byId.get(idStr);
        result[idx] = mergeRecordMetadata(result[idx], item);
        mergedCount++;
        continue;
      }

      const keys = getRecordSemanticKeys(item);
      let matchedIdx = -1;
      for (const k of keys) {
        if (byKey.has(k)) {
          matchedIdx = byKey.get(k);
          break;
        }
      }

      if (matchedIdx !== -1) {
        result[matchedIdx] = mergeRecordMetadata(result[matchedIdx], item);
        if (idStr) byId.set(idStr, matchedIdx);
        keys.forEach(k => byKey.set(k, matchedIdx));
        mergedCount++;
      } else {
        const nextIdx = result.length;
        result.push(item);
        if (idStr) byId.set(idStr, nextIdx);
        keys.forEach(k => byKey.set(k, nextIdx));
      }
    }

    return { records: result, mergedCount };
  }

  function findDuplicateRecordMatch(candidate, existingRecords, ignoreId = '') {
    if (!candidate || !Array.isArray(existingRecords)) return null;
    const ignoreStr = String(ignoreId || '');
    const candDiscogs = String(candidate.discogsId || '').trim();
    const candBarcode = String(candidate.barcode || '').replace(/[^0-9A-Za-z]/g, '').trim();
    const candHash = String(candidate.duplicateHash || '').trim();
    const candArtist = normalizeTextToken(candidate.artist);
    const candTitle = normalizeTextToken(candidate.title);
    const candCat = normalizeTextToken(candidate.catNo);

    for (const rec of existingRecords) {
      if (!rec || String(rec.id) === ignoreStr) continue;

      if (candDiscogs && rec.discogsId && String(rec.discogsId).trim() === candDiscogs) {
        return { matchType: 'Exact Discogs Release ID', record: rec };
      }
      const recBarcode = String(rec.barcode || '').replace(/[^0-9A-Za-z]/g, '').trim();
      if (candBarcode.length >= 8 && recBarcode && candBarcode === recBarcode) {
        return { matchType: 'Exact Barcode (EAN/UPC)', record: rec };
      }
      if (candHash && rec.duplicateHash && String(rec.duplicateHash).trim() === candHash) {
        return { matchType: 'Exact Pressing Fingerprint', record: rec };
      }
      const recArtist = normalizeTextToken(rec.artist);
      const recTitle = normalizeTextToken(rec.title);
      const recCat = normalizeTextToken(rec.catNo);
      if (candArtist && candTitle && recArtist === candArtist && recTitle === candTitle) {
        if (candCat && recCat && candCat === recCat) {
          return { matchType: 'Exact Artist + Title + Cat#', record: rec };
        }
        if (!candCat || !recCat) {
          return { matchType: 'Matching Artist + Title', record: rec };
        }
      }
    }
    return null;
  }

  global.getSyncTombstones = getSyncTombstones;
  global.addSyncTombstone = addSyncTombstone;
  global.removeSyncTombstoneById = removeSyncTombstoneById;
  global.isRecordTombstoned = isRecordTombstoned;
  global.mergeRecordMetadata = mergeRecordMetadata;
  global.consolidateDuplicateRecords = consolidateDuplicateRecords;
  global.findDuplicateRecordMatch = findDuplicateRecordMatch;
})(typeof window !== 'undefined' ? window : globalThis);

