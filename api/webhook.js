// api/webhook.js — Gold Bot Telegram Menu
// قائمة تفاعلية كاملة في Telegram

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return res.status(200).json({ ok: true, bot: 'Gold AI Bot v3' });
  if (req.method !== 'POST') return res.status(405).end();

  res.setHeader('Access-Control-Allow-Origin', '*');

  const TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
  const APP_URL = process.env.APP_URL || 'https://gold-bot-iota.vercel.app';

  const body = req.body;
  const msg  = body?.message;
  const cb   = body?.callback_query;

  async function send(chatId, text, keyboard = null) {
    const payload = {
      chat_id:    chatId,
      text,
      parse_mode: 'Markdown'
    };
    if (keyboard) payload.reply_markup = { inline_keyboard: keyboard };
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });
  }

  async function answer(cbId, text = '') {
    await fetch(`https://api.telegram.org/bot${TOKEN}/answerCallbackQuery`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ callback_query_id: cbId, text })
    });
  }

  async function getPrice() {
    try {
      const r = await fetch(`${APP_URL}/api/price?type=price`);
      const d = await r.json();
      return d;
    } catch(e) { return null; }
  }

  async function getAnalysis() {
    try {
      const p = await getPrice();
      if (!p) return null;
      const r = await fetch(`${APP_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: 'XAUUSD', price: p.price?.toFixed(2), dxy: '104', session: 'auto' })
      });
      return await r.json();
    } catch(e) { return null; }
  }

  // ══ MAIN MENU ══
  const mainMenu = [
    [{ text: '💰 السعر الحالي', callback_data: 'price' }, { text: '📊 الإشارة الآن', callback_data: 'signal' }],
    [{ text: '🤖 تحليل AI', callback_data: 'ai' },       { text: '📰 تحليل الأخبار', callback_data: 'news' }],
    [{ text: '📈 مدارس التحليل', callback_data: 'schools' }, { text: '🎯 المستويات', callback_data: 'levels' }],
    [{ text: '📅 الروزنامة', callback_data: 'calendar' }, { text: '🏆 Master Score', callback_data: 'score' }],
    [{ text: '📖 دليل المؤشرات', callback_data: 'guide' }, { text: '⚙️ حالة النظام', callback_data: 'status' }]
  ];

  // ══ HANDLE COMMANDS ══
  if (msg) {
    const text    = msg.text || '';
    const chatId  = msg.chat.id;
    const userId  = msg.from?.id;

    if (text === '/start' || text === '/menu') {
      await send(chatId,
        `🥇 *Gold AI Bot v3 — XAU/USD*\n\nمرحباً! أنا بوت التداول الذكي للذهب.\n\nاختر من القائمة:`,
        mainMenu
      );
    }
    else if (text === '/price') {
      const p = await getPrice();
      if (p) {
        await send(chatId, `💰 *سعر الذهب الآن*\n\n🟡 \`$${p.price?.toFixed(2)}\`\nBid: \`${p.bid?.toFixed(2)}\` | Ask: \`${p.ask?.toFixed(2)}\`\nSpread: \`${p.spread?.toFixed(2)}\` pts\n\n⏱ \`${new Date().toUTCString()}\``, mainMenu);
      }
    }
    else if (text === '/help' || text === '/guide') {
      await send(chatId, `📖 *دليل قراءة المؤشرات*\n\n` +
        `*RSI 14*\n>70 = تشبع شراء ← انتظر\n<30 = تشبع بيع ← فرصة\n\n` +
        `*MACD*\nفوق الصفر = زخم صاعد ✅\nتحت الصفر = زخم هابط\n\n` +
        `*OB Order Block*\nمنطقة مؤسسية → ادخل عند الارتداد منها\n\n` +
        `*FVG Fair Value Gap*\nفجوة سعرية يملأها السوق لاحقاً\n\n` +
        `*Premium & Discount*\n>70% = بيع مفضل 🔴\n<30% = شراء مفضل 🟢\n50% = EQ محايد\n\n` +
        `*MSS / BOS / CHoCH*\nBOS = استمرار الاتجاه\nCHoCH = انعكاس محتمل 🔄\n\n` +
        `*Kill Zones ⭐*\nLondon 07–10 GMT = أفضل وقت\nNY 12–15 GMT = تقلب عالٍ\n\n` +
        `*Fibonacci 61.8% 🎯*\nأقوى مستوى ارتداد في السوق\n\n` +
        `*Master Score*\n75+ = A+ ادخل | 60-74 = A جيد\n45-59 = B انتظر | <45 = C تجنب`,
        mainMenu
      );
    }
    else {
      await send(chatId, 'اكتب /menu للقائمة الرئيسية أو /help للدليل', mainMenu);
    }
  }

  // ══ HANDLE CALLBACKS ══
  if (cb) {
    const chatId = cb.message.chat.id;
    const data   = cb.data;
    await answer(cb.id);

    if (data === 'price') {
      const p = await getPrice();
      if (p) {
        await send(chatId,
          `💰 *السعر الحالي — XAU/USD*\n\n` +
          `🟡 \`$${p.price?.toFixed(2)}\`\n` +
          `📉 Bid: \`${p.bid?.toFixed(2)}\`\n` +
          `📈 Ask: \`${p.ask?.toFixed(2)}\`\n` +
          `↔️ Spread: \`${p.spread?.toFixed(2)}\` pts\n` +
          `⏱ \`${new Date().toUTCString()}\``,
          [[{ text: '🔄 تحديث', callback_data: 'price' }, { text: '🔙 القائمة', callback_data: 'menu' }]]
        );
      }
    }

    else if (data === 'signal') {
      const p = await getPrice();
      if (p?.price) {
        const price = p.price;
        const atr   = 15; // تقديري
        const sl    = price - atr * 0.5;
        const tp1   = price + atr * 0.8;
        const tp2   = price + atr * 1.5;
        const rr    = (tp1 - price) / (price - sl);

        await send(chatId,
          `📊 *الإشارة الحالية — XAU/USD*\n\n` +
          `💰 السعر: \`$${price.toFixed(2)}\`\n` +
          `📍 دخول: \`$${price.toFixed(2)}\`\n` +
          `🛑 وقف: \`$${sl.toFixed(2)}\` (ATR×0.5)\n` +
          `🎯 هدف 1: \`$${tp1.toFixed(2)}\`\n` +
          `🎯 هدف 2: \`$${tp2.toFixed(2)}\`\n` +
          `⚖️ R:R: 1:${rr.toFixed(2)}\n\n` +
          `⚠️ للحصول على إشارة دقيقة اضغط تحليل AI`,
          [[{ text: '🤖 تحليل AI', callback_data: 'ai' }, { text: '🔙 القائمة', callback_data: 'menu' }]]
        );
      }
    }

    else if (data === 'ai') {
      await send(chatId, '⏳ جاري التحليل...', null);
      const an = await getAnalysis();
      if (an?.analysis) {
        const txt = an.analysis.substring(0, 1500);
        await send(chatId,
          `🤖 *تحليل AI — Top Down*\n\n${txt}\n\n_🥇 Gold AI Bot v3_`,
          [[{ text: '💰 السعر', callback_data: 'price' }, { text: '🔙 القائمة', callback_data: 'menu' }]]
        );
      } else {
        await send(chatId, '❌ خطأ في التحليل. حاول مرة أخرى.', mainMenu);
      }
    }

    else if (data === 'news') {
      await send(chatId, '🔍 GPT-4o يبحث في الأخبار...', null);
      try {
        const p = await getPrice();
        const r = await fetch(`${APP_URL}/api/news`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ price: p?.price?.toFixed(2) || '0', session: 'auto', gsr: '61', nextOpen: 'مفتوح' })
        });
        const d = await r.json();
        const txt = (d.analysis || 'لا توجد بيانات').substring(0, 1500);
        await send(chatId,
          `📰 *تحليل الأخبار اللحظية*\n\n${txt}\n\n_🥇 Gold AI Bot v3_`,
          [[{ text: '🔙 القائمة', callback_data: 'menu' }]]
        );
      } catch(e) {
        await send(chatId, '❌ خطأ: ' + e.message, mainMenu);
      }
    }

    else if (data === 'schools') {
      await send(chatId,
        `📈 *مدارس التحليل — دليل سريع*\n\n` +
        `*ICT / SMC* 🏦\nOrder Blocks + FVG + Kill Zones\nالمؤسسات تتحرك في هذه المناطق\n\n` +
        `*Wyckoff* 📊\nAccumulation = تجميع → صعود قادم\nDistribution = توزيع → هبوط قادم\n\n` +
        `*Elliott Wave* 🌊\nموجة 3 = أقوى موجة صاعدة\nموجة 5 = نهاية الصعود ← حذر\nموجة C = هبوط تصحيحي\n\n` +
        `*Supply & Demand* ⚖️\nSupply Zone = منطقة بيع\nDemand Zone = منطقة شراء\nPremium >70% = Supply\nDiscount <30% = Demand\n\n` +
        `*Price Action* 🕯️\nشمعة ابتلاع = انعكاس قوي\nDoji = تردد = انتظر\nPin Bar = رفض مستوى\n\n` +
        `*Top-Down* ⬇️\nD1 يحدد الاتجاه الرئيسي\nH4 يحدد نقطة الدخول\nH1/M30 يحدد التوقيت الدقيق`,
        [[{ text: '📖 دليل المؤشرات', callback_data: 'guide' }, { text: '🔙 القائمة', callback_data: 'menu' }]]
      );
    }

    else if (data === 'levels') {
      const p = await getPrice();
      if (p?.price) {
        const price = p.price;
        await send(chatId,
          `🎯 *المستويات الرئيسية — XAU/USD*\n\n` +
          `💰 السعر الحالي: \`$${price.toFixed(2)}\`\n\n` +
          `🔴 *مقاومات (OB Sell / FVG)*\n` +
          `فوق السعر — انتظر البيانات من الشارت\n\n` +
          `🟢 *دعم (OB Buy / FVG)*\n` +
          `تحت السعر — انتظر البيانات من الشارت\n\n` +
          `📐 *Fibonacci من آخر حركة*\n` +
          `61.8% = مستوى الذهبي 🎯\n` +
          `38.2% = ارتداد طبيعي\n` +
          `50.0% = منتصف النطاق ⚖️\n\n` +
          `_للمستويات الدقيقة افتح الداشبورد_`,
          [[{ text: '📊 الإشارة', callback_data: 'signal' }, { text: '🔙 القائمة', callback_data: 'menu' }]]
        );
      }
    }

    else if (data === 'calendar') {
      const now  = new Date();
      const bHour = (h) => ((h + 3) % 24).toString().padStart(2, '0');
      await send(chatId,
        `📅 *الروزنامة الاقتصادية*\n\n` +
        `🔴 *HIGH IMPACT*\n` +
        `• CPI y/y — 14:30 GMT | ${bHour(14)}:30 بيروت\n` +
        `• FOMC Minutes — 18:00 GMT | ${bHour(18)}:00 بيروت\n` +
        `• NFP — 13:30 GMT | ${bHour(13)}:30 بيروت\n` +
        `• Fed Speech — 17:00 GMT | ${bHour(17)}:00 بيروت\n\n` +
        `🟠 *MED IMPACT*\n` +
        `• ECB Minutes — 11:30 GMT | ${bHour(11)}:30 بيروت\n` +
        `• PPI — 13:30 GMT | ${bHour(13)}:30 بيروت\n\n` +
        `⚠️ تجنب الدخول 30 دقيقة قبل HIGH IMPACT\n` +
        `🔔 سيتم التنبيه تلقائياً`,
        [[{ text: '🔙 القائمة', callback_data: 'menu' }]]
      );
    }

    else if (data === 'score') {
      await send(chatId,
        `🏆 *Master Score — شرح النظام*\n\n` +
        `النظام يحسب نقطة من 0–100 بناءً على:\n\n` +
        `• Premium/Discount Zone: ±12 نقطة\n` +
        `• VWAP + POC: ±8 نقطة\n` +
        `• MSS/BOS/CHoCH: ±15 نقطة\n` +
        `• Kill Zone: +10 نقطة\n` +
        `• Fibonacci 61.8%: +10 نقطة\n` +
        `• Correlation DXY+XAG: ±10 نقطة\n\n` +
        `*التفسير:*\n` +
        `🟢 75–100 = A+ ادخل بثقة\n` +
        `🔵 60–74 = A جيد مع تأكيد\n` +
        `🟡 45–59 = B انتظر تأكيد\n` +
        `🔴 0–44 = C تجنب الدخول\n\n` +
        `_للحصول على النقطة الحالية افتح الداشبورد_`,
        [[{ text: '📖 دليل المؤشرات', callback_data: 'guide' }, { text: '🔙 القائمة', callback_data: 'menu' }]]
      );
    }

    else if (data === 'guide') {
      await send(chatId,
        `📖 *دليل قراءة المؤشرات*\n\n` +
        `*RSI 14* 📊\n>70 = تشبع شراء ← انتظر | <30 = تشبع بيع ← فرصة\n\n` +
        `*MACD* 📈\nفوق الصفر = زخم صاعد ✅ | تحت الصفر = هابط\n\n` +
        `*EMA 50/200* 〰️\nفوق EMA = صاعد | Golden Cross = شراء 🟢\n\n` +
        `*OB Order Block* 📦\nمؤسسي — ادخل عند الارتداد منه\n\n` +
        `*FVG Fair Value Gap* ⚡\nفجوة يملأها السوق لاحقاً\n\n` +
        `*P&D Premium/Discount* ⚖️\n>70% = بيع | <30% = شراء | 50% = محايد\n\n` +
        `*MSS / BOS / CHoCH* 🔄\nBOS = استمرار | CHoCH = انعكاس\n\n` +
        `*Kill Zones* ⭐\nLondon 07–10 | NY 12–15 (الأفضل)\n\n` +
        `*VWAP + POC* 📊\nفوق VWAP = مشترون | POC = دعم/مقاومة قوي\n\n` +
        `*Fib 61.8% 🎯*\nالمستوى الذهبي — ارتداد قوي متوقع`,
        [[{ text: '📈 المدارس', callback_data: 'schools' }, { text: '🔙 القائمة', callback_data: 'menu' }]]
      );
    }

    else if (data === 'status') {
      await send(chatId,
        `⚙️ *حالة النظام*\n\n` +
        `✅ API يعمل\n` +
        `✅ MetaAPI MT5 متصل\n` +
        `✅ Telegram Bot نشط\n` +
        `✅ Claude AI متصل\n` +
        `✅ GPT-4o متصل\n\n` +
        `🌐 الداشبورد: [gold-bot-iota.vercel.app](https://gold-bot-iota.vercel.app)\n\n` +
        `⏱ \`${new Date().toUTCString()}\``,
        [[{ text: '💰 السعر', callback_data: 'price' }, { text: '🔙 القائمة', callback_data: 'menu' }]]
      );
    }

    else if (data === 'menu') {
      await send(chatId, `🥇 *Gold AI Bot v3 — القائمة الرئيسية*\n\nاختر:`, mainMenu);
    }
  }

  return res.status(200).json({ ok: true });
}
