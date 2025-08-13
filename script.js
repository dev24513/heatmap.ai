// ===== nav mobile toggle =====
const btn = document.getElementById('menuBtn');
const nav = document.getElementById('navLinks');
if (btn) btn.onclick = () => (nav.style.display = nav.style.display ? '' : 'block');

// ===== footer year =====
document.getElementById('year').textContent = new Date().getFullYear();

// ===== heatmap demo (client-side only) =====
const area = document.getElementById('heatArea');
function dropDot(x, y){
  const d = document.createElement('div');
  d.className = 'dot';
  d.style.left = x - 9 + 'px';
  d.style.top  = y - 9 + 'px';
  area.appendChild(d);
  requestAnimationFrame(()=> d.classList.add('show'));
  setTimeout(()=> d.style.opacity = 0.82, 250);
}
['click','touchstart'].forEach(evt=>{
  area.addEventListener(evt, e=>{
    const r = area.getBoundingClientRect();
    const cx = (e.touches?.[0]?.clientX ?? e.clientX) - r.left;
    const cy = (e.touches?.[0]?.clientY ?? e.clientY) - r.top;
    dropDot(cx, cy);
  }, {passive:true});
});

// ===== trending board (mock data + sorting + filters) =====
const rowsEl = document.getElementById('rows');
const searchEl = document.getElementById('search');
const timeEl = document.getElementById('timeframe');
const filterEl = document.getElementById('filter');

let sortKey = 'rank';
let sortAsc = true;

// generate mock items
function rand(n){ return Math.random()*n }
function pick(a){ return a[Math.floor(Math.random()*a.length)] }
const symbols = ['CUPSY','DOGE2','MOON','ZOOMR','PEPEX','BLITZ','HEAT','FLOW','BOP','RAYD'];
function mkItem(i){
  const price = +(0.0001 + rand(4)).toFixed(4);
  const change = +((rand(18)-9)).toFixed(2);
  const volume = Math.floor(rand(2_000_000) + 50_000);
  const holders = Math.floor(rand(30_000) + 200);
  const name = pick(['Labs','AI','Tools','Chain','Vision','X']);
  return {
    rank:i+1,
    symbol:symbols[i%symbols.length],
    name:`${symbols[i%symbols.length]} ${name}`,
    price, change, volume, holders,
    new: Math.random()>0.75,
    spark: Array.from({length:18},()=> +(rand(1)).toFixed(2))
  };
}
let DATA = Array.from({length:25}, (_,i)=> mkItem(i));

// render sparkline
function sparkPath(vals, w=90, h=28){
  const max = Math.max(...vals), min = Math.min(...vals);
  const m = max === min ? 1 : (max - min);
  const step = w/(vals.length-1);
  let d = `M0 ${h - ((vals[0]-min)/m)*h}`;
  for(let i=1;i<vals.length;i++){
    const x = i*step;
    const y = h - ((vals[i]-min)/m)*h;
    d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

function rowHTML(it){
  const dir = it.change >= 0 ? 'up' : 'down';
  return `
  <div class="row">
    <div class="dim">${it.rank}</div>
    <div class="sym">
      <span class="badge">${it.symbol}</span>
      <div>
        <div style="font-weight:700">${it.name}</div>
        ${it.new ? `<div class="dim" style="font-size:12px">New</div>`:''}
      </div>
    </div>
    <div>$${it.price.toFixed(4)}</div>
    <div class="${dir}">${it.change > 0 ? '+' : ''}${it.change.toFixed(2)}%</div>
    <div>${it.volume.toLocaleString()}</div>
    <div>${it.holders.toLocaleString()}</div>
  </div>`;
}

function render(){
  const q = (searchEl.value||'').toLowerCase();
  const f = filterEl.value;
  let list = DATA.filter(it =>
    it.symbol.toLowerCase().includes(q) || it.name.toLowerCase().includes(q)
  );
  if (f === 'gainers') list = list.filter(it => it.change > 0).sort((a,b)=> b.change - a.change).slice(0,15);
  if (f === 'volume')  list = list.sort((a,b)=> b.volume - a.volume).slice(0,15);
  if (f === 'new')     list = list.filter(it => it.new);

  list.sort((a,b)=>{
    const A = a[sortKey], B = b[sortKey];
    if (A < B) return sortAsc ? -1 : 1;
    if (A > B) return sortAsc ? 1 : -1;
    return 0;
  });

  rowsEl.innerHTML = list.map(rowHTML).join('');
  // draw sparklines into each row after mount
  Array.from(rowsEl.querySelectorAll('.row')).forEach((row,i)=>{
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('class','spark'); svg.setAttribute('viewBox','0 0 90 28'); svg.setAttribute('preserveAspectRatio','none');
    const path = document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d', sparkPath((list[i]?.spark)||DATA[i].spark));
    path.setAttribute('fill','none'); path.setAttribute('stroke','currentColor'); path.setAttribute('stroke-width','2');
    svg.appendChild(path);
    row.children[2].appendChild(document.createElement('div')); // spacer for align on mobile
    row.children[2].lastChild.replaceWith(svg);
  });
}

render();

// sorting handlers
document.querySelectorAll('.board-head button').forEach(b=>{
  b.addEventListener('click', ()=>{
    const k = b.dataset.sort;
    if (sortKey === k) sortAsc = !sortAsc; else { sortKey = k; sortAsc = true; }
    render();
  });
});

// filters/search
searchEl.addEventListener('input', ()=> render());
timeEl.addEventListener('change', ()=>{
  // nudge the mock data on timeframe switch
  DATA = DATA.map(it => ({...it, change: +(it.change + (Math.random()*2-1)).toFixed(2)}));
  render();
});
filterEl.addEventListener('change', ()=> render());

// fake live ticks
setInterval(()=>{
  DATA = DATA.map(it=>{
    const bump = (Math.random()*0.6 - 0.3); // -0.3% to +0.3%
    const price = Math.max(0.0001, +(it.price * (1 + bump/100)).toFixed(4));
    const change = +(it.change + bump).toFixed(2);
    const spark = it.spark.slice(1).concat(Math.max(0, Math.min(1, it.spark.at(-1) + bump/10)));
    return {...it, price, change, spark};
  });
  render();
}, 2500);
