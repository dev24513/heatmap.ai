// Mobile nav
const btn = document.getElementById('menuBtn');
const nav = document.getElementById('navLinks');
if (btn) btn.onclick = () => (nav.style.display = nav.style.display ? '' : 'block');

// Footer year
const y = document.getElementById('year'); if (y) y.textContent = new Date().getFullYear();

// ===== Top Picks (serverless) =====
const pickRows = document.getElementById('pickRows');

function usd(n){
  if (n >= 1e6) return `$${(n/1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n/1e3).toFixed(1)}k`;
  return `$${(n||0).toFixed(2)}`;
}
function pickRowHTML(p, i){
  const dir = p.ch1h >= 0 ? 'up' : 'down';
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
    <div>${usd(p.vol24)}</div>
    <div>${usd(p.liqUsd)}</div>
    <div class="actions">
      <a class="btn small" href="${jup}" target="_blank" rel="noopener">Trade</a>
    </div>
  </div>`;
}
async function loadPicks(){
  try {
    const r = await fetch('/api/picks');
    const j = await r.json();
    const list = (j && j.ok && Array.isArray(j.picks)) ? j.picks : [];
    pickRows.innerHTML = list.map(pickRowHTML).join('') || `<div class="row"><div></div><div>No picks right now — market quiet.</div></div>`;
  } catch (e) {
    pickRows.innerHTML = `<div class="row"><div></div><div class="down">Error loading picks.</div></div>`;
  }
}
loadPicks();
setInterval(loadPicks, 30000); // refresh every 30s

// ===== Trending (direct or proxy) =====
const rowsEl   = document.getElementById('rows');
const searchEl = document.getElementById('search');
const timeEl   = document.getElementById('timeframe');
const filterEl = document.getElementById('filter');

let DATA = [];
let sortKey = 'volume24h';
let sortAsc = false;

async function fetchPairs(){
  try {
    const r = await fetch('/api/dex', { headers:{'accept':'application/json'} });
    const j = await r.json();
    if (!j.ok) throw new Error('proxy fail');
    DATA = (j.pairs||[]).filter(p => p.priceUsd>0 && p.volume24h>=1000);
  } catch {
    const r = await fetch('https://api.dexscreener.com/latest/dex/search?q=solana');
    const j = await r.json();
    DATA = (j.pairs||[])
      .filter(p => (p.chainId||'').toLowerCase().includes('sol'))
      .map(p => ({
        url: p.url,
        chainId: p.chainId,
        symbol: `${p.baseToken?.symbol||'—'}/${p.quoteToken?.symbol||''}`,
        priceUsd: Number(p.priceUsd||0),
        change24h: Number(p.priceChange?.h24 ?? 0),
        volume24h: Number(p.volume?.h24 ?? 0),
        txns24h: Number((p.txns?.h24?.buys || 0) + (p.txns?.h24?.sells || 0)),
      }))
      .filter(p => p.priceUsd>0 && p.volume24h>=1000);
  }
}
function toUSD(n){ return n>=1e6?`$${(n/1e6).toFixed(2)}M`: n>=1e3?`$${(n/1e3).toFixed(1)}k`:`$${(n||0).toFixed(2)}`; }
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
async function refreshTrending(){ await fetchPairs(); renderTrending(); }
refreshTrending();
setInterval(refreshTrending, 30000);
document.querySelectorAll('.board-head button').forEach(b=>{
  b.addEventListener('click',()=>{ const k=b.dataset.sort; if (sortKey===k) sortAsc=!sortAsc; else { sortKey=k; sortAsc=false; } renderTrending();});
});
searchEl?.addEventListener('input', renderTrending);
timeEl?.addEventListener('change', refreshTrending);
filterEl?.addEventListener('change', renderTrending);

// ===== Trade Modal (Jupiter) =====
const modal = document.getElementById('tradeModal');
const frame = document.getElementById('tradeFrame');
const closeBtn = document.getElementById('modalClose');
function openTrade(jupUrl){ if(!modal||!frame) return window.open(jupUrl,'_blank'); frame.src=jupUrl; modal.hidden=false; }
closeBtn?.addEventListener('click', ()=>{ modal.hidden=true; frame.src='about:blank'; });
modal?.addEventListener('click', (e)=>{ if(e.target===modal){ modal.hidden=true; frame.src='about:blank'; }});
