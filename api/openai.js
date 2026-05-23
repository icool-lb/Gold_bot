// api/openai.js — GPT-4o Analysis for XAU/USD Gold
// Top-Down + ATR + Real Levels + Geopolitical

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  res.setHeader('Access-Control-Allow-Origin', '*');

  const {
    price, bid, ask, spread, session, dxy, gsr,
    rsi, macd, ema50, ema200, atr,
    highH1, lowH1, highH4, lowH4, highD1, lowD1,
    trend, lesson_mode, prompt_override
  } = req.body;

  // ── وضع الدرس للـ AI Learning ────────────────────────────
  if (lesson_mode && prompt_override) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: 'gpt-4o', max_tokens: 200, temperature: 0.3,
          messages: [{ role: 'user', content: prompt_override }]
        })
      });
      const d = await r.json();
      return res.status(200).json({ analysis: d.choices?.[0]?.message?.content || '', model: 'gpt-4o-lesson' });
    } catch(e) { return res.status(500).json({ error: e.message }); }
  }

  const atrVal  = parseFloat(atr || 25);
  const slDist  = (atrVal * 0.5).toFixed(2);
  const tp1Dist = (atrVal * 0.8).toFixed(2);
  const tp2Dist = (atrVal * 1.5).toFixed(2);

  const prompt = `You are an expert XAU/USD gold trading analyst with 20 years experience. Respond in Arabic.

═══ Live MT5 Data ═══
Price: $${price} | Bid: ${bid} | Ask: ${ask} | Spread: ${spread}
Session: ${session} | DXY: ${dxy} | Gold/Silver Ratio: ${gsr}

═══ Top-Down Analysis ═══
D1 — High: ${highD1||'---'} | Low: ${lowD1||'---'} | EMA200: ${ema200||'---'}
H4 — High: ${highH4||'---'} | Low: ${lowH4||'---'} | MACD: ${macd||'---'}
H1 — High: ${highH1||'---'} | Low: ${lowH1||'---'} | EMA50: ${ema50||'---'}
Trend: ${trend}

═══ Technical Indicators ═══
RSI(14): ${rsi} | MACD: ${macd} | EMA50: ${ema50} | EMA200: ${ema200}
ATR(14): ${atrVal} → SL: ${slDist} | TP1: ${tp1Dist} | TP2: ${tp2Dist}

Provide in Arabic:
1. **D1 Main Trend** — above/below EMA200? Bullish/Bearish/Neutral
2. **H4 Confirmation** — aligned with D1? If not → WAIT
3. **Entry Zone** — real support (BUY) or resistance (SELL)? No random entries
4. **Multi-school consensus** (ICT/Wyckoff/Elliott/S&D/PA) — one final signal
5. **Geopolitical factors** affecting gold now (safe haven demand)
6. **Central bank buying** impact on gold trend
7. **DXY & Fed impact** on gold
8. **Final recommendation**: BUY/SELL/WAIT + confidence %
   ⚠️ Warning if signal is against D1 trend
9. **Precise levels from ATR + real levels**:
   - Entry: $___
   - Stop Loss: $___ (min $${slDist})
   - TP1: $___ (nearest real S/R)
   - TP2: $___
   - R:R: 1:___ (must be ≥ 1.5)

Arabic, professional, max 350 words.`;

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o', max_tokens: 1000, temperature: 0.3,
        messages: [
          { role: 'system', content: 'أنت محلل خبير في الذهب XAU/USD متخصص في Top-Down Analysis والعوامل الجيوسياسية.' },
          { role: 'user', content: prompt }
        ]
      })
    });
    if (!r.ok) throw new Error(`OpenAI ${r.status}`);
    const d = await r.json();
    return res.status(200).json({ analysis: d.choices?.[0]?.message?.content || '', model: 'gpt-4o' });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
