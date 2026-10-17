// Run with:  node check.js
// Compares your results with the expected numbers and prints PASS or FAIL.

const assert = require("assert");
const { runSimulation, defaultConfig } = require("./simulation");
const { scoreHistory, detectDeathSpiral } = require("./scoring");

const DAYS = [1, 10, 20, 30, 40, 50, 60];
const results = [];

function check(label, actual, expected) {
  try {
    assert.deepStrictEqual(actual, expected);
    console.log("PASS - " + label);
    results.push(true);
  } catch (e) {
    console.log("FAIL - " + label);
    console.log("   expected: " + JSON.stringify(expected));
    console.log("   you got:  " + JSON.stringify(actual));
    results.push(false);
  }
}

// ---- Step 8: Sustainability Score ----
function scoresFor(config) {
  const scores = scoreHistory(runSimulation(config));
  return DAYS.map((d) => Math.round(scores[d - 1].score));
}
const strongConfig = { ...defaultConfig, sinkRate: 0.5, burnRate: 0.3 };
const weak = scoresFor(defaultConfig);
const strong = scoresFor(strongConfig);

check("weak design scores   65 56 50 51 51 51 44", weak, [65, 56, 50, 51, 51, 51, 44]);
check("strong design scores 85 93 91 91 90 90 89", strong, [85, 93, 91, 91, 90, 90, 89]);
check("strong design beats weak design on every checked day", strong.every((s, i) => s > weak[i]), true);

// ---- Step 9: Death Spiral Alert (hand-made histories, so you can reason about them) ----
const make = (n, price, cash) =>
  Array.from({ length: n }, (_, i) => ({ day: i + 1, price: price(i + 1), cashOutRate: cash(i + 1) }));

check("alert: crash (price -5%/day + cash-outs jump) fires on day 19",
  detectDeathSpiral(make(30, (d) => (d <= 14 ? 1 : 1 - 0.05 * (d - 14)), (d) => (d <= 14 ? 0.5 : 1.5))),
  { triggered: true, day: 19 });
check("alert: calm economy does not fire",
  detectDeathSpiral(make(30, () => 1, () => 0.5)).triggered, false);
check("alert: price falls but cash-outs stay flat does not fire",
  detectDeathSpiral(make(30, (d) => (d <= 14 ? 1 : 1 - 0.05 * (d - 14)), () => 0.5)).triggered, false);
check("alert: cash-outs jump but price is flat does not fire",
  detectDeathSpiral(make(30, () => 1, (d) => (d <= 14 ? 0.5 : 1.5))).triggered, false);
check("alert: a one-day blip does not fire",
  detectDeathSpiral(make(30, (d) => (d === 20 ? 0.7 : 1), (d) => (d === 20 ? 3 : 0.5))).triggered, false);

// ---- Step 9: the alert on the real simulation (no shock, so no alert expected) ----
check("alert: weak design (slow decline, no shock) does not fire",
  detectDeathSpiral(runSimulation(defaultConfig)).triggered, false);
check("alert: strong design does not fire",
  detectDeathSpiral(runSimulation(strongConfig)).triggered, false);

// ---- Step 10: stress tests ----
const whaleShock = { type: "whale_withdrawal", day: 20, fraction: 0.2 };
const fewerPlayers = { type: "acquisition_drop", day: 20, fraction: 0.5 };
const weakWhale = runSimulation({ ...defaultConfig, stress: whaleShock });
const strongWhale = runSimulation({ ...strongConfig, stress: whaleShock });

check("stress: Whale withdrawal on the weak design fires the alert on day 22",
  detectDeathSpiral(weakWhale), { triggered: true, day: 22 });
check("stress: Whale withdrawal drops the weak design to Death Spiral (score 21 on day 20)",
  Math.round(scoreHistory(weakWhale)[19].score), 21);
check("stress: Whale withdrawal on the strong design also fires the alert on day 22",
  detectDeathSpiral(strongWhale), { triggered: true, day: 22 });
check("stress: strong design dips on day 20 (score 62) and recovers (score 85 on day 40)",
  [Math.round(scoreHistory(strongWhale)[19].score), Math.round(scoreHistory(strongWhale)[39].score)], [62, 85]);
check("stress: 50% fewer new players leaves the weak design with fewer players (728 vs 861)",
  [runSimulation({ ...defaultConfig, stress: fewerPlayers })[59].active, runSimulation(defaultConfig)[59].active], [728, 861]);
check("stress: strong design survives 50% fewer new players (still Sustainable, 1058 players)",
  [scoreHistory(runSimulation({ ...strongConfig, stress: fewerPlayers })).pop().band,
   runSimulation({ ...strongConfig, stress: fewerPlayers })[59].active], ["Sustainable", 1058]);

console.log(results.every(Boolean) ? "\nAll " + results.length + " checks passed." : "\nSome checks FAILED.");
process.exit(results.every(Boolean) ? 0 : 1);