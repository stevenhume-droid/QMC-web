const albums = [
  { id: 'rec_lp_1973_001', artist: 'Pink Floyd', title: 'The Dark Side of the Moon' },
  { id: 'rec_7_1977_002', artist: 'Althea & Donna', title: 'Uptown Top Ranking' },
  { id: 'rec_lp_1959_003', artist: 'Miles Davis', title: 'Kind of Blue' },
  { id: 'rec_7_1976_004', artist: 'The Damned', title: 'New Rose' },
  { id: 'rec_box_1978_005', artist: 'David Bowie', title: 'Stage' }
];

async function checkCovers() {
  for (const a of albums) {
    // 1. Check iTunes
    let itunesImg = null;
    let itunesTitle = null;
    try {
      const q = encodeURIComponent(a.artist + ' ' + a.title);
      const res = await fetch('https://itunes.apple.com/search?term=' + q + '&entity=album&limit=5');
      const data = await res.json();
      const match = data.results?.find(r => r.artistName?.toLowerCase().includes(a.artist.split(' ')[0].toLowerCase()));
      if (match?.artworkUrl100) {
        itunesImg = match.artworkUrl100.replace('100x100bb', '600x600bb');
        itunesTitle = match.collectionName;
      }
    } catch (e) {
      console.warn('iTunes error for', a.title, e.message);
    }

    // 2. Check CoverArtArchive
    let caaImg = null;
    try {
      const q = encodeURIComponent(`"${a.title}" AND "${a.artist}"`);
      const res = await fetch(`https://musicbrainz.org/ws/2/release-group?query=${q}&fmt=json`, {
        headers: { 'User-Agent': 'QMCArchive/1.0 (steve@example.com)' }
      });
      const data = await res.json();
      const rg = data['release-groups']?.[0];
      if (rg) {
        const caRes = await fetch('https://coverartarchive.org/release-group/' + rg.id);
        if (caRes.ok) {
          const caData = await caRes.json();
          const front = caData.images?.find(img => img.front);
          caaImg = front?.thumbnails?.['500'] || front?.image;
        }
      }
    } catch (e) {
      console.warn('CAA error for', a.title, e.message);
    }

    console.log('----------------------------------------------------');
    console.log(a.artist + ' - ' + a.title);
    console.log('iTunes (' + itunesTitle + '):', itunesImg);
    console.log('CAA:', caaImg);
  }
}
checkCovers();
