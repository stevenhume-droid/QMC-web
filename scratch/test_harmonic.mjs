const CAMELOT_KEY_MAP = {
  'C Major': '8B', 'A Minor': '8A',
  'G Major': '9B', 'E Minor': '9A',
  'D Major': '10B', 'B Minor': '10A',
  'A Major': '11B', 'F♯ Minor': '11A',
  'E Major': '12B', 'C♯ Minor': '12A',
  'B Major': '1B', 'G♯ Minor': '1A',
  'F♯ Major': '2B', 'E♭ Minor': '2A',
  'D♭ Major': '3B', 'B♭ Minor': '3A',
  'A♭ Major': '4B', 'F Minor': '4A',
  'E♭ Major': '5B', 'C Minor': '5A',
  'B♭ Major': '6B', 'G Minor': '6A',
  'F Major': '7B', 'D Minor': '7A'
};

function parseCamelot(code) {
  if (!code || typeof code !== 'string') return null;
  const m = code.trim().toUpperCase().match(/^(\d{1,2})\s*([AB])$/);
  if (!m) return null;
  const num = parseInt(m[1], 10);
  if (num < 1 || num > 12) return null;
  return { num, letter: m[2] };
}

function harmonicKeyDistance(c1, c2) {
  if (!c1 || !c2) return 6;
  const diff = Math.abs(c1.num - c2.num);
  const clock = Math.min(diff, 12 - diff);
  const sameMode = c1.letter === c2.letter;
  if (clock === 0) return sameMode ? 0 : 1;
  if (clock === 1) return sameMode ? 2 : 3;
  if (clock === 2) return sameMode ? 5 : 6;
  return clock * 4;
}

function transitionCost(t1, t2) {
  const kDist = harmonicKeyDistance(t1.camelotObj, t2.camelotObj);
  const bpmDiff = Math.abs(t1.bpm - t2.bpm);
  return (kDist * 8) + (bpmDiff * 1.2);
}

const sampleTracks = [
  { title: 'Track 1', bpm: 124, camelot: '8A' },
  { title: 'Track 2', bpm: 118, camelot: '7A' },
  { title: 'Track 3', bpm: 120, camelot: '8B' },
  { title: 'Track 4', bpm: 126, camelot: '9A' },
  { title: 'Track 5', bpm: 122, camelot: '8A' }
].map(t => ({ ...t, camelotObj: parseCamelot(t.camelot) }));

// Sort harmonic
let unvisited = [...sampleTracks];
unvisited.sort((a,b) => a.bpm - b.bpm);
const result = [unvisited.shift()];

while (unvisited.length > 0) {
  const current = result[result.length - 1];
  let bestIdx = 0;
  let bestCost = Infinity;
  for (let i = 0; i < unvisited.length; i++) {
    const cost = transitionCost(current, unvisited[i]);
    if (cost < bestCost) {
      bestCost = cost;
      bestIdx = i;
    }
  }
  result.push(unvisited.splice(bestIdx, 1)[0]);
}

console.log('Harmonic result:', result.map(t => `${t.title} (${t.bpm} BPM, ${t.camelot})`));

