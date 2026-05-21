// api/analyze.js — Claude AI Analysis for XAU/USD

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { price, bid, ask, spread, rsi, macd, ema50, ema200, session, dxy, gsr, trend } = req.body;

  const prompt = `أنت خبير محلل مالي متخصص في الذهب XAU/USD مع خبرة 20 سنة.

البيانات اللحظية من MT5:
- السعر: $${price}
- Bid: ${bid} | Ask: ${ask} | Spread: ${spread}
- الجلسة: ${session}
- RSI(14): ${rsi}
- MACD: ${macd}
- EMA50: ${ema50} | EMA200: ${ema200}
- DXY: ${dxy}
- GSR نسبة الذهب/الفضة: ${gsr}
- الاتجاه الحالي: ${trend}

قدم تحليلاً شاملاً يتضمن:
1. **تقاطع المدارس** (ICT/SMC، Wyckoff، Elliott Wave، Supply/Demand، Price Action) — توصية واحدة نهائية
2. **العوامل الجيوسياسية** وتأثيرها على الذهب الآن (توترات، حروب، ملاذ آمن)
3. **تأثير DXY والفيدرالي** على الذهب
4. **مستوى الطلب المركزي** (مصارف مركزية، صناديق، مستثمرون)
5. **التوصية النهائية**: شراء/بيع/انتظار مع نسبة الثقة
6. **أفضل جلسة** للدخول
7. **مستويات دقيقة**: دخول، وقف خسارة، هدف 1، هدف 2، R:R

اكتب بالعربية، احترافي ومختصر، لا تزيد عن 400 كلمة.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!r.ok) throw new Error(`Claude API ${r.status}`);
    const d = await r.json();
    return res.status(200).json({ analysis: d.content?.map(b=>b.text||'').join(''), model: 'claude-sonnet-4' });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
