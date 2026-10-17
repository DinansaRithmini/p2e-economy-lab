// Extra validation (run with:  node extra_validation.js)
//   Part A: a spreadsheet-style model (no player feedback) against the real SLP collapse
//   Part B: accuracy over every day of the 90-day window (MAPE, RMSE, correlation)
//   Part C: real coin supply (market cap / price) against the simulated supply
//   Part D: the Death Spiral Alert rule applied to the real price and trading volume

const fs = require("fs");
const { runSimulation, defaultConfig, ARCHETYPES } = require("./simulation");

// ---- real data ----
// Options: node extra_validation.js [--data file.csv] [--start YYYY-MM-DD] [out.json]
// Default: SLP, collapse window starting at the highest close of August 2021.
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : null; };
const DATA = opt("--data") || "data/slp_price.csv";
const START = opt("--start");
const lines = fs.readFileSync(DATA, "utf8").trim().split("\n");
const head = lines[0].split(",");
const col = (name) => head.indexOf(name);
const real = lines.slice(1).map((l) => {
  const c = l.split(",");
  return { date: c[col("event_date")].slice(0, 10), price: parseFloat(c[col("close_price_usd")]), cap: +c[col("market_cap_usd")], volume: +c[col("volume_usd")] };
}).filter((d) => !isNaN(d.price));
const august = real.filter((d) => d.date.startsWith("2021-08"));
const start = START ? real.find((d) => d.date === START) : august.reduce((b, d) => (d.price > b.price ? d : b));
const si = real.findIndex((d) => d.date === start.date);
const DAYS = 90;
const pct = (x) => (x * 100).toFixed(0) + "%";
const realIndex = Array.from({ length: DAYS + 1 }, (_, d) => real[si + d].price / start.price);   // 1 = start price

// ---- the agent-based model (default design) ----
const sim = runSimulation({ ...defaultConfig, days: DAYS });
const abmIndex = [1, ...sim.map((d) => d.price / defaultConfig.startPrice)];

// ---- Part A: spreadsheet-style model ----
// What a static tokenomics spreadsheet does: the same players, earnings, sinks and selling,
// but nobody reacts to the price (no quitting, no panic, no change in sinks or new players),
// and the price simply follows dilution: a fixed total value spread over a growing supply.
function spreadsheetModel(config, days) {
  const mix = config.mix;
  let players = {};
  for (const t of Object.keys(mix)) players[t] = config.agents * mix[t];
  let supply = 0;
  for (const t of Object.keys(players)) supply += players[t] * ARCHETYPES[t].startBalance;
  const supply0 = supply;
  const index = [1];
  const supplies = [supply];
  for (let day = 1; day <= days; day++) {
    let faucet = 0;
    for (const t of Object.keys(players)) faucet += players[t] * ARCHETYPES[t].playProb * ARCHETYPES[t].earnPerDay * (config.faucetMultiplier ?? 1);
    const sink = faucet * Math.min(1, config.sinkRate + config.burnRate);   // fixed share, never changes
    supply += faucet - sink;
    for (const t of Object.keys(players)) players[t] += config.newPlayersPerDay * mix[t];   // steady growth, no quitting
    index.push(supply0 / supply);   // dilution: fixed total value / growing supply
    supplies.push(supply);
  }
  return { index, supplies };
}
const sheet = spreadsheetModel(defaultConfig, DAYS);

const change = (index, d) => index[d] - 1;
const gap = (sim, realV) => Math.abs(sim - realV) / Math.abs(realV);

console.log("Data:", DATA, "| collapse window starts", start.date, "at $" + start.price.toFixed(4));
console.log("Real change if the start date moves:", [-10, -5, 0, 5, 10].map((k) => real[si + k].date + " " + pct(real[si + k + DAYS].price / real[si + k].price - 1)).join(" | "));
let big = 0; for (let d = 1; d <= DAYS; d++) if (Math.abs(real[si + d].price / real[si + d - 1].price - 1) > 0.1) big++;
console.log("Real daily moves over 10% in the window:", big, "of", DAYS);
console.log("\nPART A: price change since the start of the collapse");
console.table([30, 60, 90].map((d) => ({
  day: d, real: pct(change(realIndex, d)),
  agentModel: pct(change(abmIndex, d)), agentGap: pct(gap(change(abmIndex, d), change(realIndex, d))),
  spreadsheet: pct(change(sheet.index, d)), sheetGap: pct(gap(change(sheet.index, d), change(realIndex, d))),
})));

// ---- Part B: accuracy over every day ----
function fit(model) {
  let ape = 0, se = 0;
  const n = DAYS;
  for (let d = 1; d <= n; d++) {
    ape += Math.abs(model[d] - realIndex[d]) / realIndex[d];
    se += (model[d] - realIndex[d]) ** 2;
  }
  const xs = realIndex.slice(1), ys = model.slice(1);
  const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  return { MAPE: (100 * ape / n).toFixed(1) + "%", RMSE_points: (100 * Math.sqrt(se / n)).toFixed(1), correlation: (sxy / Math.sqrt(sxx * syy)).toFixed(3) };
}
console.log("PART B: fit over all 90 days (price as a share of its start value)");
console.table({ agentModel: fit(abmIndex), spreadsheet: fit(sheet.index) });

// ---- Part C: real coin supply against simulated supply ----
const realSupply = (d) => real[si + d].cap / real[si + d].price;
const simSupply = (d) => (d === 0 ? sim[0].supply : sim[d - 1].supply);
console.log("PART C: coins in circulation, growth since the start of the window");
console.table([30, 60, 90].map((d) => ({
  day: d,
  realSupplyM: (realSupply(d) / 1e6).toFixed(0) + "M",
  realGrowth: pct(realSupply(d) / realSupply(0) - 1),
  agentModelGrowth: pct(simSupply(d) / simSupply(0) - 1),
  spreadsheetGrowth: pct(sheet.supplies[d] / sheet.supplies[0] - 1),
})));
console.log("Real supply at start:", (realSupply(0) / 1e6).toFixed(0) + "M coins; after 90 days:", (realSupply(90) / 1e6).toFixed(0) + "M");

// ---- Part D: the alert rule on real data ----
// Same rule as the app: price down 15% or more over 7 days AND selling up week on week,
// 3 days in a row. Real "selling" is approximated by trading volume (7-day averages).
function realAlerts(from, to) {
  const days = [];
  let streak = 0;
  for (let i = from; i <= to; i++) {
    const priceChange = real[i].price / real[i - 7].price - 1;
    const avg = (a, b) => { let s = 0; for (let k = a; k <= b; k++) s += real[k].volume; return s / (b - a + 1); };
    const volumeChange = avg(i - 6, i) / avg(i - 13, i - 7) - 1;
    if (priceChange <= -0.15 && volumeChange > 0) streak++; else streak = 0;
    if (streak === 3) days.push({ date: real[i].date, priceWeek: pct(priceChange), volumeWeek: pct(volumeChange) });
  }
  return days;
}
const fired = realAlerts(14, real.length - 1);
console.log("PART D: days the alert rule would have fired on the real data (first day of each streak of 3)");
console.table(fired);
const inWindow = fired.filter((f) => f.date >= start.date && real.findIndex((d) => d.date === f.date) <= si + DAYS);
console.log("In the 90-day collapse window:", inWindow.length, "| first:", inWindow[0] ? inWindow[0].date : "none");

// Optional: save the three series for charts  (node extra_validation.js out.json)
if (args[0]) fs.writeFileSync(args[0], JSON.stringify({ real: realIndex, agent: abmIndex, sheet: sheet.index }));
