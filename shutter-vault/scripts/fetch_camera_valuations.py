#!/usr/bin/env python3
"""
ShutterVault Companion UK Market Valuation Fetcher
==================================================
Queries CeX UK JSON API (trade-in floor, voucher exchange, and retail sell prices)
and optionally eBay UK Browse API (when EBAY_CLIENT_ID and EBAY_CLIENT_SECRET are set)
to compute a cleaned 30th-percentile private sale estimate for camera gear.

Usage:
    python scripts/fetch_camera_valuations.py --help
    python scripts/fetch_camera_valuations.py --input backup.json --output valuations.json
    python scripts/fetch_camera_valuations.py --dry-run --self-test
"""

from __future__ import annotations

import argparse
import base64
import datetime as dt
import json
import math
import os
import re
import sys
import time
import urllib.parse
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    import requests
except ImportError:  # Graceful fallback so --help / --self-test work even before pip install
    requests = None  # type: ignore


# Regex filter to exclude non-item listings, empty boxes, manuals, broken/spares, and minor accessories
EXCLUDE_PATTERN = re.compile(
    r"\b("
    r"box\s+only|"
    r"empty\s+box|"
    r"manual|"
    r"broken|"
    r"faulty|"
    r"spares|"
    r"for\s+parts|"
    r"battery|"
    r"charger|"
    r"strap|"
    r"lens\s+cap"
    r")\b",
    re.IGNORECASE,
)

CEX_SEARCH_URL = "https://wss2.cex.uk.webuy.io/v3/boxes"
EBAY_OAUTH_URL = "https://api.ebay.com/identity/v1/oauth2/token"
EBAY_BROWSE_URL = "https://api.ebay.com/buy/browse/v1/item_summary/search"

DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}

# Built-in sample catalogue matching index.html default sample data
SAMPLE_GEAR: List[Dict[str, Any]] = [
    {
        "id": "gear_1",
        "category": "Body",
        "mount": "Fujifilm X",
        "brand": "Fujifilm",
        "model": "X-T5",
        "valuations": {"tradeIn": 980.00, "privateSale": 1220.00, "replacement": 1499.00},
    },
    {
        "id": "gear_2",
        "category": "Lens",
        "mount": "Fujifilm X",
        "brand": "Fujifilm",
        "model": "XF 35mm f/1.4 R",
        "valuations": {"tradeIn": 245.00, "privateSale": 330.00, "replacement": 419.00},
    },
    {
        "id": "gear_3",
        "category": "Lens",
        "mount": "Fujifilm X",
        "brand": "Fujifilm",
        "model": "XF 16-55mm f/2.8 R LM WR",
        "valuations": {"tradeIn": 460.00, "privateSale": 610.00, "replacement": 749.00},
    },
    {
        "id": "gear_4",
        "category": "Body",
        "mount": "Nikon Z",
        "brand": "Nikon",
        "model": "Zf",
        "valuations": {"tradeIn": 1290.00, "privateSale": 1560.00, "replacement": 1849.00},
    },
    {
        "id": "gear_5",
        "category": "Lens",
        "mount": "Nikon Z",
        "brand": "Nikon",
        "model": "NIKKOR Z 24-120mm f/4 S",
        "valuations": {"tradeIn": 620.00, "privateSale": 780.00, "replacement": 929.00},
    },
    {
        "id": "gear_6",
        "category": "Body",
        "mount": "Sony E",
        "brand": "Sony",
        "model": "A7 IV",
        "valuations": {"tradeIn": 1250.00, "privateSale": 1520.00, "replacement": 1799.00},
    },
    {
        "id": "gear_7",
        "category": "Lens",
        "mount": "Sony E",
        "brand": "Sony",
        "model": "FE 24-70mm f/2.8 GM II",
        "valuations": {"tradeIn": 1420.00, "privateSale": 1750.00, "replacement": 2049.00},
    },
]


def is_excluded_title(title: str) -> bool:
    """Return True if a listing title matches any excluded accessory/broken keyword."""
    if not title:
        return True
    return bool(EXCLUDE_PATTERN.search(title))


def clean_listings(
    listings: List[Dict[str, Any]],
    model: str,
    title_key: str = "title",
    price_key: str = "price",
) -> List[Dict[str, Any]]:
    """
    Filter listings using EXCLUDE_PATTERN and ensure positive numeric prices
    and basic model token relevance.
    """
    core_tokens = [
        tok.lower()
        for tok in re.split(r"[\s/+-]+", model.strip())
        if len(tok) >= 2 and tok.lower() not in {"fe", "xf", "nikkor", "lm", "wr", "gm", "ii"}
    ]
    cleaned: List[Dict[str, Any]] = []
    for entry in listings:
        title = str(entry.get(title_key, "")).strip()
        if is_excluded_title(title):
            continue
        title_lower = title.lower()
        if core_tokens and not any(tok in title_lower for tok in core_tokens):
            continue
        try:
            price_val = float(entry.get(price_key, 0))
        except (TypeError, ValueError):
            continue
        if price_val <= 0:
            continue
        cleaned.append({"title": title, "price": round(price_val, 2), "raw": entry})
    return cleaned


def compute_percentile(prices: List[float], percentile: float = 30.0) -> Optional[float]:
    """
    Compute the given percentile (0..100) of a non-empty list of floats using
    linear interpolation between closest ranks.
    """
    valid = sorted(p for p in prices if p is not None and p > 0)
    if not valid:
        return None
    if len(valid) == 1:
        return round(valid[0], 2)
    rank = (percentile / 100.0) * (len(valid) - 1)
    low_idx = int(math.floor(rank))
    high_idx = int(math.ceil(rank))
    weight = rank - low_idx
    interpolated = valid[low_idx] * (1.0 - weight) + valid[high_idx] * weight
    return round(interpolated, 2)


def build_search_query(brand: str, model: str) -> str:
    """Combine brand and model without duplicating the brand prefix."""
    brand_clean = (brand or "").strip()
    model_clean = (model or "").strip()
    if brand_clean and brand_clean.lower() not in model_clean.lower():
        return f"{brand_clean} {model_clean}"
    return model_clean


def fetch_cex_uk(query: str, timeout: float = 12.0) -> Optional[Dict[str, Any]]:
    """
    Query CeX UK JSON API for `query` and return aggregated cashPrice (Trade-In floor),
    exchangePrice (voucher), and sellPrice (replacement reference).
    """
    if requests is None:
        return None
    params = {"q": query, "firstRecord": 1, "count": 20}
    try:
        resp = requests.get(
            CEX_SEARCH_URL,
            params=params,
            headers=DEFAULT_HEADERS,
            timeout=timeout,
        )
        if resp.status_code != 200:
            return None
        payload = resp.json()
    except Exception as exc:
        print(f"  [CeX] Warning: request failed for '{query}': {exc}", file=sys.stderr)
        return None

    boxes = (
        payload.get("response", {})
        .get("data", {})
        .get("boxes", [])
    ) or []

    matched_boxes: List[Dict[str, Any]] = []
    for box in boxes:
        box_name = str(box.get("boxName", ""))
        if is_excluded_title(box_name):
            continue
        try:
            cash = float(box.get("cashPrice", 0))
            exchange = float(box.get("exchangePrice", 0))
            sell = float(box.get("sellPrice", 0))
        except (TypeError, ValueError):
            continue
        if sell <= 0:
            continue
        matched_boxes.append(
            {
                "boxName": box_name,
                "cashPrice": round(cash, 2),
                "exchangePrice": round(exchange, 2),
                "sellPrice": round(sell, 2),
            }
        )

    if not matched_boxes:
        return None

    # Prefer Grade B (standard "Excellent/Good" baseline) or median across grades
    grade_b = [b for b in matched_boxes if b["boxName"].rstrip().endswith(" B")]
    pool = grade_b if grade_b else matched_boxes

    cash_median = compute_percentile([b["cashPrice"] for b in pool], 50.0) or pool[0]["cashPrice"]
    exch_median = compute_percentile([b["exchangePrice"] for b in pool], 50.0) or pool[0]["exchangePrice"]
    sell_median = compute_percentile([b["sellPrice"] for b in pool], 50.0) or pool[0]["sellPrice"]

    return {
        "cashPrice": cash_median,
        "exchangePrice": exch_median,
        "sellPrice": sell_median,
        "matchedCount": len(matched_boxes),
        "sampleTitle": pool[0]["boxName"],
    }


def get_ebay_oauth_token(client_id: str, client_secret: str, timeout: float = 12.0) -> Optional[str]:
    """Obtain an OAuth2 client_credentials application token from eBay."""
    if requests is None or not client_id or not client_secret:
        return None
    basic = base64.b64encode(f"{client_id}:{client_secret}".encode("utf-8")).decode("ascii")
    headers = {
        "Authorization": f"Basic {basic}",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    data = {
        "grant_type": "client_credentials",
        "scope": "https://api.ebay.com/oauth/api_scope",
    }
    try:
        resp = requests.post(EBAY_OAUTH_URL, headers=headers, data=data, timeout=timeout)
        if resp.status_code != 200:
            print(f"  [eBay] OAuth token request returned HTTP {resp.status_code}", file=sys.stderr)
            return None
        return resp.json().get("access_token")
    except Exception as exc:
        print(f"  [eBay] Warning: OAuth failed: {exc}", file=sys.stderr)
        return None


def fetch_ebay_uk_browse(
    query: str,
    model: str,
    oauth_token: str,
    timeout: float = 12.0,
) -> Optional[Dict[str, Any]]:
    """
    Query eBay UK Browse API (EBAY_GB) for USED FIXED_PRICE GBP listings,
    apply EXCLUDE_PATTERN regex filter, and compute the 30th percentile price.
    """
    if requests is None or not oauth_token:
        return None
    headers = {
        **DEFAULT_HEADERS,
        "Authorization": f"Bearer {oauth_token}",
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_GB",
    }
    params = {
        "q": query,
        "filter": "conditions:{USED},buyingOptions:{FIXED_PRICE},priceCurrency:GBP",
        "limit": "50",
    }
    try:
        resp = requests.get(EBAY_BROWSE_URL, headers=headers, params=params, timeout=timeout)
        if resp.status_code != 200:
            return None
        payload = resp.json()
    except Exception as exc:
        print(f"  [eBay] Warning: Browse API failed for '{query}': {exc}", file=sys.stderr)
        return None

    summaries = payload.get("itemSummaries", []) or []
    raw_listings: List[Dict[str, Any]] = []
    for item in summaries:
        title = item.get("title", "")
        price_obj = item.get("price", {}) or {}
        if price_obj.get("currency", "GBP") != "GBP":
            continue
        raw_listings.append({"title": title, "price": price_obj.get("value")})

    cleaned = clean_listings(raw_listings, model=model)
    if not cleaned:
        return None

    prices = [c["price"] for c in cleaned]
    p30 = compute_percentile(prices, 30.0)
    p50 = compute_percentile(prices, 50.0)
    return {
        "p30Price": p30,
        "medianPrice": p50,
        "matchedCount": len(cleaned),
    }


def load_gear_items(input_path: Optional[str]) -> List[Dict[str, Any]]:
    """Load gear list from a shutterVault_v1 JSON export or fall back to SAMPLE_GEAR."""
    if not input_path:
        return SAMPLE_GEAR
    path = Path(input_path)
    if not path.exists():
        raise FileNotFoundError(f"Input JSON file not found: {input_path}")
    with path.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    if isinstance(data, dict) and "gear" in data and isinstance(data["gear"], list):
        return data["gear"]
    if isinstance(data, list):
        return data
    raise ValueError("Input JSON must be a shutterVault_v1 backup object with a 'gear' list.")


def synthesize_dry_run_market(item: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Generate deterministic mock CeX & eBay UK listings (including noisy/faulty rows
    that must be stripped by EXCLUDE_PATTERN) for offline dry-run verification.
    """
    existing = item.get("valuations", {}) or {}
    base_trade = float(existing.get("tradeIn") or 400.0)
    base_private = float(existing.get("privateSale") or round(base_trade * 1.25, 2))
    base_replace = float(existing.get("replacement") or round(base_trade * 1.50, 2))
    model = str(item.get("model", "Camera"))
    brand = str(item.get("brand", ""))

    mock_ebay_raw = [
        {"title": f"{brand} {model} - Empty Box Only", "price": 25.00},
        {"title": f"{brand} {model} Instruction Manual", "price": 12.00},
        {"title": f"{brand} {model} - Faulty / Spares or For Parts", "price": 180.00},
        {"title": f"Genuine Battery & Charger for {brand} {model}", "price": 45.00},
        {"title": f"{brand} {model} Good Used Condition", "price": round(base_private * 0.96, 2)},
        {"title": f"{brand} {model} Excellent Boxed UK", "price": round(base_private * 1.00, 2)},
        {"title": f"{brand} {model} Mint Low Shutter Count", "price": round(base_private * 1.08, 2)},
    ]
    cleaned = clean_listings(mock_ebay_raw, model=model)
    p30 = compute_percentile([c["price"] for c in cleaned], 30.0) or base_private

    cex_data = {
        "cashPrice": round(base_trade * 1.01, 2),
        "exchangePrice": round(base_trade * 1.14, 2),
        "sellPrice": round(base_replace * 0.99, 2),
        "matchedCount": 2,
        "sampleTitle": f"{brand} {model} B",
    }
    ebay_data = {
        "p30Price": p30,
        "medianPrice": compute_percentile([c["price"] for c in cleaned], 50.0),
        "matchedCount": len(cleaned),
    }
    return cex_data, ebay_data


# Built-in physical specification lookup table (weightGrams & filterThreadMm)
GEAR_SPECS_DB: List[Dict[str, Any]] = [
    {"brand": "Fujifilm", "model": "X-T5", "weightGrams": 557, "filterThreadMm": None},
    {"brand": "Fujifilm", "model": "X-T4", "weightGrams": 607, "filterThreadMm": None},
    {"brand": "Fujifilm", "model": "X-T3", "weightGrams": 539, "filterThreadMm": None},
    {"brand": "Fujifilm", "model": "X-T50", "weightGrams": 438, "filterThreadMm": None},
    {"brand": "Fujifilm", "model": "X-T30 II", "weightGrams": 378, "filterThreadMm": None},
    {"brand": "Fujifilm", "model": "X-H2", "weightGrams": 660, "filterThreadMm": None},
    {"brand": "Fujifilm", "model": "X-H2S", "weightGrams": 660, "filterThreadMm": None},
    {"brand": "Fujifilm", "model": "X-S20", "weightGrams": 491, "filterThreadMm": None},
    {"brand": "Fujifilm", "model": "X100VI", "weightGrams": 521, "filterThreadMm": 49},
    {"brand": "Fujifilm", "model": "X100V", "weightGrams": 478, "filterThreadMm": 49},
    {"brand": "Fujifilm", "model": "XF 35mm f/1.4 R", "weightGrams": 187, "filterThreadMm": 52},
    {"brand": "Fujifilm", "model": "XF 33mm f/1.4 R LM WR", "weightGrams": 360, "filterThreadMm": 58},
    {"brand": "Fujifilm", "model": "XF 23mm f/1.4 R LM WR", "weightGrams": 375, "filterThreadMm": 58},
    {"brand": "Fujifilm", "model": "XF 18mm f/1.4 R LM WR", "weightGrams": 370, "filterThreadMm": 62},
    {"brand": "Fujifilm", "model": "XF 56mm f/1.2 R WR", "weightGrams": 445, "filterThreadMm": 67},
    {"brand": "Fujifilm", "model": "XF 16-55mm f/2.8 R LM WR", "weightGrams": 655, "filterThreadMm": 77},
    {"brand": "Fujifilm", "model": "XF 16-55mm f/2.8 R LM WR II", "weightGrams": 410, "filterThreadMm": 72},
    {"brand": "Fujifilm", "model": "XF 50-140mm f/2.8 R LM OIS WR", "weightGrams": 995, "filterThreadMm": 72},
    {"brand": "Fujifilm", "model": "XF 70-300mm f/4-5.6 R LM OIS WR", "weightGrams": 580, "filterThreadMm": 67},
    {"brand": "Nikon", "model": "Zf", "weightGrams": 710, "filterThreadMm": None},
    {"brand": "Nikon", "model": "Z8", "weightGrams": 910, "filterThreadMm": None},
    {"brand": "Nikon", "model": "Z9", "weightGrams": 1340, "filterThreadMm": None},
    {"brand": "Nikon", "model": "Z6 III", "weightGrams": 760, "filterThreadMm": None},
    {"brand": "Nikon", "model": "Z6 II", "weightGrams": 705, "filterThreadMm": None},
    {"brand": "Nikon", "model": "Z7 II", "weightGrams": 705, "filterThreadMm": None},
    {"brand": "Nikon", "model": "NIKKOR Z 24-120mm f/4 S", "weightGrams": 630, "filterThreadMm": 77},
    {"brand": "Nikon", "model": "NIKKOR Z 24-70mm f/2.8 S", "weightGrams": 805, "filterThreadMm": 82},
    {"brand": "Nikon", "model": "NIKKOR Z 70-200mm f/2.8 VR S", "weightGrams": 1360, "filterThreadMm": 77},
    {"brand": "Nikon", "model": "NIKKOR Z 50mm f/1.8 S", "weightGrams": 415, "filterThreadMm": 62},
    {"brand": "Nikon", "model": "NIKKOR Z 85mm f/1.8 S", "weightGrams": 470, "filterThreadMm": 67},
    {"brand": "Sony", "model": "A7 IV", "weightGrams": 658, "filterThreadMm": None},
    {"brand": "Sony", "model": "A7R V", "weightGrams": 723, "filterThreadMm": None},
    {"brand": "Sony", "model": "A7C II", "weightGrams": 514, "filterThreadMm": None},
    {"brand": "Sony", "model": "A7S III", "weightGrams": 699, "filterThreadMm": None},
    {"brand": "Sony", "model": "A1", "weightGrams": 737, "filterThreadMm": None},
    {"brand": "Sony", "model": "FE 24-70mm f/2.8 GM II", "weightGrams": 695, "filterThreadMm": 82},
    {"brand": "Sony", "model": "FE 70-200mm f/2.8 GM OSS II", "weightGrams": 1045, "filterThreadMm": 77},
    {"brand": "Sony", "model": "FE 35mm f/1.4 GM", "weightGrams": 524, "filterThreadMm": 67},
    {"brand": "Sony", "model": "FE 50mm f/1.4 GM", "weightGrams": 516, "filterThreadMm": 67},
    {"brand": "Sony", "model": "FE 85mm f/1.4 GM II", "weightGrams": 642, "filterThreadMm": 77},
]


def lookup_gear_specs(brand: str, model: str, existing_item: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Resolve weightGrams and filterThreadMm for an input gear item from GEAR_SPECS_DB,
    falling back to any existing values on the item.
    """
    norm_q = re.sub(r"[^a-z0-9.]+", " ", f"{brand} {model}".lower()).strip()
    norm_model = re.sub(r"[^a-z0-9.]+", " ", model.lower()).strip()

    for entry in GEAR_SPECS_DB:
        entry_full = re.sub(r"[^a-z0-9.]+", " ", f"{entry['brand']} {entry['model']}".lower()).strip()
        entry_model = re.sub(r"[^a-z0-9.]+", " ", entry["model"].lower()).strip()
        if norm_q == entry_full or norm_model == entry_model or entry_model in norm_q:
            return {
                "weightGrams": entry["weightGrams"],
                "filterThreadMm": entry["filterThreadMm"],
                "specSource": "built-in-db",
            }

    return {
        "weightGrams": existing_item.get("weightGrams") if existing_item else None,
        "filterThreadMm": existing_item.get("filterThreadMm") if existing_item else None,
        "specSource": "input-preserved",
    }


def format_output_payload(
    results: List[Dict[str, Any]],
    ebay_enabled: bool,
    dry_run: bool = False,
) -> Dict[str, Any]:
    """Build the top-level valuations.json structure consumed by index.html."""
    now_iso = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {
        "generatedAt": now_iso,
        "currency": "GBP",
        "dryRun": dry_run,
        "sourceSummary": {
            "cexUkApi": CEX_SEARCH_URL,
            "ebayUkBrowseApiEnabled": ebay_enabled,
        },
        "items": results,
    }


def run_self_test() -> None:
    """Unit checks for EXCLUDE_PATTERN regex filtering, 30th percentile, and JSON output."""
    forbidden_titles = [
        "Fujifilm X-T5 Box Only",
        "Nikon Zf Empty Box Genuine",
        "Sony A7 IV Owner Manual Booklet",
        "Fujifilm XF 35mm f/1.4 Broken AF",
        "Nikon Z 24-120mm Faulty Aperture",
        "Sony A7 IV Spares Repair",
        "Fujifilm X-T5 For Parts Not Working",
        "NP-W235 Battery for Fujifilm X-T5",
        "BC-W235 Dual Charger for X-T5",
        "Peak Design Neck Strap for Nikon Zf",
        "77mm Front Lens Cap for Sony 24-70mm",
    ]
    for title in forbidden_titles:
        assert is_excluded_title(title), f"Expected EXCLUDE_PATTERN to reject: {title}"

    valid_titles = [
        "Fujifilm X-T5 Body Black - Boxed Mint Condition",
        "Nikon Zf Mirrorless Camera Body Only - UK Stock",
        "Sony FE 24-70mm f/2.8 GM II Lens",
    ]
    for title in valid_titles:
        assert not is_excluded_title(title), f"Expected EXCLUDE_PATTERN to allow: {title}"

    mixed = [{"title": t, "price": 50.0} for t in forbidden_titles] + [
        {"title": "Fujifilm X-T5 Body Used Good", "price": 1150.0},
        {"title": "Fujifilm X-T5 Body Used Excellent", "price": 1220.0},
        {"title": "Fujifilm X-T5 Body Used Mint", "price": 1300.0},
        {"title": "Fujifilm X-T5 Body Like New", "price": 1350.0},
    ]
    cleaned = clean_listings(mixed, model="X-T5")
    assert len(cleaned) == 4, f"Expected 4 cleaned listings, got {len(cleaned)}"

    p30 = compute_percentile([c["price"] for c in cleaned], 30.0)
    assert p30 is not None and 1150.0 <= p30 <= 1250.0, f"Unexpected 30th percentile: {p30}"
    print("[SELF-TEST] All regex filter, listing cleaner, and 30th-percentile checks PASSED.")


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Fetch UK used camera gear valuations from CeX UK and eBay UK Browse API."
    )
    parser.add_argument(
        "--input",
        "-i",
        help="Path to an exported shutterVault_v1 JSON backup file (defaults to built-in sample gear list).",
        default=None,
    )
    parser.add_argument(
        "--output",
        "-o",
        help="Output file path for matched valuations JSON (default: valuations.json).",
        default="valuations.json",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.2,
        help="Polite delay in seconds between live API requests (default: 1.2).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run with deterministic local fixtures without making external HTTP calls.",
    )
    parser.add_argument(
        "--self-test",
        action="store_true",
        help="Run unit checks on regex cleaner, 30th-percentile calculator, and JSON formatter.",
    )
    args = parser.parse_args(argv)

    if args.self_test:
        run_self_test()

    gear_items = load_gear_items(args.input)
    today_str = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d")

    ebay_client_id = os.environ.get("EBAY_CLIENT_ID", "").strip()
    ebay_client_secret = os.environ.get("EBAY_CLIENT_SECRET", "").strip()
    ebay_token: Optional[str] = None
    if not args.dry_run and ebay_client_id and ebay_client_secret:
        print("[eBay UK] Authenticating with EBAY_CLIENT_ID / EBAY_CLIENT_SECRET...")
        ebay_token = get_ebay_oauth_token(ebay_client_id, ebay_client_secret)

    results: List[Dict[str, Any]] = []
    for idx, item in enumerate(gear_items):
        item_id = item.get("id", f"gear_{idx + 1}")
        brand = str(item.get("brand", "")).strip()
        model = str(item.get("model", "")).strip()
        query = build_search_query(brand, model)
        existing_val = item.get("valuations", {}) or {}

        print(f"[{idx + 1}/{len(gear_items)}] Valuation lookup: {query} (id={item_id})")

        if args.dry_run:
            cex_data, ebay_data = synthesize_dry_run_market(item)
        else:
            cex_data = fetch_cex_uk(query)
            ebay_data = (
                fetch_ebay_uk_browse(query, model=model, oauth_token=ebay_token)
                if ebay_token
                else None
            )
            if idx < len(gear_items) - 1 and args.delay > 0:
                time.sleep(args.delay)

        # Resolve tiered GBP valuations with fallback to existing values
        trade_in = (
            cex_data["cashPrice"]
            if cex_data and cex_data.get("cashPrice")
            else float(existing_val.get("tradeIn") or 0.0)
        )
        replacement = (
            cex_data["sellPrice"]
            if cex_data and cex_data.get("sellPrice")
            else float(existing_val.get("replacement") or 0.0)
        )
        if ebay_data and ebay_data.get("p30Price"):
            private_sale = ebay_data["p30Price"]
        elif cex_data and cex_data.get("cashPrice") and cex_data.get("sellPrice"):
            # Midpoint between CeX cash floor and retail sell price
            private_sale = round((cex_data["cashPrice"] + cex_data["sellPrice"]) / 2.0, 2)
        else:
            private_sale = float(existing_val.get("privateSale") or 0.0)

        specs_info = lookup_gear_specs(brand, model, existing_item=item)

        results.append(
            {
                "id": item_id,
                "brand": brand,
                "model": model,
                "query": query,
                "specs": specs_info,
                "valuations": {
                    "tradeIn": round(trade_in, 2),
                    "privateSale": round(private_sale, 2),
                    "replacement": round(replacement, 2),
                    "lastChecked": today_str,
                },
                "marketData": {
                    "cexCashPrice": cex_data.get("cashPrice") if cex_data else None,
                    "cexExchangePrice": cex_data.get("exchangePrice") if cex_data else None,
                    "cexSellPrice": cex_data.get("sellPrice") if cex_data else None,
                    "cexMatchedBoxes": cex_data.get("matchedCount", 0) if cex_data else 0,
                    "ebayUk30thPercentile": ebay_data.get("p30Price") if ebay_data else None,
                    "ebayUkMatchedListings": ebay_data.get("matchedCount", 0) if ebay_data else 0,
                },
            }
        )

    payload = format_output_payload(
        results,
        ebay_enabled=bool(ebay_token) or args.dry_run,
        dry_run=args.dry_run,
    )

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)

    print(f"Wrote {len(results)} GBP gear valuations to {out_path.resolve()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
