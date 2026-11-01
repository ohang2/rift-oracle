// Fetches the Worlds schedule/results from lolesports and writes data/schedule.json
// (only when something changed, so the Action does not commit every run).
import fs from 'node:fs';
import './lolesports-core.js';
const { LOLE, fetchWorldsEvents } = globalThis.LOLE_CORE;

async function get(path, params) {
  const u = new URL(LOLE.api + path);
  Object.entries({ hl: 'en-US', ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u, { headers: { 'x-api-key': LOLE.key } });
  if (!r.ok) throw new Error(`${path} HTTP ${r.status}`);
  return r.json();
}
const readJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const writeIfChanged = (f, obj, cmp) => {
  const prev = readJSON(f);
  if (prev && JSON.stringify(cmp(prev)) === JSON.stringify(cmp(obj))) return false;
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync(f, JSON.stringify(obj, null, 1) + '\n');
  return true;
};

try {
  let league = LOLE.league;
  try {
    const L = await get('/getLeagues', {});
    const w = (L.data.leagues || []).find(l => l.slug === 'worlds');
    if (w) league = w.id;
  } catch (e) { console.log('getLeagues failed, using default id:', e.message); }
  const events = await fetchWorldsEvents(get, league);
  if (!events.length) throw new Error('schedule returned no Worlds 2026 matches');
  const changed = writeIfChanged('data/schedule.json', { updated: new Date().toISOString(), league, events }, o => o.events);
  writeIfChanged('data/status.json', { ok: true, error: null }, o => o);
  console.log(changed ? `schedule updated: ${events.length} matches` : 'no change');
  const blocks = [...new Set(events.map(e => e.block))];
  console.log('blocks:', blocks.join(' | '));
  console.log('codes:', [...new Set(events.flatMap(e => e.teams.map(t => t.code + '=' + t.name)))].join(', '));
} catch (e) {
  console.error('update failed:', e.message);
  writeIfChanged('data/status.json', { ok: false, error: String(e.message).slice(0, 300), at: new Date().toISOString() }, o => [o.ok, o.error]);
  process.exitCode = 1;
}
