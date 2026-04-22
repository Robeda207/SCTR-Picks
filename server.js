async function scrapeTop10Sctr() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 1400 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
  });

  try {
    await page.goto("https://stockcharts.com/freecharts/sctr.html", {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(5000);

    const html = await page.content();
    console.log("Rendered HTML length:", html.length);
    console.log(html.slice(0, 4000));

    const rows = await page.evaluate(() => {
      const clean = (v) => (v || "").replace(/\s+/g, " ").trim();
      const toNumber = (v) => {
        const n = Number(String(v).replace(/[^\d.-]/g, ""));
        return Number.isFinite(n) ? n : null;
      };

      const candidates = [];

      const rowGroups = [
        ...document.querySelectorAll("table tr"),
        ...document.querySelectorAll('[role="row"]'),
        ...document.querySelectorAll(".ag-row"),
        ...document.querySelectorAll("tbody tr"),
        ...document.querySelectorAll("div")
      ];

      for (const row of rowGroups) {
        const texts = Array.from(row.querySelectorAll("td, [role='gridcell'], div, span"))
          .map((el) => clean(el.textContent))
          .filter(Boolean);

        if (texts.length < 5) continue;

        const ticker = texts.find((t) => /^[A-Z.\-]{1,10}$/.test(t)) || "";
        const sctr = texts.map(toNumber).find((n) => n !== null && n >= 0 && n <= 100);

        if (!ticker || sctr === undefined || sctr === null) continue;

        const tickerIndex = texts.indexOf(ticker);
        const companyName = texts[tickerIndex + 1] || "";
        const sector = texts[tickerIndex + 2] || "";
        const industry = texts[tickerIndex + 3] || "";

        if (!companyName) continue;

        candidates.push({
          ticker,
          companyName,
          sector,
          industry,
          sctr
        });
      }

      const seen = new Set();
      const unique = [];

      for (const row of candidates) {
        if (seen.has(row.ticker)) continue;
        seen.add(row.ticker);
        unique.push(row);
      }

      return unique
        .sort((a, b) => b.sctr - a.sctr)
        .slice(0, 10)
        .map((row, index) => ({ rank: index + 1, ...row }));
    });

    console.log("Rows found:", rows);

    if (!rows.length) {
      throw new Error(
        "No SCTR rows were found. The page loaded, but the rankings were not present in the rendered DOM."
      );
    }

    return rows;
  } finally {
    await page.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
