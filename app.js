:::writing{variant=“standard” id=“30001”}
const TICKERS = [
{ t: “NVDA”, n: “NVIDIA”, type: “Stock” },
{ t: “MSFT”, n: “Microsoft”, type: “Stock” },
{ t: “META”, n: “Meta”, type: “Stock” },
{ t: “AMZN”, n: “Amazon”, type: “Stock” },
{ t: “AVGO”, n: “Broadcom”, type: “Stock” },
{ t: “PLTR”, n: “Palantir”, type: “Stock” },
{ t: “TSLA”, n: “Tesla”, type: “Stock” },
{ t: “NFLX”, n: “Netflix”, type: “Stock” },
{ t: “LLY”, n: “Eli Lilly”, type: “Stock” },
{ t: “JPM”, n: “JPMorgan”, type: “Stock” },
{ t: “QQQ”, n: “QQQ”, type: “ETF” },
{ t: “SPY”, n: “SPY”, type: “ETF” },
{ t: “XLK”, n: “XLK”, type: “ETF” },
{ t: “SMH”, n: “SMH”, type: “ETF” },
{ t: “SOXX”, n: “SOXX”, type: “ETF” }
];

const table = document.getElementById(“resultsBody”);
const status = document.getElementById(“statusText”);
const topTicker = document.getElementById(“topTicker”);
const avgScore = document.getElementById(“avgScore”);

async function loadData() {
status.innerText = “Loading fast market data…”;

try {
const symbols = TICKERS.map(x => x.t).join(”,”);
const res = await fetch(https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols});
const data = await res.json();

const rows = data.quoteResponse.result.map(q => {
  const change = q.regularMarketChangePercent || 0;
  const price = q.regularMarketPrice || 0;

  // Fast SCTR-style score
  let score = 50;

  score += change * 2; // momentum
  if (change > 0) score += 10;
  if (change > 2) score += 10;

  score = Math.max(0, Math.min(100, score));

  return {
    ticker: q.symbol,
    name: q.shortName || q.symbol,
    price,
    change,
    score
  };
});

rows.sort((a, b) => b.score - a.score);

render(rows.slice(0, 10), rows);

status.innerText = "Live (fast mode)";
} catch (e) {
status.innerText = “Error loading data”;
console.error(e);
}
}

function render(top10, all) {
table.innerHTML = top10.map((r, i) => <tr> <td>${i + 1}</td> <td><strong>${r.ticker}</strong></td> <td>${r.name}</td> <td>$${r.price.toFixed(2)}</td> <td>${r.change.toFixed(2)}%</td> <td><strong>${r.score.toFixed(1)}</strong></td> </tr>).join(””);

topTicker.innerText = top10[0]?.ticker || “-”;
avgScore.innerText = (all.reduce((s, x) => s + x.score, 0) / all.length).toFixed(1);
}

// Auto refresh
loadData();
setInterval(loadData, 60000);
:::


