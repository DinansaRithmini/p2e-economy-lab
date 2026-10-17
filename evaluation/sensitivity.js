// Step 12: sensitivity test.   Run with:  node sensitivity.js
//
// The archetype numbers are PLACEHOLDERS, not measured from wallets. So we ask:
// if every important number were up to 20% off, would our CONCLUSIONS change?
//   Question 1: does the strong design still score higher than the weak design?
//   Question 2: how much does the simulated 90-day price fall move around?

const fs = require("fs");
const { runSimulation, defaultConfig, ARCHETYPES, makeRng } = require("./simulation");
const { scoreHistory } = require("./scoring");

// ---- Real 90-day price change from the collapse start (same rule as calibrate.js) ----
const lines = fs.readFileSync("data/slp_price.csv", "utf8").trim().split("\n");
const header = lines[0].split(",");
const real = lines.slice(1).map((l) => {
  const c = l.split(",");
  return { date: c[header.indexOf("event_date")].slice(0, 10), price: parseFloat(c[header.indexOf("close_price_usd")]) };
});
const august = real.filter((d) => d.date.startsWith("2021-08"));
const start = august.reduce((b, d) => (d.price > b.price ? d : b));
const si = real.findIndex((d) => d.date === start.date);
const REAL_90 = real[si + 90].price / start.price - 1;

// ---- Tools to temporarily change the archetype numbers, then put them back ----
const original = JSON.parse(JSON.stringify(ARCHETYPES));
function resetArchetypes() {
  for (const t of Object.keys(original)) Object.assign(ARCHETYPES[t], original[t]);
}
function scaleField(field, factor) {
  for (const t of Object.keys(ARCHETYPES)) {
    if (field in original[t]) {
      let v = original[t][field] * factor;
      if (field === "playProb") v = Math.min(1, v);
      ARCHETYPES[t][field] = v;
    }
  }
}

const strongDesign = { sinkRate: 0.5, burnRate: 0.3 };

// factors = { earnPerDay, sellFrac, playProb, minUsdPerDay, priceImpact, newPlayersPerDay, seed }
function evaluate(factors, seed = defaultConfig.seed) {
  try {
    scaleField("earnPerDay", factors.earnPerDay ?? 1);
    scaleField("sellFrac", factors.sellFrac ?? 1);
    scaleField("playProb", factors.playProb ?? 1);
    scaleField("minUsdPerDay", factors.minUsdPerDay ?? 1);
    const tweak = {
      seed,
      priceImpact: defaultConfig.priceImpact * (factors.priceImpact ?? 1),
      newPlayersPerDay: defaultConfig.newPlayersPerDay * (factors.newPlayersPerDay ?? 1),
    };
    const weak90 = runSimulation({ ...defaultConfig, ...tweak, days: 90 });
    const weakScore = scoreHistory(weak90)[59].score;                   // day 60 of the same run
    const strongScore = scoreHistory(runSimulation({ ...defaultConfig, ...tweak, ...strongDesign })).pop().score;
    return { weakScore, strongScore, gap: strongScore - weakScore, fall90: weak90[89].price / defaultConfig.startPrice - 1 };
  } finally {
    resetArchetypes();
  }
}

const pct = (x) => (100 * x).toFixed(0) + "%";

// ---- Part 1: change ONE number at a time by -20% and +20% ----
const names = ["earnPerDay", "sellFrac", "playProb", "minUsdPerDay", "priceImpact", "newPlayersPerDay"];
const base = evaluate({});
const table = [{ changed: "nothing (base)", weak: base.weakScore.toFixed(0), strong: base.strongScore.toFixed(0), gap: base.gap.toFixed(0), strongWins: "yes", fall90: pct(base.fall90) }];
let oneAtATimeWins = 0, oneAtATimeTotal = 0;
for (const name of names) {
  for (const f of [0.8, 1.2]) {
    const r = evaluate({ [name]: f });
    oneAtATimeTotal++;
    if (r.gap > 0) oneAtATimeWins++;
    table.push({ changed: name + (f < 1 ? " -20%" : " +20%"), weak: r.weakScore.toFixed(0), strong: r.strongScore.toFixed(0), gap: r.gap.toFixed(0), strongWins: r.gap > 0 ? "yes" : "NO", fall90: pct(r.fall90) });
  }
}
console.log("PART 1: one number changed at a time (real 90-day fall was " + pct(REAL_90) + ")");
console.table(table);
console.log("Strong design beat the weak design in " + oneAtATimeWins + " of " + oneAtATimeTotal + " one-at-a-time changes.\n");

// ---- Part 2: change ALL the numbers at once, randomly within +-20%, with a random seed ----
const RUNS = 200;
const rng = makeRng(2024);
const draw = () => 0.8 + 0.4 * rng();
const gaps = [], falls = [];
for (let i = 0; i < RUNS; i++) {
  const r = evaluate(
    { earnPerDay: draw(), sellFrac: draw(), playProb: draw(), minUsdPerDay: draw(), priceImpact: draw(), newPlayersPerDay: draw() },
    1 + Math.floor(rng() * 100000)
  );
  gaps.push(r.gap); falls.push(r.fall90);
}
const sorted = (a) => a.slice().sort((x, y) => x - y);
const q = (a, p) => sorted(a)[Math.min(a.length - 1, Math.floor(p * a.length))];
const wins = gaps.filter((g) => g > 0).length;
const within20 = falls.filter((f) => Math.abs(f - REAL_90) / Math.abs(REAL_90) <= 0.2).length;

console.log("PART 2: " + RUNS + " runs, every number randomly +-20% at once, random seed each time");
console.log("Strong design beat the weak design in " + wins + " of " + RUNS + " runs");
console.log("Score gap (strong minus weak): lowest " + q(gaps, 0).toFixed(0) + ", median " + q(gaps, 0.5).toFixed(0) + ", highest " + q(gaps, 0.999).toFixed(0));
console.log("Simulated 90-day price fall: 10th percentile " + pct(q(falls, 0.9)) + ", median " + pct(q(falls, 0.5)) + ", 90th percentile " + pct(q(falls, 0.1)) +
  "   (real: " + pct(REAL_90) + ")");
console.log("Runs within 20% of the real 90-day fall: " + within20 + " of " + RUNS);