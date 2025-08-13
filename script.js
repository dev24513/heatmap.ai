// ===== nav mobile toggle =====
const btn = document.getElementById('menuBtn');
const nav = document.getElementById('navLinks');
if (btn) btn.onclick = () => (nav.style.display = nav.style.display ? '' : 'block');

// ===== footer year =====
document.getElementById('year').textContent = new Date().getFullYear();

// ===== heatmap demo (client-side only) =====
const area = document.getElementById('heatArea');
function dropDot(x, y){
  if (!area) return;
  const d = document.createElement('div');
  d.className = 'dot';
  d.style.left = x - 9 + 'px';
  d.style.top  = y - 9 + 'px';
  area.appendChild(d);
  requestAnimationFrame(()=> d.classList.add('show'));
  setTimeout(()=> d.style.opacity = 0.82, 250);
}
['click','touchstart'].forEach(evt=>{
  area?.addEventListener(evt, e=>{
    const r = area.getBoundingClientRect();
    const cx = (e.touches?.[0]?.clientX ?? e.clientX) - r.left;
    const cy = (e.touches?.[0]?.clientY ?? e.clientY) - r.top;
    dropDot(cx, cy);
  }, {passive:true});
});

// ===== live trending board (DexScreener) =====
const rowsEl   = document.getElementById('rows');
const searchEl = document.getElementById('search');
const timeEl   = document.getElementById('timeframe');
const filterEl = document.getElementById('filter');

let DATA = [];
let sortKey = 'volume24h';
let sortAsc = false;

const API_PROXY = '/api/dex';
const API_DIRECT = 'https://api.dexscreener.com/latest/dex/search?q=solana';

async function fetchPairs() {
  // try proxy first
  for (const url of [API_PROXY, API_DIRECT]) {
    try {
      const r = await fetch(url, { headers: { 'accept': 'application/json' } });
      if (!r.ok) continue;
      const j = await r.json();
      const pairs = j.pairs || j.pairs === undefined ? (j.pairs || j.pairs) : j.pairs; // be robust
      const list = (pairs || j.pairs || j.pairs === undefined ? (pairs || []) : (j.pairs || []));

      // If using direct endpoint the shape is {pairs:[...]}; normalize
      const normalized = (list.length ? list : (j.pairs || [])).map(p => ({
        chainId: p.chainId,
        pairAddress: p.pairAddress,
        url: p.url,
        base: p.baseToken?.symbol || p.base || '—',
        quote: p.quoteToken?.symbol || p.quote || '',
        priceUsd: Number(p.priceUsd || 0),
        change24h: Number(p.priceChange?.h24 ?? p.change24h ?? 0),
        volume24h: Number(p.volume?.h24 ?? p.volume24h ?? 0),
        txns24h: Number((p.txns?.h24?.buys || 0) + (p.txns?.h24?.sells || 0)),
        liquidityUsd: Number(p.liquidity?.usd ?? p.liquidityUsd ?? 0),
        fdv: Number(p.fdv ?? 0),
      }));

      // Keep Solana / Raydium-style pairs & filter out obvious garbage
      DATA = normalized
        .filter(p => p.chainId?.toLowerCase().includes('sol') || p.url?.includes('solana'))
        .filter(p => p.priceUsd > 0 && p.volume24h >= 1000);

      return;
    } catch (e) {
      // try next url
    }
  }
}

function toUSD(n){ return n >= 1e6 ? `$${(n/1e6).toFixed(2)}M` :
                   n >= 1e3 ? `$${(n/1e3).toFixed(1)}k` : `$${n.toFixed(2)}`; }

function rowHTML(it, i){
  const dir = it.change24h >= 0 ? 'up' : 'down';
  const base = it.base || '—';
  const quote = it.quote || '';
  return `
  <div class="row">
    <div class="dim">${i+1}</div>
    <div class="sym">
      <span class="badge">${base}</span>
      <div>
        <div style="font-weight:700">${base}/${quote} <span class="dim" style="font-size:12px">${it.chainId || ''}</span></div>
        <a href="${it.url || '#'}" target="_blank" rel="noopener" class="dim" style="font-size:12px">View on DexScreener ↗</a>
      </div>
    </div>
    <div>$${(it.priceUsd||0).toFixed(6)}</div>
    <div class="${dir}">${it.change24h>0?'+':''}${(it.change24h||0).toFixed(2)}%</div>
    <div>${toUSD(it.volume24h||0)}</div>
    <div>${(it.txns24h||0).toLocaleString()}</div>
  </div>`;
}

function render(){
  if (!rowsEl) return;
  const q = (searchEl?.value||'').toLowerCase();
  const f = filterEl?.value || 'all';
  let list = DATA.filter(it =>
    (it.base||'').toLowerCase().includes(q) ||
    (it.quote||'').toLowerCase().includes(q) ||
    (it.chainId||'').toLowerCase().includes(q)
  );

  if (f === 'gainers') list = list.filter(it => it.change24h > 0).sort((a,b)=> b.change24h - a.change24h).slice(0,30);
  if (f === 'volume')  list = list.sort((a,b)=> b.volume24h - a.volume24h).slice(0,30);
  if (f === 'new')     list = list.slice(0,20); // DexScreener doesn't label "new" in this endpoint—placeholder

  list.sort((a,b)=>{
    const A = a[sortKey] ?? 0, B = b[sortKey] ?? 0;
    if (A < B) return sortAsc ? -1 : 1;
    if (A > B) return sortAsc ? 1 : -1;
    return 0;
  });

  rowsEl.innerHTML = list.map((it,i)=> rowHTML(it, i)).join('');
}

async function refresh(){
  await fetchPairs();
  render();
}

// initial + auto refresh
refresh();
setInterval(refresh, 30000); // refresh every 30s

// sorting handlers
document.querySelectorAll('.board-head button').forEach(b=>{
  b.addEventListener('click', ()=>{
    const k = b.dataset.sort;
    if (sortKey === k) sortAsc = !sortAsc; else { sortKey = k; sortAsc = false; }
    render();
  });
});

// filters/search
searchEl?.addEventListener('input', render);
timeEl?.addEventListener('change', refresh);
filterEl?.addEventListener('change', render);
