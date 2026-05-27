// api/analyze.js — Enhanced Claude AI with Top-Down + ATR + Real Levels

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  res.setHeader('Access-Control-Allow-Origin', '*');

  const {
    price, bid, ask, spread, session, dxy, gsr, trend, symbol,
    rsi, macd, ema50, ema200, atr,
    highH1, lowH1, highH4, lowH4, highD1, lowD1,
    lesson_mode, prompt_override, lesson_prompt, max_tokens: reqMaxTokens
  } = req.body;

  const sym    = symbol || 'XAUUSD';
  const isGold = sym === 'XAUUSD';
  const name   = isGold ? 'الذهب XAU/USD' : 'الفضة XAG/USD';

  // ── وضع الدرس للـ AI Learning ────────────────────────────
  const lessonText = lesson_prompt || prompt_override;
  if (lesson_mode && lessonText) {
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
          max_tokens: 200,
          messages: [{ role: 'user', content: lessonText }]
        })
      });
      const d = await r.json();
      return res.status(200).json({
        analysis: d.content?.map(b => b.text || '').join('') || '',
        model: 'claude-lesson'
      });
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── حساب SL/TP من ATR ─────────────────────────────────────
  const atrVal  = parseFloat(atr || (isGold ? 25 : 0.4));
  const slDist  = (atrVal * 0.5).toFixed(isGold ? 2 : 3);
  const tp1Dist = (atrVal * 0.8).toFixed(isGold ? 2 : 3);
  const tp2Dist = (atrVal * 1.5).toFixed(isGold ? 2 : 3);

  const prompt = `أنت محلل خبير في ${name} مع خبرة 20 سنة في التداول.

═══ البيانات اللحظية من MT5 ═══
السعر: $${price} | Bid: ${bid} | Ask: ${ask} | Spread: ${spread}
الجلسة: ${session} | DXY: ${dxy} | GSR: ${gsr}

═══ Top-Down Analysis (من الأكبر للأصغر) ═══
📅 D1  — High: ${highD1||'---'} | Low: ${lowD1||'---'} | EMA200: ${ema200||'---'}
📊 H4  — High: ${highH4||'---'} | Low: ${lowH4||'---'} | MACD: ${macd||'---'}
⏱ H1  — High: ${highH1||'---'} | Low: ${lowH1||'---'} | EMA50: ${ema50||'---'}
الاتجاه الحالي: ${trend}

═══ المؤشرات الفنية ═══
RSI(14): ${rsi} | MACD: ${macd}
EMA50: ${ema50} | EMA200: ${ema200}
ATR(14): ${atrVal} → SL مقترح: ${slDist} | TP1: ${tp1Dist} | TP2: ${tp2Dist}

قدم تحليلاً شاملاً:

**1. الاتجاه الرئيسي D1** ← أهم شيء
- هل السعر فوق أم تحت EMA200 على D1؟
- الاتجاه: صاعد / هابط / محايد

**2. تأكيد H4**
- هل يتوافق مع D1؟ إذا لا → انتظر

**3. منطقة الدخول الحقيقية**
- هل السعر في منطقة دعم حقيقية؟ (للشراء)
- هل السعر في منطقة مقاومة حقيقية؟ (للبيع)
- لا دخول عشوائي في وسط النطاق

**4. تقاطع المدارس** (ICT/Wyckoff/Elliott/S&D/PA)
- إجماع واحد نهائي فقط

**5. التوصية النهائية**
- BUY / SELL / WAIT مع نسبة الثقة %
- ⚠️ تحذير واضح إذا كانت الإشارة ضد D1

**6. المستويات الدقيقة (من ATR والمستويات الحقيقية)**
- دخول: $___
- وقف خسارة: $___ (لا يقل عن ${slDist})
- هدف 1: $___ (عند أقرب مقاومة/دعم حقيقي)
- هدف 2: $___
- R:R: 1:___  ← يجب لا يقل عن 1:1.5

اكتب بالعربية، احترافي ومختصر، أقل من 380 كلمة.`;

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
    if (!r.ok) throw new Error(`Claude ${r.status}`);
    const d = await r.json();
    return res.status(200).json({
      analysis: d.content?.map(b => b.text || '').join('') || '',
      model: 'claude-sonnet-4'
    });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
