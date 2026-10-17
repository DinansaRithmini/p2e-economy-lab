// The "thinking" of the app, kept separate from the screens so it can be tested in Node.

const { runSimulation, defaultConfig } = require("./simulation");
const { scoreHistory, detectDeathSpiral } = require("./scoring");

// What the Configure screen starts with
const DEFAULT_SETTINGS = {
  days: 60,
  population: 1000,   // starting players: 100, 500 or 1000
  faucet: 1,
  sinkRate: 0.3,
  burnRate: 0,
  newPlayers: 20,
  mix: { casual: 40, grinder: 35, investor: 15, whale: 10 },
  stress: "none",   // "none", "whale" or "fewer"
};

// Starting population choices on the Configure screen
const POPULATIONS = [100, 500, 1000];

// Shown on the Configure and Dashboard screens (Section 3.12 of the report)
const NOTICE = "For design testing only. This is not financial or investment advice.";

// The stress tests from the proposal: Whales cash out 20%, or 50% fewer new players
const STRESS = {
  none: null,
  whale: { type: "whale_withdrawal", day: 20, fraction: 0.2 },
  fewer: { type: "acquisition_drop", day: 20, fraction: 0.5 },
  // A black swan: a sudden crash from outside the game (e.g. a hack): price -50%, 30% of players leave
  blackswan: { type: "black_swan", day: 20, priceDrop: 0.5, leave: 0.3, panicSell: 0.2 },
};

// One-tap starting points on the Configure screen
const PRESETS = [
  { id: "axie", title: "Axie-like (2021)", text: "Strong rewards, weak sinks: the default design",
    settings: { faucet: 1, sinkRate: 0.3, burnRate: 0, newPlayers: 20, mix: { casual: 40, grinder: 35, investor: 15, whale: 10 } } },
  { id: "balanced", title: "Balanced design", text: "Stronger sinks and a fixed burn",
    settings: { faucet: 1, sinkRate: 0.5, burnRate: 0.3, newPlayers: 20, mix: { casual: 40, grinder: 35, investor: 15, whale: 10 } } },
  { id: "fast", title: "Fast rewards (GST-like)", text: "Very generous rewards, almost no sinks",
    settings: { faucet: 1.5, sinkRate: 0.1, burnRate: 0, newPlayers: 20, mix: { casual: 40, grinder: 35, investor: 15, whale: 10 } } },
  { id: "survey", title: "Survey player mix", text: "Player mix reported by 40 real P2E players",
    settings: { faucet: 1, sinkRate: 0.3, burnRate: 0, newPlayers: 20, mix: { casual: 25, grinder: 48, investor: 18, whale: 10 } } },
];

// Plain-language help shown under the (i) button of each setting
const HELP = {
  faucet: "How many coins players earn for playing (the faucet). 100% is the standard reward.",
  sinkRate: "The share of earnings players spend on upgrades, breeding or items. Spent coins disappear. Players spend less when the coin is cheap.",
  burnRate: "A fee taken from every reward and destroyed, whatever the price. Unlike sinks, it keeps working in a crisis.",
  newPlayers: "How many people join each day. Fewer join when the price falls. Scale it with the number of starting players.",
  mix: "Casual: plays for fun. Grinder: plays every day for income and quits if it earns under $3 a day. Investor: buys when the price rises and leaves after a 15% weekly fall. Whale: holds many coins and panic-sells in a crash.",
  days: "How many days to simulate, one day at a time.",
  population: "How many players the economy starts with.",
  stress: "A shock on day 20, to see whether the design survives it and how fast it recovers.",
};

// The first day on which a player type falls below half of its highest number (null if it never does)
function collapseDay(history, type) {
  let peak = 0;
  for (const h of history) {
    peak = Math.max(peak, h.activeByType[type]);
    if (peak >= 20 && h.activeByType[type] < peak / 2) return h.day;
  }
  return null;
}

// A short, plain explanation of a run for the top of the dashboard
function explainResult(result) {
  const h = result.history;
  const last = h[h.length - 1];
  const final = result.scores[result.scores.length - 1];
  const change = Math.round((last.price / result.config.startPrice - 1) * 100);
  const ratio = last.faucetToSink;
  const lines = [];
  lines.push("This economy ends in the " + final.band + " band, with a score of " + Math.round(final.score) + " out of 100.");
  if (ratio >= 2) lines.push("It creates about " + Math.round(ratio) + " coins for every coin it removes, so each coin keeps losing value: the price changed " + change + "% over " + result.config.days + " days.");
  else if (ratio > 1.2) lines.push("It creates slightly more coins than it removes (" + ratio.toFixed(1) + " to 1), so the price drifts down (" + change + "%).");
  else lines.push("Coins created and removed are roughly balanced (" + ratio.toFixed(1) + " to 1); the price changed " + change + "%.");
  const grinders = collapseDay(h, "grinder");
  if (grinders !== null) lines.push("Most Grinders quit around day " + grinders + ", when playing no longer paid enough.");
  if (result.alert.triggered) lines.push("A Death Spiral Alert fired on day " + result.alert.day + ": the price fell fast while more players cashed out.");
  lines.push(final.band === "Sustainable"
    ? "Next: try a stress test to see how it copes with a shock."
    : "Next: open Advice and tap Suggest a fix to find the smallest change that makes it sustainable.");
  return lines;
}

// Turn the four mix sliders (any numbers) into shares that add up to 1
function normalise(mix) {
  const total = mix.casual + mix.grinder + mix.investor + mix.whale;
  if (total === 0) return { casual: 0.4, grinder: 0.35, investor: 0.15, whale: 0.1 };
  return {
    casual: mix.casual / total,
    grinder: mix.grinder / total,
    investor: mix.investor / total,
    whale: mix.whale / total,
  };
}

// Turn the screen settings into an engine config
function buildConfig(settings) {
  return {
    ...defaultConfig,
    days: settings.days,
    agents: settings.population ?? defaultConfig.agents,
    faucetMultiplier: settings.faucet,
    sinkRate: settings.sinkRate,
    burnRate: settings.burnRate,
    newPlayersPerDay: settings.newPlayers,
    mix: normalise(settings.mix),
    stress: STRESS[settings.stress],
  };
}

// Run one design and keep everything the dashboard needs
function runDesign(config) {
  const started = Date.now();
  const history = runSimulation(config);
  const elapsed = Date.now() - started;
  return { config, history, scores: scoreHistory(history), alert: detectDeathSpiral(history), elapsed };
}

const pct = (x) => Math.round(x * 100) + "%";

function describeStress(stress) {
  if (!stress) return "no stress test";
  if (stress.type === "whale_withdrawal") return "Whale withdrawal (" + pct(stress.fraction) + ") on day " + stress.day;
  if (stress.type === "black_swan") return "Black swan on day " + stress.day + " (price -" + pct(stress.priceDrop) + ", " + pct(stress.leave) + " of players leave)";
  return pct(stress.fraction) + " fewer new players from day " + stress.day;
}

function describeConfig(config) {
  const faucet = config.faucetMultiplier === undefined ? 1 : config.faucetMultiplier;
  return (
    config.days + " days · " + config.agents + " starting players · rewards " + pct(faucet) + " · sink " + pct(config.sinkRate) + " · burn " + pct(config.burnRate) +
    " · " + config.newPlayersPerDay + " new players a day · " + describeStress(config.stress)
  );
}

// The numbers shown side by side on the comparison screen
function summarise(result) {
  const last = result.history[result.history.length - 1];
  const finalScore = result.scores[result.scores.length - 1];
  return {
    days: result.config.days,
    score: finalScore.score,
    band: finalScore.band,
    price: last.price,
    priceChange: last.price / result.config.startPrice - 1,
    active: last.active,
    supply: last.supply,
    faucetToSink: last.faucetToSink,
    alertDay: result.alert.triggered ? result.alert.day : null,
  };
}

// How well the design survives a stress test: the lowest score after the shock, how many days it
// takes to get back to the band it was in the day before the shock, and where it ends up
const BAND_FLOOR = { Sustainable: 80, Caution: 60, Warning: 40, "Death Spiral": 0 };
function resilience(result) {
  const stress = result.config.stress;
  if (!stress) return null;
  const scores = result.scores;
  const before = scores[stress.day - 2];               // the day before the shock
  if (!before) return null;
  const floor = BAND_FLOOR[before.band];
  let low = scores[stress.day - 1];
  for (let i = stress.day - 1; i < scores.length; i++) if (scores[i].score < low.score) low = scores[i];
  let recoveredDay = null;
  if (low.score >= floor) recoveredDay = stress.day;    // never left the band
  else for (let i = stress.day - 1; i < scores.length; i++) {
    if (scores[i].day > low.day && scores[i].score >= floor) { recoveredDay = scores[i].day; break; }
  }
  const last = scores[scores.length - 1];
  return {
    shockDay: stress.day, before: before.score, beforeBand: before.band,
    lowest: low.score, lowestBand: low.band, lowestDay: low.day,
    recoveredDay, daysToRecover: recoveredDay === null ? null : recoveredDay - stress.day,
    final: last.score, finalBand: last.band, endsInBand: last.score >= floor,
  };
}

function describeResilience(r) {
  if (!r) return "";
  const n = (x) => Math.round(x);
  const days = (d) => d + (d === 1 ? " day" : " days");
  let text = "Before the shock: " + n(r.before) + " (" + r.beforeBand + "). Lowest after it: " + n(r.lowest) + " (" + r.lowestBand + ") on day " + r.lowestDay + ".";
  if (r.daysToRecover === 0) text += " It stayed in the " + r.beforeBand + " band.";
  else if (r.recoveredDay !== null) text += " It was back in the " + r.beforeBand + " band " + days(r.daysToRecover) + " after the shock.";
  else text += " It never got back to the " + r.beforeBand + " band.";
  text += r.endsInBand ? " It ends the run at " + n(r.final) + " (" + r.finalBand + ")." : " It ends the run lower, at " + n(r.final) + " (" + r.finalBand + ").";
  return text;
}

// One plain sentence saying which run is more sustainable
function verdict(base, current) {
  const diff = current.score - base.score;
  const scores = "(" + Math.round(current.score) + " vs " + Math.round(base.score) + ")";
  if (Math.abs(diff) < 5) return "The two runs score about the same " + scores + ".";
  const points = Math.round(Math.abs(diff)) + " points";
  return diff > 0
    ? "The current run is MORE sustainable: it scores " + points + " higher " + scores + "."
    : "The current run is LESS sustainable: it scores " + points + " lower " + scores + ".";
}

// If the two runs have different lengths, compare only the days they share
function alignSeries(a, b) {
  const n = Math.min(a.length, b.length);
  return [a.slice(0, n), b.slice(0, n)];
}

module.exports = { DEFAULT_SETTINGS, POPULATIONS, NOTICE, STRESS, PRESETS, HELP, explainResult, collapseDay, resilience, describeResilience, normalise, buildConfig, runDesign, describeStress, describeConfig, summarise, verdict, alignSeries };
