// api/price.js — XAU/USD Price + Candles from MetaAPI MT5

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store');

  const TOKEN   = process.env.METAAPI_TOKEN;
  const ACCOUNT = process.env.METAAPI_ACCOUNT_ID;
  const type    = req.query.type  || 'price';
  const tf      = req.query.tf    || 'M15';
  const limit   = parseInt(req.query.limit || '60');
  const symReq  = req.query.symbol || 'XAUUSD';

  if (!TOKEN || !ACCOUNT) {
    return res.status(500).json({ error: 'Missing MetaAPI credentials' });
  }

  const HEADERS = { 'auth-token': TOKEN, 'Content-Type': 'application/json' };
  const BASE_URL = `https://mt-client-api-v1.london.agiliumtrade.ai/users/current/accounts/${ACCOUNT}`;

  // ── السعر اللحظي ──────────────────────────────────────────
  if (type === 'price') {
    try {
      const r = await fetch(
        `${BASE_URL}/symbols/${symReq}/current-price`,
        { headers: HEADERS }
      );
      if (!r.ok) throw new Error(`MetaAPI ${r.status}: ${await r.text()}`);
      const d   = await r.json();
      const bid = parseFloat(d.bid || 0);
      const ask = parseFloat(d.ask || 0);
      return res.status(200).json({
        price:  parseFloat(((bid + ask) / 2).toFixed(4)),
        bid:    parseFloat(bid.toFixed(4)),
        ask:    parseFloat(ask.toFixed(4)),
        spread: parseFloat((ask - bid).toFixed(4)),
        symbol: symReq,
        source: 'metaapi-mt5',
        ts:     Date.now()
      });
    } catch(e) {
      return res.status(500).json({ error: e.message, price: null });
    }
  }

  // ── الشمعات من MetaAPI مباشرة ─────────────────────────────
  if (type === 'candles') {
    // تحويل TF إلى MetaAPI timeframe
    const tfMap = {
      M1: '1m', M5: '5m', M15: '15m', M30: '30m',
      H1: '1h', H4: '4h', D1:  '1d',  W1:  '1w'
    };
    const metaTF = tfMap[tf] || '15m';

    try {
      // MetaAPI candles endpoint
      const url = `${BASE_URL}/history/candles/${symReq}/${metaTF}?limit=${limit}`;
      const r   = await fetch(url, { headers: HEADERS });

      if (!r.ok) throw new Error(`MetaAPI candles ${r.status}: ${await r.text()}`);
      const data = await r.json();

      // MetaAPI format: array of { time, brokerTime, open, high, low, close, tickVolume }
      if (!Array.isArray(data) || !data.length) {
        throw new Error('No candles from MetaAPI');
      }

      const candles = data
        .map(c => ({
          t:  new Date(c.time || c.brokerTime).getTime(),
          o:  parseFloat((c.open  || 0).toFixed(3)),
          h:  parseFloat((c.high  || 0).toFixed(3)),
          l:  parseFloat((c.low   || 0).toFixed(3)),
          cl: parseFloat((c.close || 0).toFixed(3)),
          v:  parseInt(c.tickVolume || c.volume || 1)
        }))
        .filter(c =>
          c.o > 0 && c.cl > 0 && c.h > 0 && c.l > 0 &&
          c.h >= c.l &&
          !isNaN(c.o) && !isNaN(c.cl)
        )
        .sort((a, b) => a.t - b.t);

      return res.status(200).json({
        candles,
        symbol: symReq,
        tf,
        count:  candles.length,
        source: 'metaapi-mt5',
        ts:     Date.now()
      });

    } catch(metaErr) {
      // ── Fallback: Yahoo Finance إذا فشل MetaAPI ──────────
      try {
        const yahooSymMap = {
          XAUUSD: 'GC%3DF',
          XAGUSD: 'SI%3DF',
          'DX-Y.NYB': 'DX%3DF'
        };
        const yahooSym  = yahooSymMap[symReq] || 'GC%3DF';
        const intMap    = { M5:'5m', M15:'15m', M30:'30m', H1:'1h', H4:'1h', D1:'1d' };
        const rngMap    = { M5:'5d', M15:'5d',  M30:'5d',  H1:'1mo', H4:'1mo', D1:'6mo' };
        const interval  = intMap[tf]  || '15m';
        const range     = rngMap[tf]  || '5d';

        const yr = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=${interval}&range=${range}&includePrePost=false`,
          { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }
        );
        if (!yr.ok) throw new Error(`Yahoo ${yr.status}`);
        const json   = await yr.json();
        const result = json?.chart?.result?.[0];
        const ts     = result?.timestamp || [];
        const q      = result?.indicators?.quote?.[0] || {};
        if (!ts.length) throw new Error('No Yahoo data');

        // بناء الشمعات مع فلتر صارم
        const rawCandles = ts.map((t, i) => ({
          t:  t * 1000,
          o:  parseFloat((q.open?.[i]  || 0).toFixed(3)),
          h:  parseFloat((q.high?.[i]  || 0).toFixed(3)),
          l:  parseFloat((q.low?.[i]   || 0).toFixed(3)),
          cl: parseFloat((q.close?.[i] || 0).toFixed(3)),
          v:  parseInt(q.volume?.[i]   || 1)
        })).filter(c =>
          c.o > 0 && c.cl > 0 && c.h > 0 && c.l > 0 &&
          c.h >= c.l && c.h >= c.o && c.h >= c.cl &&
          c.l <= c.o && c.l <= c.cl &&
          !isNaN(c.o) && !isNaN(c.cl)
        ).sort((a, b) => a.t - b.t);

        // إزالة outliers بالـ Median
        const mids = rawCandles.map(c => (c.h + c.l) / 2).sort((a, b) => a - b);
        const med  = mids[Math.floor(mids.length / 2)] || 0;
        const maxDev = med * 0.02;

        const candles = med > 0
          ? rawCandles.filter(c => Math.abs((c.h + c.l) / 2 - med) <= maxDev)
          : rawCandles;

        return res.status(200).json({
          candles: candles.slice(-limit),
          symbol: symReq, tf,
          count:  candles.length,
          source: 'yahoo-fallback',
          metaError: metaErr.message,
          ts: Date.now()
        });
      } catch(yahooErr) {
        return res.status(500).json({
          error:      metaErr.message,
          yahooError: yahooErr.message,
          candles:    []
        });
      }
    }
  }

  return res.status(400).json({ error: 'type must be price or candles' });
}
