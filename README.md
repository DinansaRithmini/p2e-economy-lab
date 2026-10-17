# P2E Economy Lab

**An agent-based simulation tool for testing Play-to-Earn (P2E) token economies before launch.**

Final-year project, BSc (Hons) Computing, Coventry University / NIBM.
H.D.R. Soysa (COBSCCOMP242P-036).

**Live web version:** https://p2e-economy-lab-web.vercel.app

> For design testing only. This is not financial or investment advice.

---

## What it does

Play-to-earn games such as Axie Infinity (SLP) and STEPN (GST) collapsed when reward tokens were created faster than players used them. Prices fell, players cashed out and left, and the economies fell into a "death spiral". The P2E Economy Lab lets a game designer test a token economy **before launch**, without writing code.

The designer sets:

| Setting | Meaning |
|---|---|
| Reward size (faucet) | How many tokens players earn, relative to an Axie-like baseline |
| Sink strength | Share of earned tokens spent back in the game |
| Fixed burn (fees) | Tokens destroyed by fees or taxes |
| New players per day | Growth of the player base |
| Player mix | Shares of Casual, Grinder, Investor and Whale players |
| Starting players | 100, 500 or 1000 |
| Simulation length | 30, 60 or 90 days |
| Stress test | Whale withdrawal, fewer new players, or a black swan crash |

The app then simulates every player day by day and shows:

- **Sustainability Score** (0–100): token velocity 30%, faucet-to-sink ratio 40%, holder concentration 30%. Bands: Sustainable ≥ 80, Caution ≥ 60, Warning ≥ 40, Death Spiral < 40.
- **Death Spiral Alert**: the price falls 15% or more over 7 days while cash-outs rise, for 3 days in a row.
- **Charts**: price, score, faucet-to-sink ratio, active players, and which player types stayed.
- **"What this means"**: a plain-language summary of the result.
- **Suggest a fix**: searches sink and burn settings for the smallest change that makes the design Sustainable.
- **Check uncertainty**: runs the design 10 times with player behaviour changed by up to ±20% and shows the range.
- **Compare**: saves a baseline and compares it side by side with a changed design.

Presets: Axie-like (2021), Balanced design, Fast rewards (GST-like) and the player mix reported in the project survey.

## Repository structure

```
app/          React Native (Expo) app for iOS, Android and web
  engine/     simulation.js, scoring.js, advisor.js, appLogic.js, chartMath.js
  App.js      Configure screen
  Dashboard.js, Compare.js, Charts.js, theme.js, Layout.js
  check-app.js  automated checks of the app logic (49 checks)
evaluation/   Node.js scripts used for the evaluation in the report
  data/       real daily prices of SLP and GST (CoinGecko)
web/          static web build deployed on Vercel
```

The simulation engine, scoring, alert, optimiser and charts are written for this project in plain JavaScript. No simulation or charting library is used.

## Running the app

Requirements: Node.js 20 or later, and the **Expo Go** app on a phone (optional).

```bash
cd app
npm install
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS). The phone and the computer must be on the same Wi-Fi network. Press `w` to open the web version in a browser.

## Running the checks

```bash
cd app
node check-app.js        # 49 checks of the app logic, charts, presets and advice features

cd ../evaluation
node check.js            # 16 checks of the simulation engine and scoring
```

## Reproducing the evaluation

```bash
cd evaluation
node run.js                       # indicator scores and weak vs strong design
node calibrate.js                 # simulated price vs the real 2021 SLP collapse
node sensitivity.js               # 212 runs with every key parameter changed by up to ±20%
node extra_validation.js          # spreadsheet-style model, MAPE/RMSE/correlation, real supply, alert on real data
node extra_validation.js --data data/gst_price.csv --start 2022-04-28   # the same checks for STEPN's GST
```

The simulation is deterministic: a fixed random seed gives the same result on every run.

## Building the web version

```bash
cd app
npx expo export --platform web --output-dir dist
```

## Data sources

- SLP and GST daily prices: CoinGecko.
- Active players and addresses: Token Terminal (used in the report, not stored here).
- Player mix preset: an online questionnaire of P2E players and designers (raw responses are not published, to protect respondents' privacy).

## Limitations

- Settings are relative to an Axie-like baseline, not exact token amounts. The tool compares designs; it does not forecast real prices.
- The simulated price is smoother than real market prices, and the early fall of the SLP collapse is faster in the model than in reality.
- Player behaviour values are informed by the literature and the survey, not measured from wallet data.
