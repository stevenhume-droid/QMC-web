import sqlite3
import math
from flask import Flask, request, jsonify, render_template_string

app = Flask(__name__)
DB_PATH = "vinyl_radar.db"

# Center point: Forth Bridges / South Queensferry (EH30)
HOME_LAT = 55.9903
HOME_LNG = -3.3965
MAX_RADIUS_MILES = 20.0

def haversine_miles(lat1, lon1, lat2, lon2):
    R = 3958.8  # Earth radius in miles
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2)**2
    return round(R * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))), 1)

SEED_STORES = [
    ("Almond River Records", "Corstorphine, Edinburgh", "253 St John's Rd, EH12 7XD", 55.9427, -3.2905, "Used Heavy", "Rock, Indie, Soul, Pop", 0, 1, 1, 1, 0, "Curated second-hand shop in west Edinburgh offering ultrasonic record cleaning and fair cash/trade on collections."),
    ("Veneno Music Store", "Dunfermline, Fife", "20 East Port, KY12 7JB", 56.0717, -3.4580, "Mix (New & Used)", "Rock, Metal, Indie, Pop", 1, 1, 1, 1, 0, "Welcoming Fife independent with super honest condition grading across pre-loved and new vinyl."),
    ("The Music Box", "Dunfermline, Fife", "37 Queen Anne St, KY12 7BA", 56.0725, -3.4612, "Mix (New & Used)", "Indie, Britpop, Rock, Rarities", 0, 1, 0, 1, 0, "Independent Dunfermline spot strong on UK indie rarities, limited box sets, and pre-owned crates."),
    ("VoxBox Music", "Stockbridge, Edinburgh", "21 St Stephen St, EH3 6TQ", 55.9576, -3.2078, "Used Heavy", "Jazz, Indie, Rock, 60s/70s, Scottish", 1, 1, 1, 1, 0, "Famous for pristine front-shop stock and the legendary £1-£3 bargain basement room out back."),
    ("Oxfam Music Stockbridge", "Stockbridge, Edinburgh", "64 Raeburn Pl, EH4 1HN", 55.9589, -3.2117, "Used Only", "Rock, Classical, Jazz, Folk, Soundtracks", 0, 0, 0, 1, 0, "Dedicated music charity shop receiving some of Edinburgh's best donated vinyl collections."),
    ("Low Port Music", "Linlithgow, West Lothian", "15A Low Port, EH49 7HZ", 55.9765, -3.5932, "New Heavy", "Indie, Alternative, Electronic, Post-Rock", 0, 1, 0, 0, 0, "Linlithgow's local independent record shop. Great for indie exclusives, Ninja Tune/4AD/Soul Jazz releases, and RSD drops."),
    ("Greenhouse Records", "Bruntsfield, Edinburgh", "10 Barclay Terrace, EH10 4HP", 55.9392, -3.2055, "Mix (New & Used)", "Underground Dance, Leftfield, Dub, Experimental", 1, 1, 0, 1, 0, "Specialist shop dealing in underground club 12-inches, electronic, dub, and global experimental sounds."),
    ("Umbrella Vinyl", "Tollcross, Edinburgh", "15B Brougham St, EH3 9JS", 55.9422, -3.2023, "Used Heavy", "Jazz, Soul, Funk, Dub, Afrobeat, Library", 1, 1, 1, 1, 0, "Play-graded specialist second-hand shop covering global sounds, deep jazz, funk, dub, and library records."),
    ("Assai Records", "Tollcross, Edinburgh", "1 Grindlay St, EH3 9AT", 55.9458, -3.2038, "New Only", "Indie, Rock, Jazz, Hip-Hop, Soundtracks", 0, 0, 0, 0, 0, "Spacious new-release powerhouse known for numbered Japanese-style Obi editions and hardware/sleeves."),
    ("Backtracks Music", "Tollcross, Edinburgh", "52 Brougham St, EH3 9QG", 55.9416, -3.2018, "Used Heavy", "Rock, Pop, Soul, 7-Inch Singles", 1, 1, 0, 1, 0, "Old-school floor-to-ceiling crate digger's staple with thousands of used LPs and 45s."),
    ("Thorne Records", "Morningside, Edinburgh", "125 Bruntsfield Pl, EH10 4EQ", 55.9365, -3.2089, "New Only", "Indie, Americana, Jazz, Electronic, Folk", 0, 0, 0, 0, 0, "Dog-friendly neighbourhood shop with super clean rack spacing and thoughtfully curated new pressings."),
    ("Underground Solu'shn", "Old Town, Edinburgh", "9 Cockburn St, EH1 1BP", 55.9507, -3.1878, "New Heavy", "House, Techno, Hip-Hop, Beats, Funk, Soul", 1, 1, 0, 1, 0, "Edinburgh's institution for DJs and beatmakers: dance 12s, hip-hop, jazz reissues, Ortofon carts, and Technics accessories."),
    ("Slow Progress Records & Coffee", "Old Town, Edinburgh", "53 Blackfriars St, EH1 1NB", 55.9496, -3.1856, "New Heavy", "Post-Punk, Indie, Experimental, Ambient", 1, 0, 0, 0, 1, "Independent record shop and specialty coffee bar tucked just off the Royal Mile."),
    ("Vinyl Villains", "Elm Row, Edinburgh", "5 Elm Row, EH7 4AQ", 55.9585, -3.1835, "Used Heavy", "Punk, New Wave, Reggae, Indie, Rock", 1, 1, 0, 1, 0, "At the top of Leith Walk since 1982. Deep second-hand racks and unpretentious staff knowledge."),
    ("Elvis Shakespeare", "Leith Walk, Edinburgh", "347 Leith Walk, EH6 8SD", 55.9645, -3.1758, "Used Heavy", "60s/70s Psych, Folk, Blues, Indie, Jazz", 1, 1, 0, 1, 0, "A proper treasure trove of second-hand vinyl and rare books; allow at least an hour to dig properly."),
    ("Lounge 33", "Leith Walk, Edinburgh", "373-375 Leith Walk, EH6 8SE", 55.9651, -3.1751, "Mix (New & Used)", "Jazz, Soul, Funk, Blues, Hip-Hop", 1, 0, 0, 0, 1, "Vinyl listening space and specialty coffee lounge built around jazz, soul, funk, and hip-hop records."),
    ("Good Vibes Neighbourhood Store", "Leith, Edinburgh", "151-153 Constitution St, EH6 7AD", 55.9739, -3.1672, "New & Reissues", "Psych, Ambient, Electronic, Jazz, Folk", 0, 0, 0, 0, 0, "Curated selection of specialist labels, spiritual jazz, ambient, and psyche in the heart of Leith."),
    ("Avalanche Records", "City Centre, Edinburgh", "Waverley Market, 3 Princes St, EH1 1BQ", 55.9524, -3.1901, "Mix (New & Vintage)", "Scottish Indie, Post-Rock, Alternative", 0, 0, 0, 0, 0, "Long-running champion of Scottish independent bands alongside vintage vinyl crates."),
    ("Silver Machine Records", "Falkirk", "The Avenue, 165 High St, FK1 1DU", 55.9994, -3.7845, "Used Heavy", "60s/70s Rock, Psych, Prog, Soul", 1, 1, 0, 1, 0, "Vintage and rare vinyl specialist on Falkirk High Street, just inside the western 20-mile boundary.")
]

SEED_REVIEWS = [
    (4, "CrateDigger_EH30", 4, 5, 5, "Boards of Canada - Twoism (Warp Reissue)", "Front racks are immaculately clean, and the £2 backroom always yields a weird library record or 12-inch for sampling."),
    (8, "FunkyFife", 5, 5, 5, "Donald Byrd - Places and Spaces", "Every used record is play-graded and ultrasonic cleaned. You can trust their VG+ sticker without hesitation."),
    (12, "Technics1210_Stevie", 4, 4, 5, "DJ Krush - Strictly Turntablized", "Still the undisputed king for dance 12s, hip-hop beats, and grabbing replacement styli in town."),
    (16, "LeithWax", 5, 4, 5, "Thievery Corporation - The Richest Man in Babylon", "Grab a flat white from Mr Eion beans, sit down with a stack of jazz and trip-hop records, and lose an afternoon.")
]

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS stores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            area TEXT NOT NULL,
            address TEXT NOT NULL,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            stock_type TEXT NOT NULL,
            genres TEXT NOT NULL,
            has_listening_deck INTEGER DEFAULT 0,
            buys_collections INTEGER DEFAULT 0,
            ultrasonic_cleaned INTEGER DEFAULT 0,
            has_bargain_crates INTEGER DEFAULT 0,
            has_coffee_bar INTEGER DEFAULT 0,
            description TEXT
        )
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            store_id INTEGER NOT NULL,
            reviewer_name TEXT NOT NULL,
            ergonomics_score INTEGER NOT NULL,
            grading_score INTEGER NOT NULL,
            vibe_score INTEGER NOT NULL,
            best_pull TEXT,
            comment TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (store_id) REFERENCES stores (id)
        )
    """)
    c.execute("SELECT COUNT(*) FROM stores")
    if c.fetchone()[0] == 0:
        c.executemany("""
            INSERT INTO stores (
                name, area, address, lat, lng, stock_type, genres,
                has_listening_deck, buys_collections, ultrasonic_cleaned,
                has_bargain_crates, has_coffee_bar, description
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, SEED_STORES)
        c.executemany("""
            INSERT INTO reviews (
                store_id, reviewer_name, ergonomics_score, grading_score, vibe_score, best_pull, comment
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, SEED_REVIEWS)
        conn.commit()
    conn.close()

@app.route("/api/stores", methods=["GET"])
def get_stores():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    stores = [dict(row) for row in c.execute("SELECT * FROM stores").fetchall()]
    for s in stores:
        s["distance_miles"] = haversine_miles(HOME_LAT, HOME_LNG, s["lat"], s["lng"])
        revs = [dict(r) for r in c.execute(
            "SELECT * FROM reviews WHERE store_id = ? ORDER BY id DESC", (s["id"],)
        ).fetchall()]
        s["reviews"] = revs
        s["review_count"] = len(revs)
        if revs:
            avg_erg = sum(r["ergonomics_score"] for r in revs) / len(revs)
            avg_grd = sum(r["grading_score"] for r in revs) / len(revs)
            avg_vib = sum(r["vibe_score"] for r in revs) / len(revs)
            s["overall_score"] = round((avg_erg + avg_grd + avg_vib) / 3, 1)
        else:
            s["overall_score"] = None
    conn.close()
    stores.sort(key=lambda x: x["distance_miles"])
    return jsonify({"center": {"lat": HOME_LAT, "lng": HOME_LNG, "radius_miles": MAX_RADIUS_MILES}, "stores": stores})

@app.route("/api/reviews", methods=["POST"])
def add_review():
    data = request.json
    required = ["store_id", "reviewer_name", "ergonomics_score", "grading_score", "vibe_score", "comment"]
    if not all(k in data and str(data[k]).strip() for k in required):
        return jsonify({"error": "Missing required fields"}), 400
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        INSERT INTO reviews (store_id, reviewer_name, ergonomics_score, grading_score, vibe_score, best_pull, comment)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        int(data["store_id"]),
        data["reviewer_name"].strip(),
        int(data["ergonomics_score"]),
        int(data["grading_score"]),
        int(data["vibe_score"]),
        data.get("best_pull", "").strip(),
        data["comment"].strip()
    ))
    conn.commit()
    conn.close()
    return jsonify({"status": "ok"})

HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>20-Mile Crate Radar | Forth & Lothian Vinyl Directory</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  :root {
    --bg: #111315; --card: #1a1d21; --border: #2c313a;
    --accent: #f59e0b; --text: #f3f4f6; --muted: #9ca3af;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
  body { background: var(--bg); color: var(--text); display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
  header { padding: 14px 24px; background: #16181c; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
  header h1 { font-size: 1.25rem; letter-spacing: -0.02em; color: var(--accent); }
  .filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .chip { background: var(--card); border: 1px solid var(--border); color: var(--text); padding: 6px 12px; border-radius: 20px; font-size: 0.82rem; cursor: pointer; transition: 0.15s; }
  .chip.active { background: var(--accent); color: #000; border-color: var(--accent); font-weight: 600; }
  select, input[type="text"] { background: var(--card); border: 1px solid var(--border); color: var(--text); padding: 6px 12px; border-radius: 8px; font-size: 0.85rem; }
  .workspace { display: grid; grid-template-columns: 460px 1fr; flex: 1; overflow: hidden; }
  .sidebar { overflow-y: auto; padding: 16px; border-right: 1px solid var(--border); display: flex; flex-direction: column; gap: 14px; }
  #map { width: 100%; height: 100%; }
  .store-card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 16px; transition: 0.15s; cursor: pointer; }
  .store-card:hover { border-color: var(--accent); }
  .card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
  .store-name { font-size: 1.05rem; font-weight: 700; color: #fff; }
  .dist-badge { font-size: 0.78rem; background: #262b33; padding: 3px 8px; border-radius: 12px; color: var(--accent); white-space: nowrap; }
  .meta { font-size: 0.82rem; color: var(--muted); margin: 4px 0 8px; }
  .badges { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
  .badge { font-size: 0.72rem; padding: 2px 7px; border-radius: 4px; background: #242931; color: #d1d5db; }
  .badge.perk { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
  .desc { font-size: 0.85rem; line-height: 1.45; color: #d1d5db; margin-bottom: 12px; }
  .card-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 10px; font-size: 0.82rem; }
  .btn { background: var(--accent); color: #000; border: none; padding: 6px 12px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.8rem; }
  .reviews-box { margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border); font-size: 0.8rem; display: flex; flex-direction: column; gap: 8px; }
  .rev-item { background: #141619; padding: 8px 10px; border-radius: 6px; border-left: 3px solid var(--accent); }
  .pull-tag { color: #34d399; font-weight: 600; display: block; margin-top: 3px; }
  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: none; align-items: center; justify-content: center; z-index: 2000; }
  .modal { background: var(--card); border: 1px solid var(--border); border-radius: 12px; width: 92%; max-width: 460px; padding: 20px; }
  .modal h2 { margin-bottom: 14px; font-size: 1.15rem; color: var(--accent); }
  .form-group { margin-bottom: 12px; display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem; }
  .form-group input, .form-group textarea { width: 100%; background: #121417; border: 1px solid var(--border); color: #fff; padding: 8px; border-radius: 6px; }
</style>
</head>
<body>
<header>
  <div>
    <h1>20-MILE CRATE RADAR</h1>
    <span style="font-size:0.78rem; color:var(--muted);">Centred on South Queensferry (EH30) • Edinburgh, Fife, West Lothian & Falkirk</span>
  </div>
  <div class="filters">
    <input type="text" id="searchInput" placeholder="Search store or genre (e.g. Jazz, Dub)..." oninput="renderStores()">
    <button class="chip" onclick="toggleFilter('has_listening_deck', this)">Listening Deck</button>
    <button class="chip" onclick="toggleFilter('ultrasonic_cleaned', this)">Ultrasonic Cleaned</button>
    <button class="chip" onclick="toggleFilter('has_bargain_crates', this)">£1-£3 Crates</button>
    <button class="chip" onclick="toggleFilter('has_coffee_bar', this)">Coffee / Bar</button>
  </div>
</header>

<div class="workspace">
  <div class="sidebar" id="storeList"></div>
  <div id="map"></div>
</div>

<div class="modal-backdrop" id="reviewModal">
  <div class="modal">
    <h2 id="modalTitle">Review Store</h2>
    <input type="hidden" id="modalStoreId">
    <div class="form-group">
      <label>Your Handle / Name</label>
      <input type="text" id="revName" placeholder="e.g. CrateDigger_EH30">
    </div>
    <div class="form-group">
      <label>Crate Ergonomics (1 = Jammed tight, 5 = Breeze to flick): <span id="ergVal">4</span>/5</label>
      <input type="range" min="1" max="5" value="4" id="revErg" oninput="document.getElementById('ergVal').innerText=this.value">
    </div>
    <div class="form-group">
      <label>Grading & Pricing Honesty (1 = Overpriced G+, 5 = Spot-on VG+): <span id="grdVal">4</span>/5</label>
      <input type="range" min="1" max="5" value="4" id="revGrd" oninput="document.getElementById('grdVal').innerText=this.value">
    </div>
    <div class="form-group">
      <label>Shop Vibe & Knowledge: <span id="vibVal">5</span>/5</label>
      <input type="range" min="1" max="5" value="5" id="revVib" oninput="document.getElementById('vibVal').innerText=this.value">
    </div>
    <div class="form-group">
      <label>Best Record Pulled Here (Optional)</label>
      <input type="text" id="revPull" placeholder="Artist - Album Title">
    </div>
    <div class="form-group">
      <label>Your Review</label>
      <textarea rows="3" id="revComment" placeholder="How are the racks, pricing, and genre depth?"></textarea>
    </div>
    <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:14px;">
      <button class="chip" onclick="closeModal()">Cancel</button>
      <button class="btn" onclick="submitReview()">Post Review</button>
    </div>
  </div>
</div>

<script>
let allStores = [];
let activeFilters = {};
let map, markersLayer;

function initMap(center) {
  map = L.map('map').setView([center.lat, center.lng], 10);
  const CARTO_API_KEY = 'cb1_4ne1_1_094dcaefb65c51dadc289a07';
  L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_API_KEY}`, {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);

  // Draw 20-mile radius ring (20 miles = 32186.9 meters)
  L.circle([center.lat, center.lng], {
    radius: 32186.9, color: '#f59e0b', weight: 1.5, fillOpacity: 0.04, dashArray: '6, 6'
  }).addTo(map);

  // Home marker
  L.circleMarker([center.lat, center.lng], {
    radius: 6, color: '#34d399', fillColor: '#34d399', fillOpacity: 1
  }).addTo(map).bindPopup("<b>Hub Centre: South Queensferry (EH30)</b>");

  markersLayer = L.layerGroup().addTo(map);
}

async function loadData() {
  const res = await fetch('/api/stores');
  const data = await res.json();
  if (!map) initMap(data.center);
  allStores = data.stores;
  renderStores();
}

function toggleFilter(key, btn) {
  activeFilters[key] = !activeFilters[key];
  btn.classList.toggle('active', activeFilters[key]);
  renderStores();
}

function renderStores() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  const listEl = document.getElementById('storeList');
  listEl.innerHTML = '';
  markersLayer.clearLayers();

  const filtered = allStores.filter(s => {
    if (q && !(s.name.toLowerCase().includes(q) || s.genres.toLowerCase().includes(q) || s.area.toLowerCase().includes(q))) return false;
    for (let k in activeFilters) {
      if (activeFilters[k] && !s[k]) return false;
    }
    return true;
  });

  filtered.forEach(s => {
    const marker = L.circleMarker([s.lat, s.lng], {
      radius: 8, color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 0.85
    }).addTo(markersLayer);
    marker.bindPopup(`<b>${s.name}</b><br>${s.address}<br><span style="color:#f59e0b">${s.distance_miles} miles from EH30</span>`);

    const perks = [];
    if (s.has_listening_deck) perks.push('Listening Deck');
    if (s.ultrasonic_cleaned) perks.push('Ultrasonic Cleaned');
    if (s.buys_collections) perks.push('Buys Wax');
    if (s.has_bargain_crates) perks.push('£1-£3 Crates');
    if (s.has_coffee_bar) perks.push('Coffee / Lounge');

    const reviewsHtml = s.reviews.map(r => `
      <div class="rev-item">
        <strong>${r.reviewer_name}</strong> • Ergonomics ${r.ergonomics_score}/5 | Grading ${r.grading_score}/5 | Vibe ${r.vibe_score}/5
        <p style="margin-top:4px; color:#d1d5db;">"${r.comment}"</p>
        ${r.best_pull ? `<span class="pull-tag">Best Pull: ${r.best_pull}</span>` : ''}
      </div>
    `).join('');

    const card = document.createElement('div');
    card.className = 'store-card';
    card.onclick = (e) => {
      if (e.target.tagName !== 'BUTTON') {
        map.flyTo([s.lat, s.lng], 14, {duration: 0.6});
        marker.openPopup();
      }
    };
    card.innerHTML = `
      <div class="card-top">
        <div class="store-name">${s.name}</div>
        <span class="dist-badge">${s.distance_miles} mi</span>
      </div>
      <div class="meta">${s.area} • ${s.address} • <strong>${s.stock_type}</strong></div>
      <div class="badges">
        ${s.genres.split(',').map(g => `<span class="badge">${g.trim()}</span>`).join('')}
        ${perks.map(p => `<span class="badge perk">${p}</span>`).join('')}
      </div>
      <div class="desc">${s.description}</div>
      <div class="card-footer">
        <span>${s.overall_score ? `⭐ <strong>${s.overall_score}/5</strong> Digger Score (${s.review_count})` : 'No reviews yet'}</span>
        <button class="btn" onclick="openModal(${s.id}, '${s.name.replace(/'/g, "\\'")}')">+ Rate & Review</button>
      </div>
      ${s.reviews.length ? `<div class="reviews-box">${reviewsHtml}</div>` : ''}
    `;
    listEl.appendChild(card);
  });
}

function openModal(id, name) {
  document.getElementById('modalStoreId').value = id;
  document.getElementById('modalTitle').innerText = 'Review ' + name;
  document.getElementById('reviewModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('reviewModal').style.display = 'none';
}

async function submitReview() {
  const payload = {
    store_id: document.getElementById('modalStoreId').value,
    reviewer_name: document.getElementById('revName').value,
    ergonomics_score: document.getElementById('revErg').value,
    grading_score: document.getElementById('revGrd').value,
    vibe_score: document.getElementById('revVib').value,
    best_pull: document.getElementById('revPull').value,
    comment: document.getElementById('revComment').value
  };
  const res = await fetch('/api/reviews', {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
  });
  if (res.ok) {
    closeModal();
    document.getElementById('revComment').value = '';
    document.getElementById('revPull').value = '';
    loadData();
  } else {
    alert('Please fill in your name and review comment.');
  }
}

loadData();
</script>
</body>
</html>
"""

@app.route("/")
def index():
    return render_template_string(HTML_TEMPLATE)

if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=5000)