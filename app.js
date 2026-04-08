:::writing{variant=“standard” id=“20003”}
let data = JSON.parse(localStorage.getItem(“sctrData”)) || [];
let sortKey = “sctr”;
let asc = false;

function importCSV() {
const text = document.getElementById(“csvInput”).value.trim();
const rows = text.split(”\n”);

data = rows.map(r => {
const [ticker, name, type, sctr, price, volume] = r.split(”,”);
return {
ticker: ticker?.toUpperCase(),
name,
type,
sctr: parseFloat(sctr),
price: parseFloat(price),
volume: parseFloat(volume)
};
}).filter(r => r.ticker);

save();
}

function applyFilters() {
render();
}

function save() {
localStorage.setItem(“sctrData”, JSON.stringify(data));
render();
}

function sortBy(key) {
if (sortKey === key) asc = !asc;
else {
sortKey = key;
asc = key === “ticker”;
}
render();
}

function render() {
let filtered = […data];

const minSctr = +document.getElementById(“minSctr”).value;
const minPrice = +document.getElementById(“minPrice”).value;
const minVolume = +document.getElementById(“minVolume”).value;

filtered = filtered.filter(x =>
x.sctr >= minSctr &&
x.price >= minPrice &&
x.volume >= minVolume
);

filtered.sort((a, b) => {
if (typeof a[sortKey] === “string”) {
return asc
? a[sortKey].localeCompare(b[sortKey])
: b[sortKey].localeCompare(a[sortKey]);
}
return asc
? a[sortKey] - b[sortKey]
: b[sortKey] - a[sortKey];
});

const table = document.getElementById(“table”);
table.innerHTML = “”;

filtered.forEach(row => {
table.innerHTML += <tr> <td>${row.ticker}</td> <td>${row.sctr.toFixed(1)}</td> <td>$${row.price}</td> <td>${row.volume.toLocaleString()}</td> <td>${row.type}</td> </tr>;
});

document.getElementById(“count”).innerText = filtered.length;

const avg = filtered.length
? (filtered.reduce((s, x) => s + x.sctr, 0) / filtered.length).toFixed(1)
: 0;

document.getElementById(“avg”).innerText = avg;
document.getElementById(“top”).innerText = filtered[0]?.ticker || “-”;
}

render();
:::
