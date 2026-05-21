// api/telegram.js — Send messages to Telegram

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  if (!TOKEN || !CHAT_ID) return res.status(500).json({ error: 'Missing Telegram credentials' });

  const { message, type, data } = req.body;
  let text = message || '';

  if (type === 'signal' && data) {
    const emoji = data.direction === 'BUY' ? '🟢' : data.direction === 'SELL' ? '🔴' : '🟡';
    text = `${emoji} *إشارة XAU/USD — الذهب*

💰 السعر: \`$${data.price}\`
📊 الإشارة: *${data.direction}*
🎯 الثقة: ${data.confidence}%

📌 *مستويات الصفقة:*
• دخول: \`${data.entry}\`
• وقف: \`${data.sl}\`
• هدف 1: \`${data.tp1}\`
• هدف 2: \`${data.tp2}\`
• R:R: ${data.rr}

🏫 *تقاطع المدارس:*
• ICT/SMC: ${data.ict||'---'}
• Wyckoff: ${data.wyckoff||'---'}
• Elliott: ${data.elliott||'---'}

🌐 الجلسة: ${data.session||'---'}
⏱ ${new Date().toUTCString()}
_🥇 Gold AI Bot_`;
  }

  else if (type === 'ai_analysis' && data) {
    const full  = `🤖 *تحليل AI — XAU/USD الذهب*\nالمصدر: ${data.model==='gpt-4o'?'GPT-4o':'Claude Sonnet'}\n\n${data.analysis}\n\n⏱ ${new Date().toUTCString()}\n_🥇 Gold AI Bot_`;
    const chunks = [];
    for (let i=0; i<full.length; i+=3800) chunks.push(full.substring(i,i+3800));
    try {
      for (const chunk of chunks) {
        await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: CHAT_ID, text: chunk, parse_mode: 'Markdown' })
        });
      }
      return res.status(200).json({ ok: true, chunks: chunks.length });
    } catch(e) { return res.status(500).json({ error: e.message }); }
  }

  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'Markdown' })
    });
    const d = await r.json();
    if (!d.ok) throw new Error(d.description);
    return res.status(200).json({ ok: true, message_id: d.result?.message_id });
  } catch(e) { return res.status(500).json({ error: e.message }); }
}
