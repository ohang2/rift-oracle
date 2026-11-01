// lolesports data access shared by the site (browser) and the GitHub Action (Node 20+).
// Unofficial lolesports.com API, public key published in community docs (github.com/vickz84259/lolesports-api-docs).
(function (g) {
  const LOLE = {
    api: 'https://esports-api.lolesports.com/persisted/gw',
    feed: 'https://feed.lolesports.com/livestats/v1',
    key: '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z',
    league: '98767975604431411', // Worlds
    since: '2026-10-01T00:00:00Z'
  };
  // Keep only what the site needs from schedule events.
  function slim(events) {
    const seen = new Set(), out = [];
    (events || []).forEach(e => {
      if (!e || e.type !== 'match' || !e.match || !e.match.id || seen.has(e.match.id)) return;
      if ((e.startTime || '') < LOLE.since) return;
      seen.add(e.match.id);
      out.push({
        id: e.match.id, start: e.startTime, state: e.state, block: e.blockName || '',
        bo: (e.match.strategy && e.match.strategy.count) || null,
        teams: (e.match.teams || []).map(t => ({
          code: t.code || '', name: t.name || '',
          win: t.result ? (t.result.outcome || null) : null,
          gw: t.result && typeof t.result.gameWins === 'number' ? t.result.gameWins : null,
          rec: t.record ? { w: t.record.wins, l: t.record.losses } : null
        }))
      });
    });
    return out.sort((a, b) => (a.start || '').localeCompare(b.start || '') || a.id.localeCompare(b.id));
  }
  // get(path, params) -> parsed JSON from the esports API
  async function fetchWorldsEvents(get, league) {
    league = league || LOLE.league;
    const first = await get('/getSchedule', { leagueId: league });
    const sch = first.data.schedule;
    let events = (sch.events || []).slice();
    let older = sch.pages && sch.pages.older, newer = sch.pages && sch.pages.newer, n = 0;
    const earliest = () => events.reduce((m, e) => (e.startTime < m ? e.startTime : m), '9999');
    while (older && n < 8 && earliest() > LOLE.since) {
      const d = await get('/getSchedule', { leagueId: league, pageToken: older });
      events = (d.data.schedule.events || []).concat(events);
      older = d.data.schedule.pages && d.data.schedule.pages.older; n++;
    }
    n = 0;
    while (newer && n < 3) {
      const d = await get('/getSchedule', { leagueId: league, pageToken: newer });
      events = events.concat(d.data.schedule.events || []);
      newer = d.data.schedule.pages && d.data.schedule.pages.newer; n++;
    }
    return slim(events);
  }
  g.LOLE_CORE = { LOLE, slim, fetchWorldsEvents };
})(typeof globalThis !== 'undefined' ? globalThis : window);
