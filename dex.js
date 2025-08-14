// api/dex.js — Vercel serverless proxy for DexScreener "search" (Solana)
export default async function handler(req, res) {
  try {
    const q = req.query.q || 'solana';
    const r = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`,
      { headers: { 'accept': 'application/json' } });
    if (!r.ok) return res.status(r.status).json({ ok:false, status:r.status });

    const { pairs = [] } = await r.json();
    const cleaned = pairs
      .filter(p => (p.chainId || '').toLowerCase().includes('sol'))
      .map(p => ({
        url: p.url,
        chainId: p.chainId,
        dexId: p.dexId,
        pairAddress: p.pairAddress,
        baseSymbol: p.baseToken?.symbol || p.baseToken?.name || '—',
        baseMint: p.baseToken?.address || '',
        quoteSymbol: p.quoteToken?.symbol || '',
        quoteMint: p.quoteToken?.address || '',
        priceUsd: Number(p.priceUsd || 0),
        change24h: Number(p.priceChange?.h24 ?? 0),
        volume24h: Number(p.volume?.h24 ?? 0),
        txns24h: Number((p.txns?.h24?.buys || 0) + (p.txns?.h24?.sells || 0)),
        liquidityUsd: Number(p.liquidity?.usd ?? 0),
        fdv: Number(p.fdv ?? 0),
      }));

    res.setHeader('Cache-Control','s-maxage=30, stale-while-revalidate=60');
    res.status(200).json({ ok:true, pairs: cleaned });
  } catch (e) {
    res.status(200).json({ ok:false, error:String(e) });
  }
}
