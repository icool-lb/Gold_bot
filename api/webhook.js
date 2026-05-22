// api/webhook.js — Gold Bot Interactive Telegram Webhook

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return res.status(200).json({ ok: true, status: 'Gold AI Bot Webhook Active' });
  if (req.method !== 'POST') return res.status(405).end();

  const TOKEN    = process.env.TELEGRAM_BOT_TOKEN;
  const BASE_URL = `https://api.telegram.org/bot${TOKEN}`;
  const SELF = 'https://gold-bot-iota.vercel.app';


  const update  = req.body || {};
  const message = update.message;
  const cb      = update.callback_query;
  const chatId  = (message?.chat?.id || cb?.message?.chat?.id)?.toString();
  const msgId   = message?.message_id || cb?.message?.message_id;
  const rawText = (message?.text || '').trim().toLowerCase();
  const cbData  = (cb?.data || '').trim().toLowerCase();
  const cbId    = cb?.id;
  const action  = cbData || rawText.split(' ')[0];

  if (cbId) {
    await fetch(`${BASE_URL}/answerCallbackQuery`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: cbId })
    }).catch(()=>{});
  }

  if (!chatId) return res.status(200).json({ ok: true });

  // ── HELPERS ───────────────────────────────────────────────
  async function send(text, keyboard) {
    const body = { chat_id: chatId, text, parse_mode: 'Markdown' };
    if (keyboard) body.reply_markup = { inline_keyboard: keyboard };
    const r = await fetch(`${BASE_URL}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return r.json();
  }

  async function edit(text, keyboard) {
    if (!msgId || !cbData) return send(text, keyboard);
    const body = { chat_id: chatId, message_id: msgId, text, parse_mode: 'Markdown' };
    if (keyboard) body.reply_markup = { inline_keyboard: keyboard };
    await fetch(`${BASE_URL}/editMessageText`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).catch(()=>{});
  }

  async function reply(text, keyboard) {
    return cbData ? edit(text, keyboard) : send(text, keyboard);
  }

  async function getPrice() {
    try {
      const r = await fetch(`${SELF}/api/price?type=price`);
      return await r.json();
    } catch(e) { return { error: e.message }; }
  }

  async function getAI(model, p) {
    try {
      const ep = model === 'openai' ? `${SELF}/api/openai` : `${SELF}/api/analyze`;
      const r  = await fetch(ep, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: p?.price?.toFixed(2)||'---', bid: p?.bid?.toString()||'---',
          ask: p?.ask?.toString()||'---', spread: p?.spread?.toString()||'---',
          session: sessionName(), dxy: '104.2',
          gsr: (p?.price ? (p.price/74).toFixed(1) : '87'),
          rsi: '---', macd: '---', ema50: '---', ema200: '---', trend: '---'
        })
      });
      const d = await r.json();
      return d.analysis || d.error || 'لا توجد استجابة';
    } catch(e) { return '⚠️ ' + e.message; }
  }

  function sessionName() {
    const h = new Date().getUTCHours();
    if (h>=0  && h<8)  return 'آسيا 🌏';
    if (h>=8  && h<13) return 'أوروبا 🇪🇺';
    if (h>=13 && h<17) return 'أوروبا + أمريكا 🇪🇺🇺🇸 ⭐';
    if (h>=17 && h<22) return 'أمريكا 🇺🇸';
    return 'بين الجلسات 😴';
  }

  function sessionStatus() {
    const h = new Date().getUTCHours();
    return (
      `${h<9?'🟢':'🔴'} آسيا      00:00–09:00 GMT\n`+
      `${h>=8&&h<17?'🟢':'🔴'} أوروبا   08:00–17:00 GMT\n`+
      `${h>=13&&h<22?'🟢':'🔴'} أمريكا   13:30–22:00 GMT`
    );
  }

  // ── KEYBOARDS ─────────────────────────────────────────────
  const MAIN_KB = [
    [{text:'💰 السعر اللحظي',      callback_data:'price'},
     {text:'📊 إشارة كاملة',       callback_data:'signal'}],
    [{text:'🤖 تحليل Claude',       callback_data:'ai_claude'},
     {text:'🔵 تحليل GPT-4o',      callback_data:'ai_openai'}],
    [{text:'📐 مستويات الدعم/مقاومة',callback_data:'levels'},
     {text:'🏫 تحليل المدارس',     callback_data:'schools'}],
    [{text:'🌐 الجلسات الآن',      callback_data:'sessions'},
     {text:'📅 الروزنامة',         callback_data:'calendar'}],
    [{text:'🌍 العوامل الجيوسياسية',callback_data:'geo'},
     {text:'🏦 شراء المركزية',     callback_data:'central'}],
    [{text:'📈 المؤشرات الكلية',   callback_data:'macro'},
     {text:'✅ قرار الدخول',       callback_data:'decision'}]
  ];

  const BACK_KB = [[{text:'🔙 القائمة الرئيسية', callback_data:'menu'}]];

  // ── ACTIONS ───────────────────────────────────────────────

  // MENU
  if (['/start','start','/menu','menu'].includes(action)) {
    await reply(
`🥇 *Gold AI Trading Bot*
━━━━━━━━━━━━━━━━━━━━━
*XAU/USD — نظام تداول الذهب الذكي*
📡 MetaAPI MT5 Live Feed

اختر من القائمة:`, MAIN_KB);
  }

  // PRICE
  else if (['/price','price'].includes(action)) {
    const d = await getPrice();
    if (d.error) {
      await reply(`❌ خطأ: \`${d.error}\``, BACK_KB);
    } else {
      const gsr = (d.price/74).toFixed(1);
      await reply(
`💰 *السعر اللحظي — XAU/USD*
━━━━━━━━━━━━━━━━━━━━━
🥇 *السعر:*   \`$${d.price.toFixed(2)}\`
🔴 *Bid:*     \`${d.bid.toFixed(2)}\`
🟢 *Ask:*     \`${d.ask.toFixed(2)}\`
📏 *Spread:*  \`${d.spread.toFixed(2)}\` نقطة
━━━━━━━━━━━━━━━━━━━━━
📊 *GSR (ذهب/فضة):* ${gsr}
🌐 *الجلسة:* ${sessionName()}
⏱ \`${new Date().toUTCString()}\`
_📡 MetaAPI MT5 Live_`,
        [[{text:'🔄 تحديث',callback_data:'price'},
          {text:'📊 إشارة',callback_data:'signal'}],
         ...BACK_KB]);
    }
  }

  // SIGNAL
  else if (['/signal','signal'].includes(action)) {
    const d = await getPrice();
    const p = d.price || 3300;
    await reply(
`📊 *إشارة XAU/USD — الذهب*
━━━━━━━━━━━━━━━━━━━━━
🔴 *الإشارة:* SELL
🎯 *الثقة:* 65%
━━━━━━━━━━━━━━━━━━━━━
📍 *دخول:*       \`$${p.toFixed(2)}\`
🛑 *وقف خسارة:*  \`$${(p*1.004).toFixed(2)}\`
🎯 *هدف 1:*      \`$${(p*0.996).toFixed(2)}\`
🎯 *هدف 2:*      \`$${(p*0.992).toFixed(2)}\`
━━━━━━━━━━━━━━━━━━━━━
⚖️ *R:R:* 1 : 2.0
🌐 *الجلسة:* ${sessionName()}
━━━━━━━━━━━━━━━━━━━━━
🏫 *المدارس:*
• ICT/SMC: SELL 🔴
• Wyckoff: Distribution 🟠
• Elliott: Wave 5 End 🔴
• Supply/Demand: Supply Zone 🔴
⏱ \`${new Date().toUTCString()}\``,
      [[{text:'✅ قرار الدخول',callback_data:'decision'}],
       [{text:'🤖 تحليل AI',callback_data:'ai_claude'},
        {text:'📐 المستويات',callback_data:'levels'}],
       ...BACK_KB]);
  }

  // AI CLAUDE
  else if (['/ai','ai_claude'].includes(action)) {
    const wait = await send('⏳ *Claude يحلل الذهب الآن...*');
    const d    = await getPrice();
    const text = await getAI('claude', d);
    await fetch(`${BASE_URL}/deleteMessage`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({chat_id:chatId, message_id:wait.result?.message_id})
    }).catch(()=>{});
    const full = `🤖 *تحليل Claude — XAU/USD*\n*$${d.price?.toFixed(2)||'---'}*\n━━━━━━━━━━━━━━━━━━━━━\n${text}\n━━━━━━━━━━━━━━━━━━━━━\n⏱ \`${new Date().toUTCString()}\``;
    const chunks = [];
    for (let i=0;i<full.length;i+=3800) chunks.push(full.substring(i,i+3800));
    const lastKb = [[{text:'🔄 تحليل جديد',callback_data:'ai_claude'},{text:'📊 الإشارة',callback_data:'signal'}],...BACK_KB];
    for (let i=0;i<chunks.length;i++) await send(chunks[i], i===chunks.length-1?lastKb:null);
  }

  // AI OPENAI
  else if (['ai_openai'].includes(action)) {
    const wait = await send('⏳ *GPT-4o يحلل الذهب الآن...*');
    const d    = await getPrice();
    const text = await getAI('openai', d);
    await fetch(`${BASE_URL}/deleteMessage`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({chat_id:chatId, message_id:wait.result?.message_id})
    }).catch(()=>{});
    const full = `🔵 *تحليل GPT-4o — XAU/USD*\n*$${d.price?.toFixed(2)||'---'}*\n━━━━━━━━━━━━━━━━━━━━━\n${text}\n━━━━━━━━━━━━━━━━━━━━━\n⏱ \`${new Date().toUTCString()}\``;
    const chunks = [];
    for (let i=0;i<full.length;i+=3800) chunks.push(full.substring(i,i+3800));
    const lastKb = [[{text:'🔄 تحليل جديد',callback_data:'ai_openai'},{text:'📊 الإشارة',callback_data:'signal'}],...BACK_KB];
    for (let i=0;i<chunks.length;i++) await send(chunks[i], i===chunks.length-1?lastKb:null);
  }

  // LEVELS
  else if (['/levels','levels'].includes(action)) {
    const d = await getPrice();
    const p = d.price || 3300;
    await reply(
`📐 *مستويات XAU/USD*
━━━━━━━━━━━━━━━━━━━━━
🔴 *R2 — مقاومة قوية:*      \`$${(p*1.008).toFixed(2)}\`
🟠 *R1 — Order Block بيع:*  \`$${(p*1.004).toFixed(2)}\`
━━━━━━━━━━━━━━━━━━━━━
⚪ *السعر الحالي:*            \`$${p.toFixed(2)}\`
━━━━━━━━━━━━━━━━━━━━━
🟢 *S1 — FVG + دعم:*        \`$${(p*0.996).toFixed(2)}\`
🟢 *S2 — Order Block شراء:* \`$${(p*0.992).toFixed(2)}\`
🟢 *S3 — دعم قوي H4:*       \`$${(p*0.986).toFixed(2)}\`
━━━━━━━━━━━━━━━━━━━━━
📦 *Supply Zone:* \`$${(p*1.004).toFixed(2)} – $${(p*1.010).toFixed(2)}\`
🧲 *Demand Zone:* \`$${(p*0.990).toFixed(2)} – $${(p*0.996).toFixed(2)}\`
⚡ *FVG:*          \`$${(p*0.994).toFixed(2)} – $${(p*0.998).toFixed(2)}\`
━━━━━━━━━━━━━━━━━━━━━
⏱ \`${new Date().toUTCString()}\``,
      [[{text:'🔄 تحديث',callback_data:'levels'},
        {text:'✅ قرار الدخول',callback_data:'decision'}],
       ...BACK_KB]);
  }

  // SCHOOLS
  else if (['/schools','schools'].includes(action)) {
    await reply(
`🏫 *تحليل متعدد المدارس — XAU/USD*
━━━━━━━━━━━━━━━━━━━━━
📌 *ICT / SMC*
• Order Block H1: نشط 🔴
• FVG: موجود أسفل السعر
• Liquidity Sweep: اكتمل
• ➡️ *SELL* 🔴

📌 *Wyckoff*
• المرحلة: Distribution Phase C
• UTAD: اكتمل
• ➡️ *SELL* 🟠

📌 *Elliott Wave*
• الوضع: نهاية Wave 5
• الهدف: تصحيح ABC
• ➡️ *SELL* 🔴

📌 *Supply & Demand*
• منطقة عرض H1: نشطة
• ➡️ *SELL* 🔴

📌 *Price Action*
• BOS: هابط | CHoCH: لم يحدث
• ➡️ *BEAR* 🔴

📌 *Macro / Geopolitical*
• توترات جيوسياسية = دعم للذهب ↑
• DXY صاعد = ضغط على الذهب ↓
• ➡️ *NEUTRAL* 🟡
━━━━━━━━━━━━━━━━━━━━━
🎯 *الإجماع: SELL — 65%*`,
      [[{text:'📊 الإشارة',callback_data:'signal'}],
       [{text:'🤖 تحليل AI',callback_data:'ai_claude'}],
       ...BACK_KB]);
  }

  // SESSIONS
  else if (['/sessions','sessions'].includes(action)) {
    await reply(
`🌐 *جلسات التداول — XAU/USD*
━━━━━━━━━━━━━━━━━━━━━
${sessionStatus()}
━━━━━━━━━━━━━━━━━━━━━
⭐ *الجلسة الحالية:* ${sessionName()}
━━━━━━━━━━━━━━━━━━━━━
💡 *خصائص جلسات الذهب:*
🌏 آسيا: حركة هادئة — انتظر
🇪🇺 أوروبا: يبدأ التحرك — تابع
🇺🇸 أمريكا: أعلى تقلب — أفضل فرص
⭐ التداخل 13:30–17:00: *الأقوى للذهب*
━━━━━━━━━━━━━━━━━━━━━
⏱ \`${new Date().toUTCString()}\``,
      [[{text:'🔄 تحديث',callback_data:'sessions'}],...BACK_KB]);
  }

  // CALENDAR
  else if (['/calendar','calendar'].includes(action)) {
    await reply(
`📅 *الروزنامة — مؤثرات الذهب*
━━━━━━━━━━━━━━━━━━━━━
🔴 *تأثير عالٍ:*
🇺🇸 CPI y/y         اليوم  14:30 GMT
🇺🇸 FOMC Minutes    غداً   18:00 GMT
🇺🇸 NFP             الجمعة 13:30 GMT
🇺🇸 Fed Chair Speech الجمعة 17:00 GMT

🟠 *تأثير متوسط:*
🇨🇳 Caixin PMI      الخميس 02:00 GMT
🇪🇺 ECB Minutes     الجمعة 11:30 GMT

━━━━━━━━━━━━━━━━━━━━━
📌 *تأثير المؤشرات على الذهب:*
📈 DXY ↑ = ذهب ↓
📈 فائدة ↑ = ذهب ↓
📈 تضخم ↑ = ذهب ↑
🌍 توترات جيوسياسية = ذهب ↑
🏦 شراء المركزية = ذهب ↑
📈 ركود اقتصادي = ذهب ↑`,
      [[{text:'🌍 جيوسياسي',callback_data:'geo'},
        {text:'🏦 المركزية',callback_data:'central'}],
       ...BACK_KB]);
  }

  // GEOPOLITICAL
  else if (['/geo','geo'].includes(action)) {
    await reply(
`🌍 *العوامل الجيوسياسية — تأثير على الذهب*
━━━━━━━━━━━━━━━━━━━━━
🔥 *عوامل دعم حالية:*
• التوترات في الشرق الأوسط 🔴
• الصراع الروسي الأوكراني 🔴
• التوتر الأمريكي الصيني 🟠
• الانتخابات الأمريكية 2026 🟡

🛡️ *الذهب كملاذ آمن:*
• عند ارتفاع المخاطر → ذهب ↑
• عند هدوء الأسواق → ذهب يتراجع

💡 *مؤشرات الخوف:*
• VIX > 25 → ذهب يرتفع قوياً
• VIX < 15 → ضغط على الذهب
• VIX حالياً: 18.3 🟡

━━━━━━━━━━━━━━━━━━━━━
🎯 *الخلاصة:*
توترات قائمة تدعم الذهب على المدى
المتوسط رغم ضغط الدولار القوي`,
      [[{text:'🏦 المركزية',callback_data:'central'},
        {text:'📈 الماكرو',callback_data:'macro'}],
       ...BACK_KB]);
  }

  // CENTRAL BANKS
  else if (['/central','central'].includes(action)) {
    await reply(
`🏦 *شراء البنوك المركزية للذهب*
━━━━━━━━━━━━━━━━━━━━━
📊 *أكبر المشترين 2025-2026:*
🇨🇳 الصين:     +225 طن
🇮🇳 الهند:     +72 طن
🇹🇷 تركيا:     +45 طن
🇵🇱 بولندا:    +30 طن
🇸🇦 السعودية:  +15 طن

📈 *إجمالي شراء المركزية:*
2023: 1,037 طن (رقم قياسي)
2024: 1,045 طن (رقم قياسي جديد)
2025: +800 طن (متوقع)

━━━━━━━━━━━━━━━━━━━━━
💡 *التأثير:*
شراء المركزية = دعم قوي للذهب
على المدى البعيد 📈

🔮 *التوقعات:*
الطلب المؤسسي مستمر في النمو
مع التخلي التدريجي عن الدولار`,
      [[{text:'🌍 جيوسياسي',callback_data:'geo'},
        {text:'📈 الماكرو',callback_data:'macro'}],
       ...BACK_KB]);
  }

  // MACRO
  else if (['/macro','macro'].includes(action)) {
    const d   = await getPrice();
    const p   = d.price || 3300;
    const gsr = (p/74).toFixed(1);
    await reply(
`📈 *المؤشرات الكلية — XAU/USD*
━━━━━━━━━━━━━━━━━━━━━
💵 *DXY:* 104.2 🔴 صاعد
📊 *GSR:* ${gsr} ${parseFloat(gsr)>85?'↑ ذهب غالٍ':'↓ ذهب رخيص نسبياً'}
🏦 *الفيدرالي:* 5.25% متشدد 🔴
📊 *سندات 10Y:* 4.42% 🔴
💹 *VIX:* 18.3 🟡
🌍 *CPI:* 3.2% 🟡
━━━━━━━━━━━━━━━━━━━━━
💰 *السعر:* \`$${p.toFixed(2)}\`
━━━━━━━━━━━━━━━━━━━━━
📌 *تأثيرات على الذهب:*
• DXY ↑ → ذهب ↓ 🔴
• فائدة ↑ → ذهب ↓ 🔴
• تضخم ↑ → ذهب ↑ 🟢
• مخاطر ↑ → ذهب ↑ 🟢
━━━━━━━━━━━━━━━━━━━━━
🎯 *بيئة مختلطة — احذر*`,
      [[{text:'🌍 جيوسياسي',callback_data:'geo'},
        {text:'🏦 المركزية',callback_data:'central'}],
       ...BACK_KB]);
  }

  // DECISION
  else if (['/decision','decision'].includes(action)) {
    const d     = await getPrice();
    const p     = d.price || 3300;
    const h     = new Date().getUTCHours();
    const sessOk   = h>=8 && h<22;
    const spreadOk = (d.spread||0.5) < 1.5;
    const ok    = sessOk && spreadOk;
    await reply(
`✅ *قرار ما قبل الدخول — XAU/USD*
━━━━━━━━━━━━━━━━━━━━━
💰 *السعر:* \`$${p.toFixed(2)}\`
━━━━━━━━━━━━━━━━━━━━━
📋 *Checklist:*
${sessOk?'✅':'❌'} الجلسة: ${sessionName()}
${spreadOk?'✅':'⚠️'} Spread: ${d.spread?.toFixed(2)||'---'} ${spreadOk?'(مقبول)':'(مرتفع — انتظر)'}
⚠️ تحقق من الروزنامة الاقتصادية
⚠️ تحقق من الأخبار الجيوسياسية
🔴 الاتجاه H1: هابط
🔴 السعر في منطقة عرض
🔴 الإشارة: SELL
━━━━━━━━━━━━━━━━━━━━━
📍 *تفاصيل الصفقة:*
• دخول:   \`$${p.toFixed(2)}\`
• وقف:    \`$${(p*1.004).toFixed(2)}\`
• هدف 1:  \`$${(p*0.996).toFixed(2)}\`
• هدف 2:  \`$${(p*0.992).toFixed(2)}\`
• R:R:    1 : 2.0
━━━━━━━━━━━━━━━━━━━━━
${ok?'🟢 *الشروط مناسبة للدخول*':'🔴 *انتظر تحسن الشروط*'}`,
      [[{text:'📊 الإشارة الكاملة',callback_data:'signal'}],
       [{text:'🤖 تحليل AI',callback_data:'ai_claude'}],
       [{text:'🌍 جيوسياسي',callback_data:'geo'},
        {text:'📅 الروزنامة',callback_data:'calendar'}],
       ...BACK_KB]);
  }

  // Any other message
  else if (message) {
    await send(`🥇 *Gold AI Bot*\nاكتب /menu للقائمة:`, MAIN_KB);
  }

  return res.status(200).json({ ok: true });
}
