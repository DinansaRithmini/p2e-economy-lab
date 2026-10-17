// Run with:  node check-app.js     (inside the p2e-app folder)
// Tests the chart helpers and the app's own logic, using the real simulation engine.

const assert = require("assert");
const { extent, scaleX, scaleY, linePath, bandPath, formatNumber } = require("./engine/chartMath");
const { suggestFix, describeFix, confidenceBand, scaledDown } = require("./engine/advisor");
const { DEFAULT_SETTINGS, POPULATIONS, NOTICE, PRESETS, HELP, explainResult, resilience, buildConfig, runDesign, normalise, summarise, verdict, describeStress, describeConfig, alignSeries } = require("./engine/appLogic");

const results = [];
function check(label, fn) {
  try { fn(); console.log("PASS - " + label); results.push(true); }
  catch (e) { console.log("FAIL - " + label + "\n   " + e.message); results.push(false); }
}
const run = (patch) => summarise(runDesign(buildConfig({ ...DEFAULT_SETTINGS, ...patch })));
const strong = { sinkRate: 0.5, burnRate: 0.3 };

console.log("--- Charts ---");
const box = { left: 10, top: 5, width: 100, height: 50 };
check("a line from 0 to 10 starts bottom-left and ends top-right", () => assert.strictEqual(linePath([0, 10], 0, 10, box), "M10.0 55.0 L110.0 5.0"));
check("the highest value sits at the top, the lowest at the bottom", () => { assert.strictEqual(scaleY(10, 0, 10, 5, 50), 5); assert.strictEqual(scaleY(0, 0, 10, 5, 50), 55); });
check("points are spread evenly left to right", () => { assert.strictEqual(scaleX(0, 5, 10, 100), 10); assert.strictEqual(scaleX(2, 5, 10, 100), 60); assert.strictEqual(scaleX(4, 5, 10, 100), 110); });
check("forced min and max are respected", () => assert.deepStrictEqual(extent([40, 60], 0, 100), { min: 0, max: 100 }));
check("a flat line still gets a range", () => { const e = extent([5, 5, 5]); assert.ok(e.max > e.min); });
check("axis labels are short and readable", () => {
  for (const [v, s] of [[1500000, "1.5M"], [12345, "12k"], [1234, "1.2k"], [861, "861"], [3.333, "3.33"], [0.0941, "0.094"], [0, "0"], [50, "50"], [100, "100"]]) assert.strictEqual(formatNumber(v), s);
});

console.log("--- Settings and controls ---");
check("player mix sliders always become shares that add up to 1", () => {
  const n = normalise({ casual: 40, grinder: 35, investor: 15, whale: 40 });
  assert.ok(Math.abs(n.casual + n.grinder + n.investor + n.whale - 1) < 1e-9);
});
check("all-zero mix falls back to the default mix", () => assert.deepStrictEqual(normalise({ casual: 0, grinder: 0, investor: 0, whale: 0 }), { casual: 0.4, grinder: 0.35, investor: 0.15, whale: 0.1 }));
check("settings are passed to the engine unchanged (FT-01)", () => {
  const c = buildConfig({ ...DEFAULT_SETTINGS, faucet: 1.2, sinkRate: 0.45, burnRate: 0.1, newPlayers: 35, days: 90, stress: "whale" });
  assert.strictEqual(c.faucetMultiplier, 1.2); assert.strictEqual(c.sinkRate, 0.45); assert.strictEqual(c.burnRate, 0.1);
  assert.strictEqual(c.newPlayersPerDay, 35); assert.strictEqual(c.days, 90);
  assert.deepStrictEqual(c.stress, { type: "whale_withdrawal", day: 20, fraction: 0.2 });
});

console.log("--- Simulation results as the screens will show them ---");
check("default design: price 0.094, 861 players, score 44 Warning, no alert", () => {
  const s = run({});
  assert.strictEqual(s.price.toFixed(3), "0.094"); assert.strictEqual(s.active, 861);
  assert.strictEqual(Math.round(s.score), 44); assert.strictEqual(s.band, "Warning"); assert.strictEqual(s.alertDay, null);
});
check("strong design: price 0.221, 1318 players, score 89 Sustainable", () => {
  const s = run(strong);
  assert.strictEqual(s.price.toFixed(3), "0.221"); assert.strictEqual(s.active, 1318);
  assert.strictEqual(Math.round(s.score), 89); assert.strictEqual(s.band, "Sustainable");
});
check("Whale withdrawal on the default design fires the alert on day 22 (FT-04)", () => {
  const s = run({ stress: "whale" });
  assert.strictEqual(s.alertDay, 22); assert.strictEqual(s.active, 805); assert.strictEqual(s.price.toFixed(3), "0.092");
});
check("Whale withdrawal on the strong design: alert on day 22, still Sustainable", () => {
  const s = run({ ...strong, stress: "whale" });
  assert.strictEqual(s.alertDay, 22); assert.strictEqual(s.band, "Sustainable"); assert.strictEqual(s.active, 976);
});
check("fewer new players leaves the default design with 728 players, no alert", () => {
  const s = run({ stress: "fewer" });
  assert.strictEqual(s.active, 728); assert.strictEqual(s.alertDay, null);
});
check("a 30-day run with a stress test still works", () => assert.strictEqual(runDesign(buildConfig({ ...DEFAULT_SETTINGS, days: 30, stress: "whale" })).history.length, 30));

console.log("--- Comparison screen (FT-05, UT-04) ---");
const weak = run({}), strongRun = run(strong), weakFewer = run({ stress: "fewer" });
check("verdict says the strong design is MORE sustainable", () => assert.strictEqual(verdict(weak, strongRun), "The current run is MORE sustainable: it scores 45 points higher (89 vs 44)."));
check("verdict says the reverse when the runs are swapped", () => assert.strictEqual(verdict(strongRun, weak), "The current run is LESS sustainable: it scores 45 points lower (44 vs 89)."));
check("verdict says 'about the same' for scores within 5 points", () => assert.strictEqual(verdict(weak, weakFewer), "The two runs score about the same (43 vs 44)."));
check("stress tests are described in plain words", () => {
  assert.strictEqual(describeStress(null), "no stress test");
  assert.strictEqual(describeStress({ type: "whale_withdrawal", day: 20, fraction: 0.2 }), "Whale withdrawal (20%) on day 20");
  assert.strictEqual(describeStress({ type: "acquisition_drop", day: 20, fraction: 0.5 }), "50% fewer new players from day 20");
});
check("the default settings are described correctly", () =>
  assert.strictEqual(describeConfig(buildConfig(DEFAULT_SETTINGS)), "60 days · 1000 starting players · rewards 100% · sink 30% · burn 0% · 20 new players a day · no stress test"));
check("runs of different lengths are cut to the days they share", () => {
  const [a, b] = alignSeries(new Array(90).fill(1), new Array(60).fill(2));
  assert.strictEqual(a.length, 60); assert.strictEqual(b.length, 60);
});

console.log("--- Starting players and notice ---");
check("population choices are 100, 500 and 1000, default 1000", () => {
  assert.deepStrictEqual(POPULATIONS, [100, 500, 1000]); assert.strictEqual(DEFAULT_SETTINGS.population, 1000);
});
check("chosen population is passed to the engine (PT-01)", () =>
  assert.strictEqual(buildConfig({ ...DEFAULT_SETTINGS, population: 100 }).agents, 100));
check("a 100-player, 90-day run works and starts near 100 players", () => {
  const r = runDesign(buildConfig({ ...DEFAULT_SETTINGS, population: 100, days: 90 }));
  assert.strictEqual(r.history.length, 90);
  assert.ok(r.history[0].active >= 100 && r.history[0].active <= 130, "day 1 had " + r.history[0].active);
});
check("the default 1000-player results are unchanged by the new setting", () => {
  const s = run({ population: 1000 });
  assert.strictEqual(s.active, 861); assert.strictEqual(Math.round(s.score), 44);
});
check("the notice says the app is not financial advice", () => assert.ok(/not financial or investment advice/.test(NOTICE)));

console.log("--- Suggest a fix (optimiser) ---");
const cfg = (patch) => buildConfig({ ...DEFAULT_SETTINGS, ...patch });
const fixDefault = suggestFix(cfg({}));
check("default design: a fix is found and is Sustainable when re-run at full size", () => {
  assert.strictEqual(fixDefault.status, "found");
  const again = summarise(runDesign({ ...cfg({}), sinkRate: fixDefault.sinkRate, burnRate: fixDefault.burnRate }));
  assert.strictEqual(again.band, "Sustainable"); assert.strictEqual(again.score, fixDefault.result.score);
});
check("the fix is written as one plain sentence", () =>
  assert.strictEqual(describeFix(fixDefault, cfg({})), "Raise fixed burn from 0% to 30%. The score becomes 83 (Sustainable)."));
check("an already Sustainable design needs no fix", () => assert.strictEqual(suggestFix(cfg(strong)).status, "already"));
check("a fix is found even under the Whale withdrawal stress test", () => {
  const f = suggestFix(cfg({ stress: "whale" }));
  assert.strictEqual(f.status, "found"); assert.strictEqual(f.result.band, "Sustainable");
});
check("the search screens on a 100-player copy with new players scaled to match", () => {
  const small = scaledDown(cfg({}));
  assert.strictEqual(small.agents, 100); assert.strictEqual(small.newPlayersPerDay, 2);
  assert.strictEqual(scaledDown(cfg({ population: 100 })).agents, 100);
});

console.log("--- Check uncertainty (confidence bands) ---");
const bandDefault = confidenceBand(cfg({}));
check("10 runs give a low, middle and high score for every day", () => {
  assert.strictEqual(bandDefault.runs, 10); assert.strictEqual(bandDefault.median.length, 60);
  for (let d = 0; d < 60; d++) assert.ok(bandDefault.low[d] <= bandDefault.median[d] && bandDefault.median[d] <= bandDefault.high[d]);
});
check("default design is Warning in 10 of 10 runs; strong design Sustainable in 10 of 10", () => {
  assert.strictEqual(bandDefault.bandCounts.Warning, 10);
  assert.strictEqual(confidenceBand(cfg(strong)).bandCounts.Sustainable, 10);
});
check("the same design always gives the same range", () =>
  assert.deepStrictEqual(confidenceBand(cfg({})).final, bandDefault.final));
check("the shaded band is a closed shape around both lines", () => {
  const d = bandPath([1, 2, 3], [4, 5, 6], 0, 10, box);
  assert.ok(d.startsWith("M") && d.endsWith(" Z")); assert.strictEqual((d.match(/[ML]/g) || []).length, 6);
});
check("the varied runs do not change the normal single run", () => assert.strictEqual(Math.round(run({}).score), 44));

console.log("--- Black swan stress test and resilience ---");
const swanWeak = runDesign(cfg({ stress: "blackswan" }));
const swanStrong = runDesign(cfg({ ...strong, stress: "blackswan" }));
check("black swan: on day 20 the price falls by at least half and about 30% of players leave", () => {
  const h = swanWeak.history;
  assert.ok(h[19].price <= 0.5 * h[18].price, "price " + h[18].price + " -> " + h[19].price);
  assert.ok(h[19].active <= 0.75 * h[18].active && h[19].active >= 0.6 * h[18].active, "players " + h[18].active + " -> " + h[19].active);
});
check("black swan on the weak design: alert on day 22, ends in Death Spiral (33)", () => {
  const s = summarise(swanWeak);
  assert.strictEqual(s.alertDay, 22); assert.strictEqual(s.band, "Death Spiral"); assert.strictEqual(Math.round(s.score), 33);
});
check("black swan on the strong design: damage is limited (55, Warning) but not prevented", () => {
  const s = summarise(swanStrong);
  assert.strictEqual(Math.round(s.score), 55); assert.strictEqual(s.band, "Warning");
  assert.ok(s.score > summarise(swanWeak).score);
});
check("resilience: the strong design is back in Sustainable 1 day after a Whale withdrawal", () => {
  const r = resilience(runDesign(cfg({ ...strong, stress: "whale" })));
  assert.strictEqual(r.daysToRecover, 1); assert.strictEqual(r.finalBand, "Sustainable"); assert.strictEqual(Math.round(r.lowest), 62);
});
check("resilience: with fewer new players the strong design never leaves Sustainable", () => {
  const r = resilience(runDesign(cfg({ ...strong, stress: "fewer" })));
  assert.strictEqual(r.daysToRecover, 0); assert.strictEqual(r.endsInBand, true);
});
check("Suggest a fix never suggests a design that scores lower than the current one", () => {
  const f = suggestFix(cfg({ ...strong, stress: "blackswan" }));
  assert.strictEqual(f.status, "none"); assert.ok(f.result.score >= f.current.score);
});
check("the black swan is described in plain words", () =>
  assert.strictEqual(describeStress({ type: "black_swan", day: 20, priceDrop: 0.5, leave: 0.3, panicSell: 0.2 }), "Black swan on day 20 (price -50%, 30% of players leave)"));

console.log("--- Presets, help and plain summary ---");
check("every preset stays inside the slider ranges", () => {
  for (const p of PRESETS) {
    const x = p.settings;
    assert.ok(x.faucet >= 0.5 && x.faucet <= 1.5 && x.sinkRate >= 0 && x.sinkRate <= 0.5 && x.burnRate >= 0 && x.burnRate <= 0.3 && x.newPlayers >= 0 && x.newPlayers <= 60, p.id);
  }
});
check("the Axie-like preset is the default design, Balanced is the strong design", () => {
  const axie = PRESETS.find((p) => p.id === "axie").settings, bal = PRESETS.find((p) => p.id === "balanced").settings;
  assert.strictEqual(axie.sinkRate, DEFAULT_SETTINGS.sinkRate); assert.strictEqual(axie.burnRate, DEFAULT_SETTINGS.burnRate); assert.deepStrictEqual(axie.mix, DEFAULT_SETTINGS.mix);
  assert.strictEqual(bal.sinkRate, strong.sinkRate); assert.strictEqual(bal.burnRate, strong.burnRate);
});
check("plain summary of the default design: Warning 44, about 11 coins per coin removed, Grinders quit around day 56", () => {
  const lines = explainResult(runDesign(cfg({})));
  assert.ok(lines[0].includes("Warning band, with a score of 44"));
  assert.ok(lines.some((l) => l.includes("about 11 coins for every coin it removes")));
  assert.ok(lines.some((l) => l.includes("day 56")));
  assert.ok(lines[lines.length - 1].includes("Suggest a fix"));
});
check("plain summary of the strong design says Sustainable and suggests a stress test", () => {
  const lines = explainResult(runDesign(cfg(strong)));
  assert.ok(lines[0].includes("Sustainable band")); assert.ok(lines[lines.length - 1].includes("stress test"));
});
check("plain summary mentions the alert when it fires", () =>
  assert.ok(explainResult(runDesign(cfg({ stress: "whale" }))).some((l) => l.includes("Death Spiral Alert fired on day 22"))));
check("every setting has a help text", () => {
  for (const k of ["faucet", "sinkRate", "burnRate", "newPlayers", "mix", "days", "population", "stress"]) assert.ok(HELP[k] && HELP[k].length > 20, k);
});

console.log(results.every(Boolean) ? "\nAll " + results.length + " checks passed." : "\nSome checks FAILED.");
process.exit(results.every(Boolean) ? 0 : 1);
