# 🏟️ LLM Trading Arena (Nifty 50)

> A research-grade, auditable paper trading arena where LLMs compete on Nifty 50 — built for realism, reproducibility, and long-term profitability experimentation.

---

## 📌 Overview

Most LLM trading arenas collapse into noise. This one doesn't.

| Problem                      | This System's Fix                             |
| ---------------------------- | --------------------------------------------- |
| Noisy intraday decisions     | Daily or controlled hybrid trading            |
| Poor risk context            | Rich OHLC-derived quant features              |
| No regime awareness          | Cross-sectional ranks + trend slopes          |
| No portfolio-level analytics | Per-model HHI, drawdown, MAE/MFE              |
| No audit trail               | Append-only Redis logs + deterministic replay |

---

## 🗂️ Project Structure

```
/
├── arena-engine/    # Node.js + TypeScript — brains of the operation
│   ├── cron/        # BullMQ job definitions
│   ├── features/    # Quant feature computation
│   ├── llm/         # LLM orchestration + prompt schemas
│   ├── sim/         # Paper trading simulator
│   └── redis/       # Storage contracts
│
└── arena-ui/        # Next.js — read-only dashboard (built after engine)
    ├── leaderboard/
    ├── portfolios/
    ├── trades/
    └── run-config/
```

---

## ⚙️ Tech Stack

### Engine

* **Runtime:** Node.js + TypeScript
* **Storage:** Redis (primary) + optional Postgres (audit durability)
* **Queue:** BullMQ (cron + job orchestration)

### Data Sources

| Source                                                               | Use                                             |
| -------------------------------------------------------------------- | ----------------------------------------------- |
| Yahoo / NSE / Broker APIs                                            | OHLC data                                       |
| Bing Search                                                          | News headlines                                  |
| [ValYu API](https://platform.valyu.ai/playground/search) *(optional)* | Structured financial metadata + company context |

### UI

* **Framework:** Next.js (App Router)
* **Mode:** Read-only first

---

## 🌐 Market Scope & Rules

**Universe:** Nifty 50 only. Static per season (`universe.json`). No creep.

| Parameter          | Value                                  |
| ------------------ | -------------------------------------- |
| Starting Capital   | ₹10,00,000                            |
| Max Open Positions | 10                                     |
| Max Position Size  | 20% of NAV                             |
| Leverage           | None (v1)                              |
| Brokerage          | 10 bps                                 |
| Slippage           | 5 bps                                  |
| Execution (Daily)  | Decision at close → fill at next open |

### Scoring Formula

```
score = totalReturn
      - 0.5 × maxDrawdown
      - 0.1 × turnoverCost
```

---

## 🗄️ Redis Storage Contract

### Market Data

```
universe:nifty50
ohlc:{symbol}:1d
meta:ohlc:{symbol}
```

### Features

```
feat:{symbol}:latest
feat:{symbol}:{date}
xsec:{date}:ranks
```

### News

```
news:{symbol}:latest
news:{symbol}:raw:{id}
```

### Runs & Models

```
run:{runId}:config
run:{runId}:tick:{tickId}:snapshot
run:{runId}:model:{modelId}:state
run:{runId}:model:{modelId}:chat
run:{runId}:model:{modelId}:orders
run:{runId}:model:{modelId}:trades
run:{runId}:leaderboard:latest
```

> All writes are append-only where possible.

---

## 🔁 Cron Jobs

| Job                        | Trigger     | Notes                           |
| -------------------------- | ----------- | ------------------------------- |
| `seed_ohlc_10y`          | One-time    | Historical seed                 |
| `ingest_ohlc_daily`      | Daily       | Idempotent                      |
| `compute_features_daily` | Daily       | Indicators + regimes + XS ranks |
| `news_ingest`            | Daily       | Per symbol                      |
| `news_summarize`         | Post-ingest | 3-5 bullet summaries            |
| `run_tick`               | Per tick    | Snapshot → LLM → Sim → Score |

All jobs: Redis-locked, retry-safe, idempotent.

---

## 📊 Feature Engine

### Per-Stock (from OHLC)

* Returns: 1d / 5d / 20d / 60d
* Volatility: 20d / 60d
* RSI(14), MACD(12,26,9), ATR(14), ADX(14)
* Bollinger Bands + width
* Gap frequency, Tail risk (worst 5d return, kurtosis)
* Breakout quality score, Mean reversion score, Trend slope

### Cross-Sectional

* Momentum ranks: 1m / 3m / 6m
* Trend strength ranks
* High-risk flag (ATR percentile)
* Breadth: % above 50DMA / 200DMA

### Portfolio-Aware (Per Model)

* Cash %, Exposure %, Concentration (HHI)
* Drawdown + duration
* Turnover + cost drag
* MAE / MFE per position
* Portfolio volatility proxy
* Correlation regime proxy

---

## 🤖 LLM Orchestration

### Snapshot Packet (Frozen Per Tick)

* Market regime summary
* Cross-sectional ranks
* Per-symbol feature summary
* Model portfolio state
* Constraints + risk budget
* News + ValYu context (if enabled)
* Add one more with Iris as the master agent, hopefully this wins with all the context it has and better reasoning capabilities

### Output Schema (Strict)

```jsonc
{
  "orders": [...],
  "risk_controls": {...},
  "rationale": "...",
  "confidence": 0.0 - 1.0
}
```

> Invalid JSON → retry once → no-trade. No silent failures.

### Future: Multi-Agent Extensions

* Risk Manager advisor
* Quant Analyst advisor
* News Analyst advisor
* Debate phase (thesis only, no trades)

---

## 🗺️ Development Phases

### Phase 1 — MVP (7-10 days)

* [X] Daily mode
* [X] 4 competing models
* [X] Full audit logs
* [X] Leaderboard
* [ ] No news (yet)

### Phase 2

* [ ] News ingestion + ValYu enrichment
* [ ] Better quant context
* [ ] Risk metrics dashboard
* [ ] Hybrid tick mode

### Phase 3

* [ ] Advisor agents
* [ ] Model-to-model interaction
* [ ] Ensemble benchmark
* [ ] Explainability scoring

---

## 🚫 Non-Negotiables

* No universe beyond Nifty 50
* No silent state mutation
* No schema-less LLM outputs
* No frontend-driven logic
* Everything must be reproducible

---

## 💡 Why This Architecture?

This is **overkill for a college project** — and exactly right if you want:

* Research credibility
* Realistic, non-toy results
* A system that doesn't collapse into noise
* Something investors and serious engineers respect

**This is not a toy. Build it like a trading lab.**

---

## 📄 License

MIT
