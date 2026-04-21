import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

const STOCKCHARTS_URL = "https://stockcharts.com/freecharts/sctr.html";

let cache = {
  data: null,
  fetchedAt: 0
};

const CACHE_MS = 5 * 60 * 1000;

async function scrapeTop10Sctr() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1200 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  });

  try {
    await page.goto(STOCKCHARTS_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    // The SCTR page requires JavaScript to populate the data table.
    // We wait for visible table rows or fail clearly.
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});

    const rows = await page.evaluate(() => {
      const clean = (value) => (value || "").replace(/\s+/g, " ").trim();
      const toNumber = (value) => {
        const n = Number(String(value).replace(/[^\d.-]/g, ""));
        return Number.isFinite(n) ? n : null;
      };

      // Try a few generic selectors because StockCharts may change markup.
      const tableRows = Array.from(document.querySelectorAll("table tr"));

      const parsed = [];

      for (const row of tableRows) {
        const cells = Array.from(row.querySelectorAll("td"));
        if (cells.length < 5) continue;

        const cellTexts = cells.map((cell) => clean(cell.textContent));

        // Expected public table columns usually include:
        // Symbol | Name | Sector | Industry | SCTR | Chg | Last | Volume | Market Cap
        const ticker = cellTexts[0] || "";
        const companyName = cellTexts[1] || "";
        const sector = cellTexts[2] || "";
        const industry = cellTexts[3] || "";
        const sctr = toNumber(cellTexts[4]);

        const looksLikeTicker = /^[A-Z.\-]{1,10}$/.test(ticker);

        if (!looksLikeTicker || !companyName || sctr === null) continue;

        parsed.push({
          ticker,
          companyName,
          sector,
          industry,
          sctr
        });
      }

      const unique = [];
      const seen = new Set();

      for (const row of parsed) {
        if (seen.has(row.ticker)) continue;
        seen.add(row.ticker);
        unique.push(row);
      }

      return unique
        .sort((a, b) => b.sctr - a.sctr)
        .slice(0, 10)
        .map((row, index) => ({
          rank: index + 1,
          ...row
        }));
    });

    if (!rows.length) {
      throw new Error(
        "No SCTR rows were found. StockCharts may have changed its markup or blocked automated browsing."
      );
    }

    return rows;
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

app.get("/api/sctr", async (_req, res) => {
  try {
    const now = Date.now();

    if (cache.data && now - cache.fetchedAt < CACHE_MS) {
      return res.json({
        source: STOCKCHARTS_URL,
        cached: true,
        fetchedAt: new Date(cache.fetchedAt).toISOString(),
        rows: cache.data
      });
    }

    const rows = await scrapeTop10Sctr();

    cache = {
      data: rows,
      fetchedAt: now
    };

    return res.json({
      source: STOCKCHARTS_URL,
      cached: false,
      fetchedAt: new Date(now).toISOString(),
      rows
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`SCTR app running on http://localhost:${PORT}`);
});
