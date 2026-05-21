// api/openai.js — GPT-4o Analysis for XAU/USD

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { price, bid, ask, spread, rsi, macd, ema50, ema200, session, dxy, gsr, trend } = req.body;

  const prompt = `You are an expert XAU/USD gold trading analyst. Respond in Arabic.

Live MT5 Data:
- Price: $${price} | Bid: ${bid} | Ask: ${ask} | Spread: ${spread}
- Session: ${session} | RSI: ${rsi} | MACD: ${macd}
- EMA50: ${ema50} | EMA200: ${ema200}
- DXY: ${dxy} | Gold/Silver Ratio: ${gsr}
- Trend: ${trend}

Provide in Arabic:
1. Multi-school consensus (ICT, Wyckoff, Elliott, S/D, PA) → one final signal
2. Geopolitical factors affecting gold now (safe haven demand, wars, tensions)
3. Central bank buying trends and institutional demand
4. DXY & Fed impact on gold
5. Final recommendation: BUY/SELL/WAIT with confidence %
6. Best session to trade
7. Precise levels: Entry, SL, TP1, TP2, R:R

Arabic, professional, max 350 words.`;

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o', max_tokens: 1000, temperature: 0.3,
        messages: [
          { role: 'system', content: 'أنت محلل ذهب خبير XAU/USD.' },
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
