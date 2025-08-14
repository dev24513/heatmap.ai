// v8 — widen data source + robust picks

// util
const $ = s => document.querySelector(s);
const fmtUSD = n => n>=1e6?`$${(n/1e6).toFixed(2)}M`: n>=1e3?`$${(n/1e3).toFixed(1)}k`:`$${(n||0).toFixed(2)}`;
const y = document.getElementById('year'); if (y) y.textContent = new Date().getFullYear();

// ---- Fetch helpers (combine multiple queries so we always get enough Solana pairs)
const ENDPOINTS = [
  'https://api.dexscreener.com/latest/dex/search?q=solana',
  'https://api.dexscreener.com/latest/dex/search?q=USDC%20solana',
  'https://api.dexscreener.com/latest/dex/search?q=SOL%20solana'
];

async function fetchAllPairs() {
  const lists = await Promise.allSettled(
    ENDPOINTS.map(u => fetch(u).then(r => r.json()).catch(()=>({pairs:[]})))
  );
  const merged = [];
  const seen = new Set();

  for (const r of lists) {
    const pairs = (r.status === 'fulfilled' && Array.isArray(r.value?.pairs)) ? r.value.pairs : [];
    for (const p of pairs) {
      if (!p || (p.chainId||'').toLowerCase() !== 'solana') continue;
      const id = p.pairAddress || `${p.baseToken?.address}-${p.quoteToken?.address}-${p.dexId}`;
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push({
        url: p.url,
        chainId: p.chainId,
        dexId: p.dexId,
        pairAddress: p.pairAddress,
        base: p.baseToken?.symbol || p.baseToken?.name || '—',
        baseMint: p.baseToken?.address || '',
        quote: p.quoteToken?.symbol || '',
        priceUsd: Number(p.priceUsd || 0),
        ch1h: Number(p.priceChange?.h1 ?? 0),
        ch24h: Number(p.priceChange?.h24 ?? 0),
        vol24: Number(p.volume?.h24 ?? 0),
        liqUsd: Number(p.liquidity?.usd ?? 0),
        tx5m: Number((p.txns?.m5?.buys || 0) + (p.txns?.m5?.sells || 0)),
        tx1h: Number((p.txns?.h1?.buys || 0) + (p.txns?.h1?.sells || 0)),
        tx24: Number((p.txns?.h24?.buys || 0) + (p.txns?.h24?.sells || 0)),
      });
    }
  }

  // de-noise obvious junk
  return merged.filter(p => p.priceUsd > 0).slice(0, 500);
}

// ===== Top Picks (filtered but with fallback so it never looks empty)
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
    <div class="actions"><a class="btn" href="${jup}" target="_blank" rel="noopener">Trade</a></div>
  </div>`;
}

async function loadPicks(){
  const pairs = await fetchAllPairs();
  // thresholds (slightly relaxed so you’ll see picks more often)
  const MIN_LIQ = 15000;   // was 20000
  const MIN_VOL = 75000;   // was 100000
  const MIN_CH1H = 2;      // was 3
  const picks = pairs
    .filter(p => p.liqUsd >= MIN_LIQ && p.vol24 >= MIN_VOL && p.ch1h >= MIN_CH1H)
    .filter(p => p.tx1h ? p.tx5m >= Math.max(8, (p.tx1h/12)*1.10) : p.tx24 >= 150)
    .map(p => ({...p, score: 0.6*p.ch1h + 0.3*Math.sqrt(Math.max(0,p.vol24/1e6)) + 0.1 }))
    .sort((a,b)=> b.score - a.score)
    .slice(0, 25);

  // Fallback if filters are too strict at the moment:
  const list = picks.length ? picks
    : pairs
        .filter(p => p.liqUsd >= 10000)
        .sort((a,b)=> (b.vol24 - a.vol24) || (b.ch1h - a.ch1h))
        .slice(0, 15);

  pickRows.innerHTML = list.length
    ? list.map(pickRowHTML).join('')
    : `<div class="row"><div></div><div>No picks right now.</div></div>`;
}

// ===== Trending (bigger set, always fills)
const rowsEl = document.getElementById('rows');
const searchEl = document.getElementById('search');
const filterEl = document.getElementById('filter');

let DATA = []; let sortKey='vol24', sortAsc=false;

function toUSD(n){return n>=1e6?`$${(n/1e6).toFixed(2)}M`: n>=1e3?`$${(n/1e3).toFixed(1)}k`:`$${(n||0).toFixed(2)}`;}
function rowHTML(it,i){
  const dir = it.ch24h>=0?'up':'down';
  return `
  <div class="row grid6">
    <div class="dim">${i+1}</div>
    <div class="sym"><span class="badge">${it.base}</span><div>${it.base}/${it.quote} <span class="dim" style="font-size:12px">${it.chainId||''}</span></div></div>
    <div>$${(it.priceUsd||0).toFixed(6)}</div>
    <div class="${dir}">${it.ch24h>0?'+':''}${(it.ch24h||0).toFixed(2)}%</div>
    <div>${toUSD(it.vol24||0)}</div>
    <div>${(it.tx24||0).toLocaleString()}</div>
  </div>`;
}

async function loadTrending(){
  DATA = await fetchAllPairs();
  renderTrending();
}
function renderTrending(){
  if(!rowsEl) return;
  const q=(searchEl?.value||'').toLowerCase();
  const f=filterEl?.value||'all';
  let list=DATA.filter(it =>
    (it.base||'').toLowerCase().includes(q) ||
    (it.quote||'').toLowerCase().includes(q) ||
    (it.chainId||'').toLowerCase().includes(q)
  );
  if(f==='gainers') list=list.filter(it=>it.ch24h>0).sort((a,b)=>b.ch24h-a.ch24h).slice(0,40);
  if(f==='volume')  list=list.sort((a,b)=>b.vol24-a.vol24).slice(0,40);
  list.sort((a,b)=>{const A=a[sortKey]??0,B=b[sortKey]??0;return A<B?(sortAsc?-1:1):A>B?(sortAsc?1:-1):0;});
  rowsEl.innerHTML = list.map(rowHTML).join('');
}

// run
async function boot(){
  await Promise.all([loadPicks(), loadTrending()]);
  setInterval(async()=>{
    await Promise.all([loadPicks(), loadTrending()]);
  }, 30000);
}
boot();
searchEl?.addEventListener('input', renderTrending);
filterEl?.addEventListener('change', renderTrending);
