// P2E Economy Lab - simulation engine

// A random number generator that gives the SAME numbers
// every time if you start it with the same seed.
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ARCHETYPES = {
  casual:   { playProb: 0.25, earnPerDay: 10, sellFrac: 0.3,   startBalance: 0 },
  grinder:  { playProb: 0.95, earnPerDay: 40, sellFrac: 0.8,   startBalance: 0,    minUsdPerDay: 3 },
  investor: { playProb: 0.6,  earnPerDay: 20, sellFrac: 0.1,   startBalance: 300 },
  whale:    { playProb: 0.3,  earnPerDay: 20, sellFrac: 0.005, startBalance: 5000 },
};

const mix = { casual: 0.4, grinder: 0.35, investor: 0.15, whale: 0.1 };

function pickArchetype(rand, mix) {
  const r = rand();
  let cumulative = 0;
  for (const [name, share] of Object.entries(mix)) {
    cumulative += share;
    if (r < cumulative) return name;
  }
  return "casual";
}

// `table` lets a run use adjusted archetype settings (confidence bands); default = ARCHETYPES
function createAgent(id, type, table = ARCHETYPES) {
  return { id, type, active: true, balance: table[type].startBalance, lowDays: 0 };
}

// How unequal are token holdings? 0 = everyone equal, 1 = one holder has everything
function gini(values) {
  const x = values.slice().sort((a, b) => a - b);
  const n = x.length;
  const total = x.reduce((sum, v) => sum + v, 0);
  if (n === 0 || total === 0) return 0;
  let weighted = 0;
  for (let i = 0; i < n; i++) weighted += (i + 1) * x[i];
  return (2 * weighted) / (n * total) - (n + 1) / n;
}

// ---- Steps 3-7: one day of earning, sinks, selling and reacting ----
function playOneDay(agents, rand, config, price, trend) {
  let faucet = 0;   // new tokens created today
  let sink = 0;     // tokens burned today
  let sold = 0;     // tokens cashed out to the market today
  let bought = 0;   // tokens bought today (Investors buying a rising price)
  let players = 0;  // how many players played today

  const table = config.archetypes || ARCHETYPES;

  // Sinks shrink when the price is low (fewer players breed or upgrade)
  const priceRatio = Math.min(1.5, price / config.startPrice);

  for (const a of agents) {
    if (!a.active) continue;
    const rules = table[a.type];

    // Step 7: Investors and Whales watch the price, even on days they do not play
    if (a.type === "investor") {
      if (trend < -0.15) {                    // price falling fast: sell everything and leave
        sold += a.balance; a.balance = 0; a.active = false;
        continue;
      }
      if (trend > 0.05) { bought += 20; a.balance += 20; }   // price rising: buy more
    }
    if (a.type === "whale" && trend < -0.3) {  // price crashing: dump half
      const panic = a.balance * 0.5;
      a.balance -= panic;
      sold += panic;
    }

    if (rand() > rules.playProb) continue;  // did not play today

    const earned = rules.earnPerDay * (config.faucetMultiplier ?? 1);   // faucet: how generous the rewards are
    // Players can never burn more than they earned, even if a designer sets extreme values
    const spent = Math.min(earned, earned * (config.sinkRate * priceRatio + config.burnRate));   // burned
    a.balance += earned - spent;
    faucet += earned;
    sink += spent;

    const sell = a.balance * rules.sellFrac;     // cashed out
    a.balance -= sell;
    sold += sell;

    // Quit rules: Grinders leave if their income stays too low for 5 days in a row
    if (a.type === "grinder") {
      const usdToday = (earned - spent) * rules.sellFrac * price;
      a.lowDays = usdToday < rules.minUsdPerDay ? a.lowDays + 1 : 0;
      if (a.lowDays >= 5) a.active = false;
    }
    // Casuals drift away at random (0.3% chance per day)
    if (a.type === "casual" && rand() < 0.003) a.active = false;

    players++;
  }
  return { faucet, sink, sold, bought, players };
}

// ---- Step 5: the price and the daily loop ----
function runSimulation(config) {
  const rand = makeRng(config.seed);
  const table = config.archetypes || ARCHETYPES;
  const agents = [];
  for (let i = 0; i < config.agents; i++) {
    agents.push(createAgent(i, pickArchetype(rand, config.mix), table));
  }

  let price = config.startPrice;
  let supply = agents.reduce((total, a) => total + a.balance, 0);
  const priceHistory = [price];
  const history = [];

  for (let day = 1; day <= config.days; day++) {
    // Price change over the last 7 days - Investors and Whales react to this
    const weekAgo = priceHistory[Math.max(0, priceHistory.length - 8)];
    const trend = price / weekAgo - 1;

    // Step 10: stress tests - a sudden shock on a chosen day
    const stress = config.stress;
    let shockSold = 0;
    if (stress && stress.type === "whale_withdrawal" && day === stress.day) {
      for (const a of agents) {
        if (a.active && a.type === "whale") {
          const out = a.balance * stress.fraction;   // Whales cash out a share of their holdings
          a.balance -= out;
          shockSold += out;
        }
      }
    }

    // Black swan (a market crash or hack from outside the game): the price suddenly falls,
    // some players sell everything and leave, and those who stay panic-sell part of their coins
    if (stress && stress.type === "black_swan" && day === stress.day) {
      price = price * (1 - stress.priceDrop);
      for (const a of agents) {
        if (!a.active) continue;
        if (rand() < stress.leave) { shockSold += a.balance; a.balance = 0; a.active = false; }
        else { const out = a.balance * stress.panicSell; a.balance -= out; shockSold += out; }
      }
    }

    const d = playOneDay(agents, rand, config, price, trend);
    const soldToday = d.sold + shockSold;
    let bought = d.bought;

    // New players join - but fewer when the price is low
    const attraction = Math.max(0, Math.min(2, price / config.startPrice));
    let joinRate = config.newPlayersPerDay;
    if (stress && stress.type === "acquisition_drop" && day >= stress.day) {
      joinRate = joinRate * (1 - stress.fraction);   // fewer new players join from the shock day on
    }
    const newToday = Math.round(joinRate * attraction);
    for (let i = 0; i < newToday; i++) {
      agents.push(createAgent(agents.length, pickArchetype(rand, config.mix), table));
      bought += 50;   // each new player buys some tokens to get started
    }

    // Price moves with buying minus selling
    const liquidity = Math.max(supply * 0.1, 1);
    const change = Math.max(-0.2, Math.min(0.2, (config.priceImpact * (bought - soldToday)) / liquidity));
    price = Math.max(price * (1 + change), 0.0001);
    supply += d.faucet - d.sink;
    priceHistory.push(price);

    const activeAgents = agents.filter((a) => a.active);
    const activeByType = { casual: 0, grinder: 0, investor: 0, whale: 0 };
    for (const a of activeAgents) activeByType[a.type]++;
    history.push({
      day, price, supply, active: activeAgents.length, activeByType,
      faucet: d.faucet, sink: d.sink, sold: soldToday,
      faucetToSink: d.faucet / Math.max(d.sink, 1),
      velocity: soldToday / Math.max(supply, 1),           // how fast tokens are changing hands
      cashOutRate: soldToday / Math.max(d.faucet, 1),      // used by the alert in Step 9
      gini: gini(activeAgents.map((a) => a.balance)),   // how concentrated holdings are
    });
  }
  return history;
}

// ---- Default settings (run.js uses these) ----
const defaultConfig = {
  days: 60, seed: 42, agents: 1000, mix,
  sinkRate: 0.3, burnRate: 0, startPrice: 0.3, priceImpact: 0.1, newPlayersPerDay: 20,
  faucetMultiplier: 1,   // 1 = normal rewards, 1.5 = 50% bigger rewards
  stress: null,   // or { type: "whale_withdrawal", day: 20, fraction: 0.2 }
                  // or { type: "acquisition_drop", day: 20, fraction: 0.5 }
                  // or { type: "black_swan", day: 20, priceDrop: 0.5, leave: 0.3, panicSell: 0.2 }
};

module.exports = { runSimulation, defaultConfig, ARCHETYPES, makeRng };
