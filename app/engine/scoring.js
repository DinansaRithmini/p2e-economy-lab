// P2E Economy Lab - Sustainability Score (Step 8) and Death Spiral Alert (Step 9)
// Turns three indicators into one 0-100 number, and watches for a collapse in progress.
// All weights and thresholds are DEFAULTS, to be refined during calibration.

const weights = { velocity: 0.3, faucetSink: 0.4, concentration: 0.3 };
const bands = { sustainable: 80, caution: 60, warning: 40 };   // below 40 = Death Spiral

// Death Spiral Alert settings (defaults, refined during calibration)
const alertSettings = { priceDrop: -0.15, cashOutRise: 0.10, consecutiveDays: 3, window: 7 };

// Faucet-to-Sink: best at 1 (balanced). Too many faucets (inflation) is punished
// harder than too many sinks.
function faucetSinkScore(r) {
  return r >= 1 ? Math.max(0, 100 - 25 * (r - 1)) : Math.max(0, 100 - 20 * (1 - r));
}

// Velocity: healthy inside a band. Too low = stagnant, too high = speculative churn.
function velocityScore(v) {
  const lo = 0.005, hi = 0.03;
  if (v < lo) return (100 * v) / lo;
  if (v <= hi) return 100;
  return Math.max(0, 100 - (100 * (v - hi)) / 0.07);
}

// Concentration: holdings are always unequal in a P2E economy, so a Gini of 0.8
// or below scores full marks and 1.0 scores zero.
function concentrationScore(g) {
  return Math.max(0, Math.min(100, 100 * (1 - Math.max(0, g - 0.8) / 0.2)));
}

function bandFor(score) {
  if (score >= bands.sustainable) return "Sustainable";
  if (score >= bands.caution) return "Caution";
  if (score >= bands.warning) return "Warning";
  return "Death Spiral";
}

// The Sustainability Score for one day of simulation history
function scoreDay(day) {
  const parts = {
    velocity: velocityScore(day.velocity),
    faucetSink: faucetSinkScore(day.faucetToSink),
    concentration: concentrationScore(day.gini),
  };
  const score =
    weights.velocity * parts.velocity +
    weights.faucetSink * parts.faucetSink +
    weights.concentration * parts.concentration;
  return { score, band: bandFor(score), parts };
}

function scoreHistory(history) {
  return history.map((d) => ({ day: d.day, ...scoreDay(d) }));
}


// ---- Step 9: Death Spiral Alert ----
// The score says how healthy the economy is TODAY. The alert says it is SLIDING:
// the price is falling AND more people are cashing out, several days in a row.
// The cash-out rate is a 7-day average, so one panicky day still counts but
// ordinary day-to-day noise does not.
function averageCashOut(history, i, window) {
  let sum = 0;
  for (let k = i - window + 1; k <= i; k++) sum += history[k].cashOutRate;
  return sum / window;
}

function detectDeathSpiral(history) {
  const a = alertSettings;
  let streak = 0;
  for (let i = 2 * a.window - 1; i < history.length; i++) {
    const priceChange = history[i].price / history[i - a.window].price - 1;
    const cashOutChange =
      averageCashOut(history, i, a.window) - averageCashOut(history, i - a.window, a.window);
    if (priceChange <= a.priceDrop && cashOutChange >= a.cashOutRise) streak++;
    else streak = 0;
    if (streak >= a.consecutiveDays) return { triggered: true, day: history[i].day };
  }
  return { triggered: false, day: null };
}

module.exports = { faucetSinkScore, velocityScore, concentrationScore, scoreHistory, detectDeathSpiral };