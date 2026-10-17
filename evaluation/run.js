// Run with:  node run.js
const { runSimulation, defaultConfig } = require("./simulation");
const { faucetSinkScore, velocityScore, concentrationScore, scoreHistory, detectDeathSpiral } = require("./scoring");

// ---- Test 1: each indicator turned into a 0-100 score (check these by hand) ----
console.log("Indicator -> score");
console.table([
  { indicator: "Faucet-to-Sink 1.0",  score: faucetSinkScore(1).toFixed(1) },
  { indicator: "Faucet-to-Sink 2.0",  score: faucetSinkScore(2).toFixed(1) },
  { indicator: "Faucet-to-Sink 3.33", score: faucetSinkScore(3.33).toFixed(1) },
  { indicator: "Faucet-to-Sink 10.58", score: faucetSinkScore(10.58).toFixed(1) },
  { indicator: "Velocity 0.02",       score: velocityScore(0.02).toFixed(1) },
  { indicator: "Velocity 0.002",      score: velocityScore(0.002).toFixed(1) },
  { indicator: "Gini 0.80",           score: concentrationScore(0.8).toFixed(1) },
  { indicator: "Gini 0.87",           score: concentrationScore(0.87).toFixed(1) },
  { indicator: "Gini 1.00",           score: concentrationScore(1).toFixed(1) },
]);

// ---- Test 2: score a weak design and a strong design over 60 days ----
function show(name, config) {
  const history = runSimulation(config);
  const scores = scoreHistory(history);
  console.log("\n" + name);
  console.table(
    [1, 10, 20, 30, 40, 50, 60].map((d) => ({
      day: d,
      price: history[d - 1].price.toFixed(3),
      faucetToSink: history[d - 1].faucetToSink.toFixed(2),
      score: scores[d - 1].score.toFixed(0),
      band: scores[d - 1].band,
    }))
  );
}

const weakConfig = defaultConfig;
const strongConfig = { ...defaultConfig, sinkRate: 0.5, burnRate: 0.3 };
show("WEAK design (sink 30%, no burn)", weakConfig);
show("STRONG design (sink 50%, burn 30%)", strongConfig);

// ---- Test 3 (Step 9): does the Death Spiral Alert fire? ----
function alertText(a) {
  return a.triggered ? "TRIGGERED on day " + a.day : "not triggered";
}
console.log("\nDeath Spiral Alert");
console.log("weak design:   " + alertText(detectDeathSpiral(runSimulation(weakConfig))));
console.log("strong design: " + alertText(detectDeathSpiral(runSimulation(strongConfig))));

// ---- Test 4 (Step 10): stress tests ----
const whaleShock = { type: "whale_withdrawal", day: 20, fraction: 0.2 };   // Whales cash out 20% on day 20
const fewerPlayers = { type: "acquisition_drop", day: 20, fraction: 0.5 }; // 50% fewer new players from day 20

const scenarios = [
  ["weak, no stress", weakConfig],
  ["weak + Whale withdrawal", { ...weakConfig, stress: whaleShock }],
  ["weak + 50% fewer new players", { ...weakConfig, stress: fewerPlayers }],
  ["strong, no stress", strongConfig],
  ["strong + Whale withdrawal", { ...strongConfig, stress: whaleShock }],
  ["strong + 50% fewer new players", { ...strongConfig, stress: fewerPlayers }],
];

console.log("\nStress tests (results at day 60)");
console.table(
  scenarios.map(([name, config]) => {
    const history = runSimulation(config);
    const last = scoreHistory(history)[history.length - 1];
    return {
      scenario: name,
      price: history[59].price.toFixed(3),
      activePlayers: history[59].active,
      score: last.score.toFixed(0),
      band: last.band,
      alert: alertText(detectDeathSpiral(history)),
    };
  })
);