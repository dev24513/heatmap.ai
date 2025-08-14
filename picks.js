// api/picks.js — Top coin picks from DexScreener (Solana) with basic momentum filters
const DS = 'https://api.dexscreener.com/latest/dex/search?q=solana';
const num = (n,d=0)=>{const x=Number(n);return Number.isFinite(x)?x:d;};

export default async function handler(req, res) {
  try {
    const r = await fetch(DS, { headers: { 'accept': 'application/json' } });
    if (!r.ok) return res.status(r.status).json({ ok:false, status:r.status });
    const { pairs = [] } = await r.json();

    const norm = pairs.map(p => {
      const tx5m = num(p?.txns?.m5?.buys,0) + num(p?.txns?.m5?.sells,0);
      const tx1h = num(p?.txns?.h1?.buys,0) + num(p?.txns?.h1?.sells,0);
      const tx24 = num(p?.txns?.h24?.buys,0) + num(p?.txns?.h24?.sells,0);
      const liq  = num(p?.liquidity?.usd,0);
      const vol24= num(p?.volume?.h24,0);
      const ch1h = num(p?.priceChange?.h1,0);
      return {
        url: p.url,
        chainId: p.chainId,
        base: p?.baseToken?.symbol || p?.baseToken?.name || '—',
        baseMint: p?.baseToken?.address || '',
        quote: p?.quoteToken?.symbol || '',
        priceUsd: num(p.priceUsd, 0),
        liqUsd: liq,
        vol24,
        ch1h,
        tx5m, tx1h, tx24
      };
    });

    const MIN_LIQ = 20000;
    const MIN_VOL = 100000;
    const MIN_CH1H = 3;

    const filtered = norm
      .filter(p => (p.chainId || '').toLowerCase().includes('sol'))
      .filter(p => p.priceUsd > 0)
      .filter(p => p.liqUsd >= MIN_LIQ)
      .filter(p => p.vol24 >= MIN_VOL)
      .filter(p => p.ch1h >= MIN_CH1H)
      .filter(p => {
        if (p.tx1h > 0) {
          const avg5m = p.tx1h / 12;
          return p.tx5m >= Math.max(10, avg5m * 1.15);
        }
        return p.tx24 >= 200;
      });

    const picks = filtered.map(p => {
      const volM = p.vol24 / 1_000_000;
      const txBoost = p.tx1h ? (p.tx5m / Math.max(1, p.tx1h/12)) : 1;
      const score = 0.6 * p.ch1h + 0.3 * Math.sqrt(Math.max(0, volM)) + 0.1 * Math.min(3, txBoost);
      return { ...p, score };
    }).sort((a,b) => b.score - a.score).slice(0, 25);

    res.setHeader('Cache-Control', 's-maxage=20, stale-while-revalidate=30');
    res.status(200).json({ ok:true, picks });
  } catch (e) {
    res.status(200).json({ ok:false, error:String(e) });
  }
}
