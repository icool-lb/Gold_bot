// api/news.js — News Analysis with GPT-4o Web Search
// تحليل الأخبار اللحظية + GAP + اتجاه الافتتاح

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { price, session, gsr, nextOpen } = req.body;

  const now     = new Date();
  const dayName = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'][now.getUTCDay()];
  const timeStr = now.toUTCString();

  const prompt = `أنت محلل مالي خبير في الذهب XAU/USD. ابحث الآن عن آخر الأخبار المؤثرة على الذهب.

المعطيات الحالية:
- السعر الحالي: $${price}
- التاريخ والوقت: ${timeStr} (${dayName})
- الجلسة: ${session}
- نسبة الذهب/الفضة GSR: ${gsr}
- السوق: ${nextOpen}

ابحث عن:
1. أحدث الأخبار الجيوسياسية المؤثرة على الذهب (توترات، حروب، اتفاقيات)
2. آخر تصريحات الفيدرالي الأمريكي وأثرها
3. بيانات التضخم والاقتصاد الأمريكي الأخيرة
4. أخبار الدولار DXY
5. أي أحداث مفاجئة (صفقات سلام، توترات جديدة، قرارات OPEC)

بناءً على الأخبار الحالية، قدّم:

**📰 ملخص الأخبار المؤثرة:**
(أهم 3-4 أخبار مع تأثيرها المباشر على الذهب)

**📊 تحليل GAP الافتتاح:**
- هل متوقع GAP عند افتتاح السوق؟
- اتجاه GAP المتوقع: صاعد / هابط / محايد
- القيمة التقديرية للـ GAP: $___
- نسبة الاحتمالية: ___%

**🎯 توقعات الاتجاه:**
- الاتجاه المتوقع بعد الافتتاح: صاعد / هابط
- المستوى المستهدف: $___
- المستوى المهدد: $___

**⚠️ مخاطر يجب مراعاتها:**
(أي أحداث قادمة قد تغير الاتجاه)

اكتب بالعربية، احترافي ومختصر، لا تزيد عن 400 كلمة.`;

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-search-preview',
        max_tokens: 1200,
        web_search_options: { search_context_size: 'medium' },
        messages: [
          {
            role: 'system',
            content: 'أنت محلل ذهب خبير. ابحث دائماً عن أحدث الأخبار قبل تحليلك.'
          },
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!r.ok) {
      const err = await r.json();
      // fallback لـ gpt-4o عادي إذا search-preview غير متاح
      if (r.status === 404 || r.status === 400) {
        return await fallbackAnalysis(req, res, prompt, price, timeStr);
      }
      throw new Error(`OpenAI ${r.status}: ${JSON.stringify(err)}`);
    }

    const d    = await r.json();
    const text = d.choices?.[0]?.message?.content || '';

    return res.status(200).json({
      analysis: text,
      model:    'gpt-4o-search',
      ts:       Date.now()
    });

  } catch(e) {
    // Fallback بدون web search
    return await fallbackAnalysis(req, res, prompt, price, timeStr);
  }
}

async function fallbackAnalysis(req, res, prompt, price, timeStr) {
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 1200,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: `أنت محلل ذهب خبير. التاريخ الحالي: ${timeStr}. قدّم تحليلاً بناءً على معرفتك بالأسواق والعوامل الجيوسياسية الحالية.`
          },
          { role: 'user', content: prompt }
        ]
      })
    });
    const d    = await r.json();
    const text = d.choices?.[0]?.message?.content || '';
    return res.status(200).json({ analysis: text, model: 'gpt-4o', ts: Date.now() });
  } catch(e2) {
    return res.status(500).json({ error: e2.message });
  }
}
