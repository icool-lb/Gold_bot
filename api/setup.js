// api/setup.js — تفعيل Telegram Webhook

export default async function handler(req, res) {
  const TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
  const APP_URL = 'https://gold-bot.vercel.app';
  if (!TOKEN) return res.status(500).json({ error: 'Missing TELEGRAM_BOT_TOKEN' });
  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `${APP_URL}/api/webhook`,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true
      })
    });
    const d = await r.json();
    if (d.ok && process.env.TELEGRAM_CHAT_ID) {
      await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: `✅ *Gold AI Bot v3 مفعّل!*\n\nاكتب /menu للبدء 🥇\nTop-Down + ATR + نظام صفقات`,
          parse_mode: 'Markdown'
        })
      });
    }
    return res.status(200).json({ ok: d.ok, webhook: `${APP_URL}/api/webhook`, telegram: d });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
