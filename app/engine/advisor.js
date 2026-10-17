// The "advice" features: Suggest a fix (optimiser) and Check uncertainty (confidence bands).
// No React in here, so they can be tested in Node.

const { runSimulation, ARCHETYPES, makeRng } = require("./simulation");
const { scoreHistory, detectDeathSpiral } = require("./scoring");
const { runDesign, summarise } = require("./appLogic");

// ---- Suggest a fix ----
// Search sink strength (0-50%) and fixed burn (0-30%) in 5% steps for the SMALLEST change
// that makes the design Sustainable. Everything else in the design stays the same.
const SINKS = Array.from({ length: 11 }, (_, i) => Math.round(i * 5) / 100);   // 0, 0.05 ... 0.5
const BURNS = Array.from({ length: 7 }, (_, i) => Math.round(i * 5) / 100);    // 0, 0.05 ... 0.3
const SCREEN_POPULATION = 100;   // quick screening runs use a 100-player copy of the economy
const SCREEN_MARGIN = 75;        // screened designs scoring at least this are checked at full size
const MAX_FULL_CHECKS = 8;

// The same economy, shrunk to 100 starting players with new players scaled to match
function scaledDown(config) {
  if (config.agents <= SCREEN_POPULATION) return config;
  const k = SCREEN_POPULATION / config.agents;
  return { ...config, agents: SCREEN_POPULATION, newPlayersPerDay: config.newPlayersPerDay * k };
}

const sizeOfChange = (c, config) => Math.abs(c.sinkRate - config.sinkRate) + Math.abs(c.burnRate - config.burnRate);

function suggestFix(config) {
  const started = Date.now();
  const current = summarise(runDesign(config));
  if (current.band === "Sustainable") {
    return { status: "already", current, screened: 0, fullChecks: 1, ms: Date.now() - started };
  }

  // 1. Screen every combination on the small copy (fast)
  const screened = [];
  for (const sinkRate of SINKS) {
    for (const burnRate of BURNS) {
      if (sinkRate === config.sinkRate && burnRate === config.burnRate) continue;
      const quick = summarise(runDesign(scaledDown({ ...config, sinkRate, burnRate })));
      screened.push({ sinkRate, burnRate, quickScore: quick.score });
    }
  }

  // 2. Check the most promising ones at full size, smallest change first
  const promising = screened
    .filter((c) => c.quickScore >= SCREEN_MARGIN)
    .sort((a, b) => sizeOfChange(a, config) - sizeOfChange(b, config) || a.burnRate - b.burnRate || a.sinkRate - b.sinkRate);
  let fullChecks = 1;
  for (const c of promising.slice(0, MAX_FULL_CHECKS)) {
    fullChecks++;
    const full = summarise(runDesign({ ...config, sinkRate: c.sinkRate, burnRate: c.burnRate }));
    if (full.band === "Sustainable") {
      return { status: "found", sinkRate: c.sinkRate, burnRate: c.burnRate, result: full, current, screened: screened.length, fullChecks, ms: Date.now() - started };
    }
  }

  // 3. Nothing reached Sustainable: report the best design found instead
  const best = screened.slice().sort((a, b) => b.quickScore - a.quickScore)[0];
  fullChecks++;
  const bestFull = summarise(runDesign({ ...config, sinkRate: best.sinkRate, burnRate: best.burnRate }));
  if (bestFull.score <= current.score) {
    // nothing beats the current design: say so rather than suggest a worse one
    return { status: "none", sinkRate: config.sinkRate, burnRate: config.burnRate, result: current, current, screened: screened.length, fullChecks, ms: Date.now() - started };
  }
  return { status: "none", sinkRate: best.sinkRate, burnRate: best.burnRate, result: bestFull, current, screened: screened.length, fullChecks, ms: Date.now() - started };
}

const pct = (x) => Math.round(x * 100) + "%";

function change(label, from, to) {
  if (from === to) return null;
  return (to > from ? "raise " : "lower ") + label + " from " + pct(from) + " to " + pct(to);
}

// One plain sentence for the dashboard
function describeFix(fix, config) {
  if (fix.status === "already") return "This design is already Sustainable, so no change is needed.";
  const steps = [change("sink strength", config.sinkRate, fix.sinkRate), change("fixed burn", config.burnRate, fix.burnRate)].filter(Boolean);
  const what = steps.join(" and ");
  const score = Math.round(fix.result.score) + " (" + fix.result.band + ")";
  if (fix.status === "found") return what[0].toUpperCase() + what.slice(1) + ". The score becomes " + score + ".";
  if (!what) return "No sink or burn setting makes this design Sustainable or scores higher than it does now, " + score +
    ". Try smaller rewards or fewer new players.";
  return "No sink or burn setting makes this design Sustainable. The best found is to " + what + ", which scores " + score +
    ". Try smaller rewards or fewer new players.";
}

// ---- Check uncertainty ----
// Run the same design several times. Each run uses a different random seed AND changes the
// behaviour settings (earnings, selling, playing, Grinder threshold, price impact, new players)
// by up to +-20%, as in the sensitivity analysis. The result is a range, not one number.
const VARY = 0.2;

function varied(config, rng) {
  const draw = () => 1 - VARY + 2 * VARY * rng();
  const f = { earnPerDay: draw(), sellFrac: draw(), playProb: draw(), minUsdPerDay: draw(), priceImpact: draw(), newPlayers: draw() };
  const archetypes = {};
  for (const [type, rules] of Object.entries(ARCHETYPES)) {
    archetypes[type] = { ...rules };
    for (const field of ["earnPerDay", "sellFrac", "playProb", "minUsdPerDay"]) {
      if (field in rules) archetypes[type][field] = field === "playProb" ? Math.min(1, rules[field] * f[field]) : rules[field] * f[field];
    }
  }
  return {
    ...config,
    archetypes,
    seed: 1 + Math.floor(rng() * 100000),
    priceImpact: config.priceImpact * f.priceImpact,
    newPlayersPerDay: config.newPlayersPerDay * f.newPlayers,
  };
}

function quantile(sorted, p) {
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

const bandOf = (score) => (score >= 80 ? "Sustainable" : score >= 60 ? "Caution" : score >= 40 ? "Warning" : "Death Spiral");

function confidenceBand(config, runs = 10) {
  const started = Date.now();
  const rng = makeRng(2024);   // fixed, so the same design always gives the same range
  const daily = [];            // daily[run] = scores for every day
  const finals = [];
  const bandCounts = { Sustainable: 0, Caution: 0, Warning: 0, "Death Spiral": 0 };
  let alertRuns = 0;
  for (let r = 0; r < runs; r++) {
    const history = runSimulation(varied(config, rng));
    const scores = scoreHistory(history).map((s) => s.score);
    daily.push(scores);
    const final = scores[scores.length - 1];
    finals.push(final);
    bandCounts[bandOf(final)]++;
    if (detectDeathSpiral(history).triggered) alertRuns++;
  }
  const days = daily[0].length;
  const low = [], high = [], median = [];
  for (let d = 0; d < days; d++) {
    const s = daily.map((run) => run[d]).sort((a, b) => a - b);
    low.push(quantile(s, 0.1)); median.push(quantile(s, 0.5)); high.push(quantile(s, 0.9));
  }
  const sf = finals.slice().sort((a, b) => a - b);
  return {
    runs, low, high, median, bandCounts, alertRuns,
    final: { low: quantile(sf, 0.1), median: quantile(sf, 0.5), high: quantile(sf, 0.9) },
    ms: Date.now() - started,
  };
}

// One plain sentence for the dashboard
function describeBand(band) {
  const r = (x) => Math.round(x);
  const most = Object.entries(band.bandCounts).sort((a, b) => b[1] - a[1])[0];
  return "Likely score " + r(band.final.low) + "–" + r(band.final.high) + " (middle " + r(band.final.median) + "). " +
    most[0] + " in " + most[1] + " of " + band.runs + " runs; Death Spiral Alert in " + band.alertRuns + " of " + band.runs + ".";
}

module.exports = { suggestFix, describeFix, confidenceBand, describeBand, scaledDown, SINKS, BURNS };
