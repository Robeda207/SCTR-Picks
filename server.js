import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

const STOCKCHARTS_URL = "https://stockcharts.com/freecharts/sctr.html";

app.use(express.static(path.join(__dirname, "public")));

let cache = {
  rows: null,
  fetchedAt: 0
};

const CACHE_MS = 5 * 60 * 1000;

async function scrapeTop10Sctr() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

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

    // Wait for JS-rendered content
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(5000);

    const rows = await page.evaluate(() => {
      const clean = (v) => (v || "").replace(/\s+/g, " ").trim();
      const toNumber = (v) => {
        const n = Number(String(v).replace(/[^\d.-]/g, ""));
        return Number.isFinite(n) ? n : null;
      };

      const parsed = [];

      const tableRows = Array.from(document.querySelectorAll("table tr"));

      for (const row of tableRows) {
        const cells = Array.from(row.querySelectorAll("td"));
        if (cells.length < 5) continue;

        const texts = cells.map((c) => clean(c.textContent));

        const ticker = texts[0];
        const companyName = texts[1];
        const sector = texts[2];
        const industry = texts[3];
        const sctr = toNumber(texts[4]);

        if (!ticker || !companyName || sctr === null) continue;
        if (!/^[A-Z.\-]{1,10}$/.test(ticker)) continue;

        parsed.push({ ticker, companyName, sector, industry, sctr });
      }

      const seen = new Set();
      const unique = [];

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
        "No SCTR rows found. Page likely blocked or structure changed."
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

    if (cache.rows && now - cache.fetchedAt < CACHE_MS) {
      return res.json({
        source: STOCKCHARTS_URL,
        cached: true,
        fetchedAt: new Date(cache.fetchedAt).toISOString(),
        rows: cache.rows
      });
    }

    const rows = await scrapeTop10Sctr();

    cache = {
      rows,
      fetchedAt: now
    };

    return res.json({
      source: STOCKCHARTS_URL,
      cached: false,
      fetchedAt: new Date(now).toISOString(),
      rows
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SCTR app running on port ${PORT}`);
});
