const API_KEY_STORAGE = "alphaVantageApiKey";

const UNIVERSE = [
  { ticker: "NVDA", name: "NVIDIA", type: "Stock" },
  { ticker: "MSFT", name: "Microsoft", type: "Stock" },
  { ticker: "META", name: "Meta Platforms", type: "Stock" },
  { ticker: "AMZN", name: "Amazon", type: "Stock" },
  { ticker: "AVGO", name: "Broadcom", type: "Stock" },
  { ticker: "PLTR", name: "Palantir", type: "Stock" },
  { ticker: "TSLA", name: "Tesla", type: "Stock" },
  { ticker: "NFLX", name: "Netflix", type: "Stock" },
  { ticker: "LLY", name: "Eli Lilly", type: "Stock" },
  { ticker: "JPM", name: "JPMorgan Chase", type: "Stock" },
  { ticker: "QQQ", name: "Invesco QQQ Trust", type: "ETF" },
  { ticker: "SPY", name: "SPDR S&P 500 ETF", type: "ETF" },
  { ticker: "XLK", name: "Technology Select Sector SPDR", type: "ETF" },
  { ticker: "SMH", name: "VanEck Semiconductor ETF", type: "ETF" },
  { ticker: "SOXX", name: "iShares Semiconductor ETF", type: "ETF" }
];

const apiKeyInput = document.getElementById("apiKey");
const saveKeyBtn = document.getElementById("saveKeyBtn");
const refreshBtn = document.getElementById("refreshBtn");
const resultsBody = document.getElementById("resultsBody");
const statusText = document.getElementById("statusText");
const universeSize = document.getElementById("universeSize");
const topTicker = document.getElementById("topTicker");
const avgScore = document.getElementById("avgScore");

apiKeyInput.value = localStorage.getItem(API_KEY_STORAGE) || "";
universeSize.textContent = UNIVERSE.length;

saveKeyBtn.addEventListener("click", () => {
  localStorage.setItem(API_KEY_STORAGE, apiKeyInput.value.trim());
  statusText.textContent = "API key saved.";
});

refreshBtn.addEventListener("click", async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    statusText.textContent = "Please enter your Alpha Vantage API key.";
    return;
  }

  localStorage.setItem(API_KEY_STORAGE, key);
  statusText.textContent = "Loading data... this can take a bit.";
  refreshBtn.disabled = true;

  try {
    const rows = [];

    for (let i = 0; i < UNIVERSE.length; i++) {
      const item = UNIVERSE[i];
      statusText.textContent = `Loading ${item.ticker} (${i + 1}/${UNIVERSE.length})...`;

      const series = await fetchDailyAdjusted(item.ticker, key);
      const metrics = calculateMetrics(series);

      if (metrics) {
        rows.push({
          ...item,
          ...metrics
        });
      }

      // Gentle pause for API rate limits
      await sleep(13000);
    }

    rows.sort((a, b) => b.score - a.score);
    render(rows.slice(0, 10), rows);
    statusText.textContent = "Done.";
  } catch (error) {
    console.error(error);
    statusText.textContent = "Error loading data. Check your API key and try again later.";
  } finally {
    refreshBtn.disabled = false;
  }
});

async function fetchDailyAdjusted(ticker, apiKey) {
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(
    ticker
  )}&outputsize=full&apikey=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data["Error Message"]) {
    throw new Error(`Alpha Vantage error for ${ticker}`);
  }

  if (data["Note"]) {
    throw new Error(`Rate limit hit while fetching ${ticker}`);
  }

  const rawSeries = data["Time Series (Daily)"];
  if (!rawSeries) return null;

  const entries = Object.entries(rawSeries)
    .map(([date, values]) => ({
      date,
      close: Number(values["5. adjusted close"])
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return entries;
}

function calculateMetrics(series) {
  if (!series || series.length < 210) return null;

  const closes = series.map(x => x.close);
  const latest = closes[closes.length - 1];
  const close20 = closes[closes.length - 21];
  const close50 = closes[closes.length - 51];
  const sma50 = average(closes.slice(-50));
  const sma200 = average(closes.slice(-200));

  const ret20 = ((latest / close20) - 1) * 100;
  const ret50 = ((latest / close50) - 1) * 100;
  const above200 = latest > sma200;

  // Proxy score: trend + medium momentum + short momentum
  let score = 0;

  // 20-day momentum contribution
  score += clamp(ret20, -20, 20) * 1.5;

  // 50-day momentum contribution
  score += clamp(ret50, -30, 30) * 1.2;

  // Trend contribution
  if (latest > sma50) score += 12;
  if (latest > sma200) score += 18;
  if (sma50 > sma200) score += 20;

  // Normalize roughly to 0-100
  score = Math.max(0, Math.min(100, score + 25));

  return {
    price: latest,
    ret20,
    ret50,
    above200,
    score
  };
}

function render(top10, allRows) {
  resultsBody.innerHTML = top10
    .map((row, index) => {
      return `
        <tr>
          <td><span class="rank-badge">${index + 1}</span></td>
          <td><strong>${row.ticker}</strong></td>
          <td>${row.name}</td>
          <td>${row.type}</td>
          <td>$${row.price.toFixed(2)}</td>
          <td>${row.ret20.toFixed(1)}%</td>
          <td>${row.ret50.toFixed(1)}%</td>
          <td class="${row.above200 ? "up-yes" : "up-no"}">${row.above200 ? "Yes" : "No"}</td>
          <td><strong>${row.score.toFixed(1)}</strong></td>
        </tr>
      `;
    })
    .join("");

  topTicker.textContent = top10.length ? top10[0].ticker : "—";
  avgScore.textContent = allRows.length
    ? (allRows.reduce((sum, row) => sum + row.score, 0) / allRows.length).toFixed(1)
    : "0.0";
}

function average(arr) {
  return arr.reduce((sum, x) => sum + x, 0) / arr.length;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
