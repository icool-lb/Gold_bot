// api/price.js — XAU/USD Price + Candles
// MetaAPI primary → Yahoo Finance fallback

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

  const META_BASE = TOKEN && ACCOUNT
    ? `https://mt-client-api-v1.london.agiliumtrade.ai/users/current/accounts/${ACCOUNT}`
    : null;
  const META_H = { 'auth-token': TOKEN || '', 'Content-Type': 'application/json' };

  // ══ 1. السعر اللحظي ══════════════════════════════════════
  if (type === 'price') {

    // أولاً: MetaAPI
    if (META_BASE) {
      try {
        const r = await fetch(`${META_BASE}/symbols/${symReq}/current-price`, { headers: META_H });
        if (r.ok) {
          const d   = await r.json();
          const bid = parseFloat(d.bid || 0);
          const ask = parseFloat(d.ask || 0);
          if (bid > 0 && ask > 0) {
            return res.status(200).json({
              price:  parseFloat(((bid+ask)/2).toFixed(4)),
              bid:    parseFloat(bid.toFixed(4)),
              ask:    parseFloat(ask.toFixed(4)),
              spread: parseFloat((ask-bid).toFixed(4)),
              symbol: symReq,
              source: 'metaapi',
              ts:     Date.now()
            });
          }
        }
      } catch(e) { /* fallthrough */ }
    }

    // ثانياً: Yahoo Finance كـ fallback للسعر
    try {
      const yMap = { XAUUSD:'GC%3DF', XAGUSD:'SI%3DF' };
      const ySym = yMap[symReq] || 'GC%3DF';
      const yr   = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${ySym}?interval=1m&range=1d`,
        { headers: { 'User-Agent':'Mozilla/5.0','Accept':'application/json' } }
      );
      if (!yr.ok) throw new Error('Yahoo price ' + yr.status);
      const yj  = await yr.json();
      const res0 = yj && yj.chart && yj.chart.result && yj.chart.result[0];
      const meta = res0 && res0.meta;
      if (meta && meta.regularMarketPrice) {
        const p = parseFloat(meta.regularMarketPrice);
        return res.status(200).json({
          price:  p,
          bid:    parseFloat((p - 0.1).toFixed(2)),
          ask:    parseFloat((p + 0.1).toFixed(2)),
          spread: 0.2,
          symbol: symReq,
          source: 'yahoo-price',
          ts:     Date.now()
        });
      }
    } catch(e) { /* fallthrough */ }

    return res.status(500).json({ error: 'Cannot fetch price', price: null });
  }

  // ══ 2. الشمعات ════════════════════════════════════════════
  if (type === 'candles') {
    const tfMap = { M1:'1m',M5:'5m',M15:'15m',M30:'30m',H1:'1h',H4:'4h',D1:'1d' };
    const intMap= { M5:'5m',M15:'15m',M30:'30m',H1:'1h',H4:'1h',D1:'1d' };
    const rngMap= { M5:'2d',M15:'2d',M30:'2d',H1:'5d',H4:'1mo',D1:'6mo' };

    // أولاً: MetaAPI candles
    if (META_BASE) {
      try {
        const metaTF = tfMap[tf] || '15m';
        const url    = `${META_BASE}/history/candles/${symReq}/${metaTF}?limit=${limit}`;
        const r      = await fetch(url, { headers: META_H });
        if (r.ok) {
          const data = await r.json();
          if (Array.isArray(data) && data.length > 0) {
            const candles = data
              .map(function(c) {
                return {
                  t:  new Date(c.time || c.brokerTime || 0).getTime(),
                  o:  parseFloat((c.open  || 0).toFixed(3)),
                  h:  parseFloat((c.high  || 0).toFixed(3)),
                  l:  parseFloat((c.low   || 0).toFixed(3)),
                  cl: parseFloat((c.close || 0).toFixed(3)),
                  v:  parseInt(c.tickVolume || c.volume || 1)
                };
              })
              .filter(function(c) {
                return c.o > 0 && c.cl > 0 && c.h > 0 && c.l > 0 && c.h >= c.l;
              })
              .sort(function(a,b){ return a.t - b.t; });

            if (candles.length > 0) {
              return res.status(200).json({
                candles, symbol:symReq, tf,
                count:candles.length, source:'metaapi', ts:Date.now()
              });
            }
          }
        }
      } catch(e) { /* fallthrough to Yahoo */ }
    }

    // ثانياً: Yahoo Finance
    try {
      const yMap2  = { XAUUSD:'GC%3DF', XAGUSD:'SI%3DF' };
      const ySym2  = yMap2[symReq] || 'GC%3DF';
      const itvl   = intMap[tf] || '15m';
      const range  = rngMap[tf] || '2d';

      const yr = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${ySym2}?interval=${itvl}&range=${range}&includePrePost=false`,
        { headers: { 'User-Agent':'Mozilla/5.0','Accept':'application/json' } }
      );
      if (!yr.ok) throw new Error('Yahoo candles ' + yr.status);

      const yj     = await yr.json();
      const result = yj && yj.chart && yj.chart.result && yj.chart.result[0];
      const tss    = (result && result.timestamp) || [];
      const q      = (result && result.indicators && result.indicators.quote && result.indicators.quote[0]) || {};

      if (!tss.length) throw new Error('No Yahoo candle data');

      const rawCandles = tss.map(function(t, i) {
        return {
          t:  t * 1000,
          o:  parseFloat(((q.open  && q.open[i])  || 0).toFixed(3)),
          h:  parseFloat(((q.high  && q.high[i])  || 0).toFixed(3)),
          l:  parseFloat(((q.low   && q.low[i])   || 0).toFixed(3)),
          cl: parseFloat(((q.close && q.close[i]) || 0).toFixed(3)),
          v:  parseInt((q.volume && q.volume[i]) || 1)
        };
      }).filter(function(c) {
        return c.o > 0 && c.cl > 0 && c.h > 0 && c.l > 0 &&
               c.h >= c.l && c.h >= c.o && c.h >= c.cl &&
               c.l <= c.o && c.l <= c.cl;
      }).sort(function(a,b){ return a.t - b.t; });

      // Median outlier filter
      var mids = rawCandles.map(function(c){ return (c.h+c.l)/2; }).slice().sort(function(a,b){return a-b;});
      var med  = mids[Math.floor(mids.length/2)] || 0;
      var maxD = med * 0.025;
      var candles = med > 0
        ? rawCandles.filter(function(c){ return Math.abs((c.h+c.l)/2-med) <= maxD; })
        : rawCandles;

      return res.status(200).json({
        candles: candles.slice(-limit),
        symbol:symReq, tf,
        count:candles.length, source:'yahoo', ts:Date.now()
      });

    } catch(e2) {
      return res.status(500).json({ error: e2.message, candles:[] });
    }
  }

  return res.status(400).json({ error: 'type must be price or candles' });
}
