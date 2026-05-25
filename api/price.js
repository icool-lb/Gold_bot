// api/price.js — XAU/USD Live Price from MetaAPI MT5

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store');

  const TOKEN   = process.env.METAAPI_TOKEN;
  const ACCOUNT = process.env.METAAPI_ACCOUNT_ID;
  const type    = req.query.type   || 'price';
  const tf      = req.query.tf     || 'M5';
  const limit   = parseInt(req.query.limit || '100');
  const symbol  = 'XAUUSD';

  if (!TOKEN || !ACCOUNT) return res.status(500).json({ error: 'Missing MetaAPI credentials' });

  const HEADERS = { 'auth-token': TOKEN, 'Content-Type': 'application/json' };
  const BASE    = `https://mt-client-api-v1.london.agiliumtrade.ai/users/current/accounts/${ACCOUNT}`;

  // ── السعر اللحظي ─────────────────────────────────────────
  if (type === 'price') {
    try {
      const r = await fetch(`${BASE}/symbols/${symbol}/current-price`, { headers: HEADERS });
      if (!r.ok) throw new Error(`MetaAPI ${r.status}: ${await r.text()}`);
      const d   = await r.json();
      const bid = parseFloat(d.bid || 0);
      const ask = parseFloat(d.ask || 0);
      return res.status(200).json({
        price:  parseFloat(((bid+ask)/2).toFixed(4)),
        bid:    parseFloat(bid.toFixed(4)),
        ask:    parseFloat(ask.toFixed(4)),
        spread: parseFloat((ask-bid).toFixed(4)),
        symbol: 'XAUUSD',
        source: 'metaapi-mt5',
        ts:     Date.now()
      });
    } catch(e) {
      return res.status(500).json({ error: e.message, price: null });
    }
  }

  // ── الشمعات من Yahoo Finance ──────────────────────────────
  if (type === 'candles') {
    const intervalMap = { M5:'5m', M15:'15m', M30:'30m', H1:'1h', H4:'1h', D1:'1d' };
    const rangeMap    = { M5:'5d', M15:'5d',  M30:'5d',  H1:'1mo', H4:'1mo', D1:'6mo' };
    const interval    = intervalMap[tf] || '5m';
    const range       = rangeMap[tf]    || '5d';
    const yahooSym    = 'GC%3DF'; // Gold Futures

    try {
      const r = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSym}?interval=${interval}&range=${range}&includePrePost=false`,
        { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }
      );
      if (!r.ok) throw new Error(`Yahoo ${r.status}`);
      const json   = await r.json();
      const result = json?.chart?.result?.[0];
      const ts     = result?.timestamp || [];
      const q      = result?.indicators?.quote?.[0] || {};
      if (!ts.length) throw new Error('No data from Yahoo');

      const candles = ts.map((t,i) => ({
        t:  t * 1000,
        o:  parseFloat((q.open?.[i]  || 0).toFixed(3)),
        h:  parseFloat((q.high?.[i]  || 0).toFixed(3)),
        l:  parseFloat((q.low?.[i]   || 0).toFixed(3)),
        cl: parseFloat((q.close?.[i] || 0).toFixed(3)),
        v:  parseInt(q.volume?.[i]   || 0)
      })).filter(c => 
        c.o > 0 && c.cl > 0 && c.h > 0 && c.l > 0 &&
        c.h >= c.l && c.h >= c.o && c.h >= c.cl &&
        c.l <= c.o && c.l <= c.cl &&
        !isNaN(c.o) && !isNaN(c.cl)
      )
      .sort((a,b) => a.t - b.t); // ترتيب زمني مضمون

      return res.status(200).json({ candles, symbol, tf, count: candles.length, source: 'yahoo-finance', ts: Date.now() });
    } catch(e) {
      return res.status(500).json({ error: e.message, candles: [] });
    }
  }

  return res.status(400).json({ error: 'type must be price or candles' });
}
