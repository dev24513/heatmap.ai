// api/dex.js - Vercel serverless proxy for DexScreener Solana search
export default async function handler(req, res) {
  try {
    const q = req.query.q || 'solana'; // you can pass ?q=whatever
    const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { 'accept': 'application/json' } });
    if (!r.ok) return res.status(r.status).json({ ok: false, status: r.status });
    const data = await r.json();
    // keep response small: only return needed fields
    const pairs = (data.pairs || []).map(p => ({
      chainId: p.chainId,
      dexId: p.dexId,
      url: p.url,
      pairAddress: p.pairAddress,
      base: p.baseToken?.symbol || p.baseToken?.name || '—',
      quote: p.quoteToken?.symbol || '',
      priceUsd: Number(p.priceUsd || 0),
      change24h: Number(p.priceChange?.h24 ?? 0),
      volume24h: Number(p.volume?.h24 ?? 0),
      txns24h: Number((p.txns?.h24?.buys || 0) + (p.txns?.h24?.sells || 0)),
      liquidityUsd: Number(p.liquidity?.usd ?? 0),
      fdv: Number(p.fdv ?? 0)
    }));
    res.setHeader('Cache-Control','s-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({ ok: true, pairs });
  } catch (e) {
    return res.status(200).json({ ok: false, error: String(e) });
  }
}
