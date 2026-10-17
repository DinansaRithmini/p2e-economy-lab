// Step 11: compare the simulation with the REAL SLP price collapse.
// Run with:  node calibrate.js
// Needs the file  data/slp_price.csv  (columns: event_date, close_price_usd, ...)

const fs = require("fs");
const { runSimulation, defaultConfig } = require("./simulation");

// ---- 1. Load the real prices ----
function loadPrices(file) {
  const lines = fs.readFileSync(file, "utf8").trim().split("\n");
  const header = lines[0].split(",");
  const dateCol = header.indexOf("event_date");
  const priceCol = header.indexOf("close_price_usd");
  return lines.slice(1).map((line) => {
    const cells = line.split(",");
    return { date: cells[dateCol].slice(0, 10), price: parseFloat(cells[priceCol]) };
  });
}
const real = loadPrices("data/slp_price.csv");
const pct = (x) => (100 * x).toFixed(0) + "%";

// ---- 2. Basic facts about the real data ----
const peak = real.reduce((best, d) => (d.price > best.price ? d : best));
const last = real[real.length - 1];
console.log("Real SLP data:", real.length, "days,", real[0].date, "to", last.date);
console.log("Highest close:", peak.date, "at", peak.price.toFixed(4));
console.log("Final close:  ", last.date, "at", last.price.toFixed(5), "(" + pct(last.price / peak.price - 1) + " from the highest close)");

// ---- 3. The real "sustained collapse" window ----
// JUDGEMENT CALL (say this in your dissertation): the start of the sustained slide is
// taken as the highest close in August 2021, the last major high before the long decline.
const august = real.filter((d) => d.date.startsWith("2021-08"));
const start = august.reduce((best, d) => (d.price > best.price ? d : best));
const startIndex = real.findIndex((d) => d.date === start.date);
console.log("\nCollapse window starts:", start.date, "at", start.price.toFixed(4));

// ---- 4. Real vs simulated: price change after 30, 60 and 90 days ----
const sim = runSimulation({ ...defaultConfig, days: 90 });
const simChange = (day) => sim[day - 1].price / defaultConfig.startPrice - 1;
const realChange = (day) => real[startIndex + day].price / start.price - 1;

console.log("\nPrice change since the start of the collapse");
console.table(
  [30, 60, 90].map((day) => ({
    day,
    real: pct(realChange(day)),
    simulated: pct(simChange(day)),
    gap: ((Math.abs(simChange(day) - realChange(day)) / Math.abs(realChange(day))) * 100).toFixed(0) + "% of the real fall",
  }))
);

// ---- 5. Is the 90-day target fragile? Try start dates a few days either side ----
console.log("Real 90-day change if the start date is moved by a few days:");
console.table(
  [-10, -5, 0, 5, 10].map((shift) => {
    const i = startIndex + shift;
    return { startDate: real[i].date, change90: pct(real[i + 90].price / real[i].price - 1) };
  })
);

// ---- 6. How noisy is the real price? (the simulation is much smoother) ----
const moves = real.slice(startIndex + 1).map((d, i) => d.price / real[startIndex + i].price - 1);
const bigMoves = moves.filter((m) => Math.abs(m) > 0.1).length;
console.log("Real daily moves bigger than 10% since the start of the collapse:", bigMoves, "of", moves.length, "days");