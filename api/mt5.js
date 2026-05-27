// api/mt5.js — MT5 Automation via MetaAPI
// يُفعَّل لاحقاً بعد استقرار النظام

export default async function handler(req, res) {
  if(req.method==='OPTIONS') return res.status(200).end();
  res.setHeader('Access-Control-Allow-Origin','*');

  const TOKEN   = process.env.METAAPI_TOKEN;
  const ACCOUNT = process.env.METAAPI_ACCOUNT_ID;
  const { action, symbol, volume, stopLoss, takeProfit, comment } = req.body||{};

  if(!TOKEN||!ACCOUNT)
    return res.status(500).json({error:'Missing MetaAPI credentials'});

  const BASE = `https://mt-client-api-v1.london.agiliumtrade.ai/users/current/accounts/${ACCOUNT}`;
  const H    = {'auth-token':TOKEN,'Content-Type':'application/json'};

  // ── فتح صفقة ──
  if(action==='open'){
    try{
      const body = {
        symbol:      symbol||'XAUUSD',
        actionType:  req.body.direction==='BUY'?'ORDER_TYPE_BUY':'ORDER_TYPE_SELL',
        volume:      parseFloat(volume||0.01),
        stopLoss:    parseFloat(stopLoss||0),
        takeProfit:  parseFloat(takeProfit||0),
        comment:     comment||'GoldBot'
      };
      const r = await fetch(`${BASE}/trade`,{method:'POST',headers:H,body:JSON.stringify(body)});
      const d = await r.json();
      return res.status(200).json({ok:true,orderId:d.orderId||d.positionId,data:d});
    }catch(e){
      return res.status(500).json({ok:false,error:e.message});
    }
  }

  // ── إغلاق صفقة ──
  if(action==='close'){
    try{
      const posId = req.body.positionId;
      const r = await fetch(`${BASE}/positions/${posId}`,{method:'DELETE',headers:H});
      const d = await r.json();
      return res.status(200).json({ok:true,data:d});
    }catch(e){
      return res.status(500).json({ok:false,error:e.message});
    }
  }

  // ── قائمة الصفقات المفتوحة ──
  if(action==='list'){
    try{
      const r = await fetch(`${BASE}/positions`,{headers:H});
      const d = await r.json();
      return res.status(200).json({ok:true,positions:d});
    }catch(e){
      return res.status(500).json({ok:false,error:e.message});
    }
  }

  // ── حالة الحساب ──
  if(action==='account'){
    try{
      const r = await fetch(`${BASE}/account-information`,{headers:H});
      const d = await r.json();
      return res.status(200).json({ok:true,account:d});
    }catch(e){
      return res.status(500).json({ok:false,error:e.message});
    }
  }

  return res.status(400).json({error:'action must be: open/close/list/account'});
}
