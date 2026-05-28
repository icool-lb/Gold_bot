// api/price.js — XAU/USD via MetaAPI MT5 (primary) + Yahoo (fallback)

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store');

  const TOKEN   = process.env.METAAPI_TOKEN;
  const ACCOUNT = process.env.METAAPI_ACCOUNT_ID;
  const type    = req.query.type   || 'price';
  const tf      = req.query.tf     || 'M15';
  const limit   = parseInt(req.query.limit || '60');
  const symReq  = req.query.symbol || 'XAUUSD';

  const BASE = TOKEN && ACCOUNT
    ? `https://mt-client-api-v1.london.agiliumtrade.ai/users/current/accounts/${ACCOUNT}`
    : null;
  const H = { 'auth-token': TOKEN || '', 'Content-Type': 'application/json' };

  // ══ السعر اللحظي ══════════════════════════════════════════
  if (type === 'price') {
    if (BASE) {
      try {
        const r = await fetch(`${BASE}/symbols/${symReq}/current-price`, { headers: H });
        if (r.ok) {
          const d = await r.json();
          const bid = parseFloat(d.bid || 0);
          const ask = parseFloat(d.ask || 0);
          if (bid > 0) {
            return res.status(200).json({
              price:  parseFloat(((bid+ask)/2).toFixed(4)),
              bid:    parseFloat(bid.toFixed(4)),
              ask:    parseFloat(ask.toFixed(4)),
              spread: parseFloat((ask-bid).toFixed(4)),
              symbol: symReq, source: 'metaapi', ts: Date.now()
            });
          }
        }
      } catch(e) {}
    }
    // Yahoo fallback للسعر
    try {
      const yMap = { XAUUSD: 'GC%3DF', XAGUSD: 'SI%3DF' };
      const yr = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${yMap[symReq]||'GC%3DF'}?interval=1m&range=1d`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      if (yr.ok) {
        const yj = await yr.json();
        const meta = yj && yj.chart && yj.chart.result && yj.chart.result[0] && yj.chart.result[0].meta;
        if (meta && meta.regularMarketPrice) {
          const p = parseFloat(meta.regularMarketPrice);
          return res.status(200).json({
            price: p, bid: p-0.1, ask: p+0.1, spread: 0.2,
            symbol: symReq, source: 'yahoo-price', ts: Date.now()
          });
        }
      }
    } catch(e) {}
    return res.status(500).json({ error: 'Cannot fetch price', price: null });
  }

  // ══ الشمعات ════════════════════════════════════════════════
  if (type === 'candles') {
    const tfMap  = { M1:'1m', M5:'5m', M15:'15m', M30:'30m', H1:'1h', H4:'4h', D1:'1d' };
    const metaTF = tfMap[tf] || '15m';

    // ── MetaAPI: 3 endpoints بالترتيب ──────────────────────
    if (BASE) {
      const endpoints = [
        // 1. Current candles (real-time terminal state)
        `${BASE}/symbols/${symReq}/current-candles/${metaTF}?limit=${limit}`,
        // 2. History candles
        `${BASE}/history/candles/${symReq}/${metaTF}?limit=${limit}`,
        // 3. Terminal state
        `${BASE}/terminal-state/candles/${symReq}/${metaTF}?limit=${limit}`,
      ];

      for (const url of endpoints) {
        try {
          const r = await fetch(url, { headers: H });
          if (!r.ok) continue;
          const raw = await r.json();
          if (!Array.isArray(raw) || raw.length === 0) continue;

          const candles = raw
            .map(function(c) {
              // MetaAPI field names vary by endpoint
              const t  = c.time || c.brokerTime || c.openTime || 0;
              const o  = parseFloat(c.open  || c.o || 0);
              const h  = parseFloat(c.high  || c.h || 0);
              const l  = parseFloat(c.low   || c.l || 0);
              const cl = parseFloat(c.close || c.close || c.cl || 0);
              return {
                t:  typeof t === 'string' ? new Date(t).getTime() : t * 1000,
                o:  parseFloat(o.toFixed(3)),
                h:  parseFloat(h.toFixed(3)),
                l:  parseFloat(l.toFixed(3)),
                cl: parseFloat(cl.toFixed(3)),
                v:  parseInt(c.tickVolume || c.volume || 1)
              };
            })
            .filter(function(c) {
              return c.o > 0 && c.cl > 0 && c.h >= c.l && c.h > 0;
            })
            .sort(function(a, b) { return a.t - b.t; });

          if (candles.length > 0) {
            return res.status(200).json({
              candles, symbol: symReq, tf,
              count: candles.length,
              source: 'metaapi-mt5',
              endpoint: url.replace(BASE, ''),
              ts: Date.now()
            });
          }
        } catch(e) { continue; }
      }
    }

    // ── Yahoo Finance Fallback ──────────────────────────────
    try {
      const yMap2 = { XAUUSD: 'GC%3DF', XAGUSD: 'SI%3DF' };
      const intMap = { M5:'5m', M15:'15m', M30:'30m', H1:'1h', H4:'1h', D1:'1d' };
      const rngMap = { M5:'2d', M15:'2d', M30:'2d', H1:'5d', H4:'1mo', D1:'6mo' };

      const yr = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${yMap2[symReq]||'GC%3DF'}?interval=${intMap[tf]||'15m'}&range=${rngMap[tf]||'2d'}&includePrePost=false`,
        { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }
      );
      if (!yr.ok) throw new Error('Yahoo ' + yr.status);

      const yj     = await yr.json();
      const result = yj && yj.chart && yj.chart.result && yj.chart.result[0];
      const tss    = (result && result.timestamp) || [];
      const q      = (result && result.indicators && result.indicators.quote && result.indicators.quote[0]) || {};
      if (!tss.length) throw new Error('No Yahoo data');

      const rawC = tss.map(function(t, i) {
        return {
          t:  t * 1000,
          o:  parseFloat(((q.open  && q.open[i])  || 0).toFixed(3)),
          h:  parseFloat(((q.high  && q.high[i])  || 0).toFixed(3)),
          l:  parseFloat(((q.low   && q.low[i])   || 0).toFixed(3)),
          cl: parseFloat(((q.close && q.close[i]) || 0).toFixed(3)),
          v:  parseInt((q.volume && q.volume[i]) || 1)
        };
      }).filter(function(c) {
        return c.o > 0 && c.cl > 0 && c.h >= c.l && c.h >= c.o && c.l <= c.o;
      }).sort(function(a, b) { return a.t - b.t; });

      // Median outlier filter
      var mids = rawC.map(function(c){ return (c.h+c.l)/2; }).slice().sort(function(a,b){return a-b;});
      var med  = mids[Math.floor(mids.length/2)] || 0;
      var maxD = med * 0.025;
      var candles = med > 0
        ? rawC.filter(function(c){ return Math.abs((c.h+c.l)/2-med) <= maxD; })
        : rawC;

      // JSON round-trip لضمان writable objects
      const writableCandles = JSON.parse(JSON.stringify(candles.slice(-limit)));
      return res.status(200).json({
        candles: writableCandles,
        symbol: symReq, tf,
        count: candles.length,
        source: 'yahoo-futures',
        note: 'GC=F futures — offset will be applied client-side',
        ts: Date.now()
      });

    } catch(e2) {
      return res.status(500).json({ error: e2.message, candles: [] });
    }
  }

  return res.status(400).json({ error: 'type must be price or candles' });
}
