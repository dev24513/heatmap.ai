// direct DexScreener version (no serverless)
// util
const $ = s => document.querySelector(s);
const fmtUSD = n => n>=1e6?`$${(n/1e6).toFixed(2)}M`: n>=1e3?`$${(n/1e3).toFixed(1)}k`:`$${(n||0).toFixed(2)}`;
const y = document.getElementById('year'); if (y) y.textContent = new Date().getFullYear();

// Top Picks (filtered)
const pickRows = document.getElementById('pickRows');
function pickRowHTML(p,i){
  const dir = p.ch1h>=0?'up':'down';
  const jup = p.baseMint ? `https://jup.ag/swap/SOL-${p.baseMint}` : 'https://jup.ag/';
  return `
  <div class="row grid7">
    <div class="dim">${i+1}</div>
    <div class="sym">
      <span class="badge">${p.base}</span>
      <div>
        <div style="font-weight:700">${p.base}/${p.quote} <span class="dim" style="font-size:12px">${p.chainId||''}</span></div>
        <a href="${p.url||'#'}" target="_blank" class="dim" style="font-size:12px">DexScreener ↗</a>
      </div>
    </div>
    <div>$${(p.priceUsd||0).toFixed(6)}</div>
    <div class="${dir}">${p.ch1h>0?'+':''}${(p.ch1h||0).toFixed(2)}%</div>
    <div>${fmtUSD(p.vol24)}</div>
    <div>${fmtUSD(p.liqUsd)}</div>
    <div class="actions"><a class="btn" href="${jup}" target="_blank">Trade</a></div>
  </div>`;
}

async function loadPicks(){
  const r = await fetch('https://api.dexscreener.com/latest/dex/search?q=solana');
  const j = await r.json();
  const pairs = (j.pairs||[]).map(p => ({
    url: p.url,
    chainId: p.chainId,
    base: p?.baseToken?.symbol || p?.baseToken?.name || '—',
    baseMint: p?.baseToken?.address || '',
    quote: p?.quoteToken?.symbol || '',
    priceUsd: Number(p.priceUsd||0),
    liqUsd: Number(p?.liquidity?.usd||0),
    vol24: Number(p?.volume?.h24||0),
    ch1h: Number(p?.priceChange?.h1||0),
    tx5m: Number((p?.txns?.m5?.buys||0) + (p?.txns?.m5?.sells||0)),
    tx1h: Number((p?.txns?.h1?.buys||0) + (p?.txns?.h1?.sells||0)),
    tx24: Number((p?.txns?.h24?.buys||0) + (p?.txns?.h24?.sells||0)),
  }));
  const picks = pairs
    .filter(p => (p.chainId||'').toLowerCase().includes('sol') && p.priceUsd>0)
    .filter(p => p.liqUsd >= 20000 && p.vol24 >= 100000 && p.ch1h >= 3)
    .filter(p => p.tx1h ? p.tx5m >= Math.max(10, (p.tx1h/12)*1.15) : p.tx24 >= 200)
    .map(p => ({...p, score: 0.6*p.ch1h + 0.3*Math.sqrt(Math.max(0,p.vol24/1e6)) + 0.1}))
    .sort((a,b)=>b.score-a.score)
    .slice(0,25);
  pickRows.innerHTML = picks.map(pickRowHTML).join('') || `<div class="row"><div></div><div>No picks right now.</div></div>`;
}

// Trending
const rowsEl = document.getElementById('rows');
const searchEl = document.getElementById('search');
const filterEl = document.getElementById('filter');
let DATA = []; let sortKey='volume24h', sortAsc=false;

function toUSD(n){return n>=1e6?`$${(n/1e6).toFixed(2)}M`: n>=1e3?`$${(n/1e3).toFixed(1)}k`:`$${(n||0).toFixed(2)}`;}
function rowHTML(it,i){
  const dir = it.change24h>=0?'up':'down';
  return `
  <div class="row grid6">
    <div class="dim">${i+1}</div>
    <div class="sym"><span class="badge">${it.symbol.split('/')[0]}</span><div>${it.symbol} <span class="dim" style="font-size:12px">${it.chainId||''}</span></div></div>
    <div>$${(it.priceUsd||0).toFixed(6)}</div>
    <div class="${dir}">${it.change24h>0?'+':''}${(it.change24h||0).toFixed(2)}%</div>
    <div>${toUSD(it.volume24h||0)}</div>
    <div>${(it.txns24h||0).toLocaleString()}</div>
  </div>`;
}
async function loadTrending(){
  const r = await fetch('https://api.dexscreener.com/latest/dex/search?q=solana');
  const j = await r.json();
  DATA = (j.pairs||[]).filter(p => (p.chainId||'').toLowerCase().includes('sol')).map(p => ({
    chainId: p.chainId,
    symbol: `${p.baseToken?.symbol||'—'}/${p.quoteToken?.symbol||''}`,
    priceUsd: Number(p.priceUsd||0),
    change24h: Number(p.priceChange?.h24 ?? 0),
    volume24h: Number(p.volume?.h24 ?? 0),
    txns24h: Number((p.txns?.h24?.buys||0) + (p.txns?.h24?.sells||0)),
  }));
  renderTrending();
}
function renderTrending(){
  if(!rowsEl) return;
  const q=(searchEl?.value||'').toLowerCase();
  const f=filterEl?.value||'all';
  let list=DATA.filter(it => (it.symbol||'').toLowerCase().includes(q) || (it.chainId||'').toLowerCase().includes(q));
  if(f==='gainers') list=list.filter(it=>it.change24h>0).sort((a,b)=>b.change24h-a.change24h).slice(0,30);
  if(f==='volume')  list=list.sort((a,b)=>b.volume24h-a.volume24h).slice(0,30);
  list.sort((a,b)=>{const A=a[sortKey]??0,B=b[sortKey]??0;return A<B?(sortAsc?-1:1):A>B?(sortAsc?1:-1):0;});
  rowsEl.innerHTML = list.map(rowHTML).join('');
}

loadPicks();
loadTrending();
setInterval(()=>{loadPicks(); loadTrending();}, 30000);
searchEl?.addEventListener('input', renderTrending);
filterEl?.addEventListener('change', renderTrending);
