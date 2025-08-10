# heatmap.ai
My Token Heatmap Site
# HeatMap.AI — MVP (Static)

A mobile-first, dependency-free heatmap for Solana token momentum.

## Features
- Live-updating tiles with a composite **momentum score**
- Filters: min liquidity, min 5m volume, age, new pairs only
- Tap a tile to open a **drawer** with details and sparkline
- PWA-style header and **push notification** alerts for hot scores

## How to Deploy From Your Phone
1. Install the **Vercel** or **Netlify** app (both work on iOS/Android).
2. Create a new project → **Import** this folder.
   - If using Netlify: drag-drop the ZIP from Files app.
   - If using Vercel: create a repo in their mobile app and upload the ZIP.
3. Done. It’s static HTML/JS—no build step needed.

## Hooking Up Real Data
Open `index.html` and look for the `Data` object. Replace the `seed()` / `start()` with real fetches:

```js
// Example shape your API should return (array of pairs)
[{
  id: "PAIR-123",
  symbol: "ABCD",
  name: "Nova Coin",
  priceDelta5m: 3.4,            // percent
  volume5m: 12050,              // USD
  buys5m: 180,
  sells5m: 130,
  newWallets30m: 42,
  liquidity: 55000,             // USD
  ageHours: 1.2,
  score: 0.78,                  // optional; frontend will compute if missing
  spark: [100,103,101,...],     // 40 numbers (for sparkline)
  url: "https://dexscreener.com/solana/PAIRADDR"
}]
```

Then, in JS:
```js
async function fetchPairs(){
  const res = await fetch('https://YOUR_ENDPOINT/pairs');
  const arr = await res.json();
  Data._pairs = arr.map(p => ({ ...p, score: p.score ?? (
    z(p.priceDelta5m,7)*.35 + z(p.volume5m,20000)*.35 + z((p.buys5m/(p.sells5m+1)),1.5)*.15 + z(p.newWallets30m,200)*.15 - (p.liquidity<15000?0.6:0)
  ) }));
  Data.notify();
}
setInterval(fetchPairs, 5000);
fetchPairs();
```

## Security / Anti-Copy Notes
- Keep your API private; restrict by IP or API key.
- Do **server-side scoring** and return only what's needed.
- Add random jitter to scores client-side so rivals can’t infer your exact formula.
- Serve from your own domain; hide origin sources behind your backend.

## License
You own this copy. Use it commercially.
HeatMap.AI
Solana • Live

Cold

Cooling

Warming

Hot
Min Liquidity: Any$10k$25k$50k
Min 5m Vol: Any$1k$5k$10k
Age < Any24h6h2h
New pairs only
Set Hot Alert
Prototype • No financial advice • Tap a tile for details


