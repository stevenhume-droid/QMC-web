import fs from 'node:fs';
import vm from 'node:vm';

const j = JSON.parse(fs.readFileSync('record-shops/stores.json', 'utf8'));
const bg = j.stores.find(s => s.name === 'Beat Generator');
if (!bg) throw new Error('Missing Beat Generator in stores.json');
if (!bg.has_listening_deck) throw new Error('Beat Generator should have listening deck');
if (!bg.reviews || bg.reviews.length === 0 || bg.reviews[0].reviewer_name !== 'Stewart') {
  throw new Error('Missing Stewart review on Beat Generator');
}
if (!bg.reviews[0].best_pull.includes('Johnny Cash')) {
  throw new Error('Missing Johnny Cash pull on Beat Generator');
}

for (const f of ['record-shops/index.html', 'record-shops/crawl.html']) {
  const h = fs.readFileSync(f, 'utf8');
  if (!h.includes('Beat Generator')) throw new Error('Missing Beat Generator in ' + f);
  const scripts = [...h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
  scripts.forEach((m, i) => {
    if (m[1].trim()) new vm.Script(m[1], { filename: f + '#' + i });
  });
}

console.log('ALL_RECORD_SHOPS_CHECKS_PASSED:', j.stores.length, 'stores, Beat Generator id=' + bg.id);
