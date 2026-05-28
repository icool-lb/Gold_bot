// api/price.js — MetaAPI with CORRECT hostnames
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache');

  const TOKEN   = process.env.METAAPI_TOKEN;
  const ACCOUNT = process.env.METAAPI_ACCOUNT_ID;
  const type    = req.query.type   || 'price';
  const tf      = req.query.tf     || 'M15';
  const limit   = parseInt(req.query.limit || '60');
  const sym     = req.query.symbol || 'XAUUSD';

  if (!TOKEN || !ACCOUNT) return res.status(500).json({ error: 'Missing credentials' });

  const H = { 'auth-token': TOKEN, 'Content-Type': 'application/json' };
  const tfMap = { M1:'1m', M5:'5m', M15:'15m', M30:'30m', H1:'1h', H4:'4h', D1:'1d' };
  const metaTF = tfMap[tf] || '15m';

  // ══ السعر — mt-client-api ══
  if (type === 'price') {
    const regions = ['london', 'new-york', 'singapore'];
    for (const region of regions) {
      try {
        const url = `https://mt-client-api-v1.${region}.agiliumtrade.ai/users/current/accounts/${ACCOUNT}/symbols/${sym}/current-price`;
        const r = await fetch(url, { headers: H });
        if (!r.ok) continue;
        const d = await r.json();
        const bid = parseFloat(d.bid || 0);
        const ask = parseFloat(d.ask || 0);
        if (bid > 0) return res.status(200).json({
          price: parseFloat(((bid+ask)/2).toFixed(4)),
          bid, ask, spread: parseFloat((ask-bid).toFixed(4)),
          symbol: sym, source: 'metaapi-'+region, ts: Date.now()
        });
      } catch(e) { continue; }
    }
    return res.status(500).json({ error: 'Price fetch failed all regions' });
  }

  // ══ الشمعات — mt-market-data-client-api (hostname مختلف!) ══
  if (type === 'candles') {
    const regions = ['new-york', 'london', 'singapore'];
    const errors = [];

    for (const region of regions) {
      // Historical candles endpoint
      const url = `https://mt-market-data-client-api-v1.${region}.agiliumtrade.ai/users/current/accounts/${ACCOUNT}/historical-market-data/symbols/${sym}/timeframes/${metaTF}/candles?limit=${limit}`;
      try {
        const r = await fetch(url, { headers: H });
        const txt = await r.text();
        if (!r.ok) { errors.push(`${region}: ${r.status} ${txt.slice(0,80)}`); continue; }
        const raw = JSON.parse(txt);
        if (!Array.isArray(raw) || !raw.length) { errors.push(`${region}: empty`); continue; }

        const candles = raw.map(function(c) {
          const t = c.time || c.brokerTime || '';
          return {
            t:  new Date(t).getTime() || 0,
            o:  parseFloat(c.open  || 0),
            h:  parseFloat(c.high  || 0),
            l:  parseFloat(c.low   || 0),
            cl: parseFloat(c.close || 0),
            v:  parseInt(c.tickVolume || c.volume || 1)
          };
        }).filter(function(c){ return c.o>0 && c.cl>0 && c.h>=c.l; })
          .sort(function(a,b){ return a.t-b.t; });

        if (!candles.length) { errors.push(`${region}: no valid`); continue; }

        return res.status(200).json({
          candles, symbol: sym, tf, count: candles.length,
          source: 'metaapi-history-'+region, ts: Date.now()
        });
      } catch(e) { errors.push(`${region}: ${e.message}`); continue; }
    }

    // Fallback: current-candles endpoint (mt-client-api)
    for (const region of regions) {
      const url = `https://mt-client-api-v1.${region}.agiliumtrade.ai/users/current/accounts/${ACCOUNT}/symbols/${sym}/current-candles/${metaTF}`;
      try {
        const r = await fetch(url, { headers: H });
        if (!r.ok) continue;
        const d = await r.json();
        if (d && d.open) {
          return res.status(200).json({
            candles: [{
              t: new Date(d.time||d.brokerTime||0).getTime(),
              o: parseFloat(d.open), h: parseFloat(d.high),
              l: parseFloat(d.low),  cl: parseFloat(d.close), v: 1
            }],
            symbol: sym, tf, count: 1,
            source: 'metaapi-current-'+region, ts: Date.now()
          });
        }
      } catch(e) { continue; }
    }

    return res.status(500).json({
      error: 'All MetaAPI candle endpoints failed',
      details: errors,
      hint: 'Verify MetaAPI account is connected and has market data access'
    });
  }

  return res.status(400).json({ error: 'type must be price or candles' });
}
