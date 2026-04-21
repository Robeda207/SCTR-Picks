const tableBody = document.getElementById("tableBody");
const meta = document.getElementById("meta");
const errorBox = document.getElementById("errorBox");
const refreshBtn = document.getElementById("refreshBtn");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setLoading() {
  errorBox.classList.add("hidden");
  tableBody.innerHTML = `
    <tr>
      <td colspan="6" class="loading-cell">Loading current rankings…</td>
    </tr>
  `;
}

function setError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
  tableBody.innerHTML = `
    <tr>
      <td colspan="6" class="loading-cell">Unable to load data.</td>
    </tr>
  `;
}

function renderRows(rows) {
  tableBody.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>${row.rank}</td>
          <td class="ticker">${escapeHtml(row.ticker)}</td>
          <td>${escapeHtml(row.companyName)}</td>
          <td>${Number(row.sctr).toFixed(2)}</td>
          <td>${escapeHtml(row.sector || "—")}</td>
          <td>${escapeHtml(row.industry || "—")}</td>
        </tr>
      `
    )
    .join("");
}

async function loadData(forceRefresh = false) {
  setLoading();

  try {
    const url = forceRefresh ? `/api/sctr?ts=${Date.now()}` : "/api/sctr";
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || "Request failed");
    }

    renderRows(data.rows || []);

    const fetchedText = data.fetchedAt
      ? new Date(data.fetchedAt).toLocaleString()
      : "Unknown";

    meta.textContent = `Source: ${data.source} · Fetched: ${fetchedText}${data.cached ? " · cached" : ""}`;
  } catch (error) {
    setError(error instanceof Error ? error.message : "Unknown error");
    meta.textContent = "Source unavailable";
  }
}

refreshBtn.addEventListener("click", () => loadData(true));
loadData();
