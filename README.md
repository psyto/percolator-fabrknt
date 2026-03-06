# percolator-fabrknt

Fabrknt's custom matching programs, off-chain services, and frontend apps for [Percolator](https://github.com/aeyakovenko/percolator) on Solana.

## What is this?

[Percolator](https://github.com/aeyakovenko/percolator) is a perpetual futures protocol on Solana. It uses a modular matcher system — when a user submits a trade, the core program ([percolator-prog](https://github.com/aeyakovenko/percolator-prog)) calls an external **matcher program** via CPI to determine the execution price and fill size.

This repo contains **Fabrknt's custom matchers** — five specialized pricing strategies that plug into Percolator:

| Matcher | What it does |
|---------|-------------|
| **privacy-matcher** | MEV-protected trading via encrypted intents and an off-chain solver |
| **vol-matcher** | Volatility-adjusted spreads using realized/implied vol oracles |
| **jpy-matcher** | JPY stablecoin pricing with KYC/compliance gating |
| **event-matcher** | Event-driven pricing based on probability (e.g., elections, governance votes) |
| **macro-matcher** | Macro indicator pricing (real rates, inflation) with regime-based spreads |

Each matcher also has companion off-chain services (keepers, solvers, oracles) and CLI tools.

## How it fits together

```
┌─────────────────────────────────────────────────────────┐
│  percolator            (Anatoly)                        │
│  Risk engine crate — PnL, haircuts, coverage ratio      │
└────────────────────────┬────────────────────────────────┘
                         │ linked as dependency
┌────────────────────────▼────────────────────────────────┐
│  percolator-prog       (Anatoly)                        │
│  On-chain program — slab accounts, trade instructions,  │
│  settlement. Calls matchers via CPI (TradeCpi).         │
└───────┬─────────────────────────────────────────────────┘
        │ CPI call (67-byte MatcherCall)
        │ matcher writes 64-byte MatcherReturn
        │
        ├──► percolator-match  (Anatoly's reference: ±50bps passive)
        │
        ├──► privacy-matcher  ┐
        ├──► vol-matcher      │
        ├──► jpy-matcher      ├─ percolator-fabrknt/programs/ (this repo)
        ├──► event-matcher    │
        └──► macro-matcher    ┘

┌─────────────────────────────────────────────────────────┐
│  percolator-cli        (Anatoly)                        │
│  CLI for the core protocol — market setup, inspection   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  percolator-meta       (Anatoly)                        │
│  Staking rewards + MetaDAO futarchy governance          │
└─────────────────────────────────────────────────────────┘
```

**percolator-prog** owns the market state (slab accounts) and calls into matcher programs via CPI during `TradeCpi`. Each matcher receives a 67-byte `MatcherCall` (containing `req_id`, `lp_account_id`, `oracle_price_e6`, `req_size`) and writes back a 64-byte `MatcherReturn` (with `exec_price_e6`, `exec_size`, and echoed request fields). The shared `sdk/` (matcher-common) provides the ABI types and context account utilities.

## Prerequisites

You need:

1. **Solana CLI** — `solana-install init 2.1.0` (or later)
2. **Anchor** — for building programs (`anchor build`)
3. **Node.js + npm** — for keepers, solvers, CLI tools, and frontend apps
4. **A funded Solana wallet** — `~/.config/solana/id.json` (devnet SOL via `solana airdrop`)
5. **percolator-prog deployed** — the core program must be on-chain before matchers can work. See [percolator-prog](https://github.com/aeyakovenko/percolator-prog).
6. **A market created via [percolator-cli](https://github.com/aeyakovenko/percolator-cli)** — matchers are registered as LPs on an existing market.

## Quick start

### 1. Build the programs

```bash
# Clone this repo
git clone https://github.com/psyto/percolator-fabrknt.git
cd percolator-fabrknt

# Build all Rust programs
cargo build

# Install TypeScript dependencies
npm install
```

### 2. Set up a market (using percolator-cli)

Before using any matcher, you need a market on percolator-prog. Use [percolator-cli](https://github.com/aeyakovenko/percolator-cli) to create one:

```bash
# In the percolator-cli repo:
pnpm install && pnpm build

# Create a market (see percolator-cli README for full options)
npx percolator-cli init-market --rpc https://api.devnet.solana.com --mint So11111111111111111111111111111111111111112
```

### 3. Deploy a matcher and register as LP

Each matcher needs to be deployed on-chain, then registered as an LP on the market. Example with the vol-matcher:

```bash
# Deploy the matcher program (get the program ID from output)
anchor deploy --program-name vol_matcher

# Initialize the matcher context and register as LP
npm run vol:init-market
```

### 4. Run the keeper

Matchers need off-chain keepers to feed oracle data. Each matcher has its own keeper:

```bash
# Set environment variables (program IDs, market slab, RPC, etc.)
export PROGRAM_ID=<percolator-prog program ID>
export MATCHER_PROGRAM_ID=<your deployed matcher program ID>

# Start the vol-matcher keeper
npm run vol:keeper
```

### 5. Trade

Once the matcher is registered and the keeper is running:

```bash
# Submit a trade through the vol-matcher
npm run vol:trade
```

## Available scripts

### Keepers & Solvers (long-running services)

| Script | Description |
|--------|-------------|
| `npm run privacy:solver` | Privacy solver — decrypts intents and submits trades |
| `npm run vol:keeper` | Volatility keeper — feeds vol oracle data |
| `npm run event:oracle` | Event oracle — feeds probability data |
| `npm run event:keeper` | Event keeper — cranks event markets |
| `npm run macro:keeper` | Macro keeper — feeds macro indicator data |
| `npm run btc:keeper` | BTC keeper — cranks BTC markets |

### CLI tools (one-shot commands)

| Script | Description |
|--------|-------------|
| `npm run privacy:init-lp` | Initialize privacy matcher context |
| `npm run privacy:submit-intent` | Submit an encrypted trade intent |
| `npm run vol:init-market` | Initialize vol matcher on a market |
| `npm run vol:trade` | Submit a trade through vol matcher |
| `npm run jpy:init-market` | Initialize JPY matcher with KYC config |
| `npm run jpy:trade` | Submit a trade through JPY matcher |
| `npm run event:trade` | Submit a trade through event matcher |
| `npm run macro:init-market` | Initialize macro matcher |
| `npm run macro:init-lp` | Initialize macro LP |
| `npm run macro:trade` | Submit a trade through macro matcher |
| `npm run macro:status` | Check macro matcher status |

### Setup & Testing

| Script | Description |
|--------|-------------|
| `npm run setup:devnet` | Set up all matchers on devnet |
| `npm run btc:setup` | Set up BTC market on devnet |
| `npm run backtest` | Run backtesting simulation |
| `npm test` | Run integration tests |

## Structure

```
percolator-fabrknt/
  sdk/                    Shared CPI library (matcher-common)
                          Provides MatcherCall, MatcherReturn, context utilities
  programs/
    privacy-matcher/      MEV-protected private order matching
    vol-matcher/          Volatility-based price matching
    jpy-matcher/          JPY stablecoin price matching (with compliance)
    event-matcher/        Event-driven price matching
    macro-matcher/        Macro indicator price matching
  app/
    privacy-solver/       Encrypted intent solver (powered by @veil/crypto)
    vol-keeper/           Volatility keeper service
    event-oracle/         Event oracle feed
    event-keeper/         Event keeper service
    macro-keeper/         Macro indicator keeper
    btc-keeper/           BTC keeper service
  apps/
    admin/                Admin dashboard (Next.js)
    btc/                  BTC keeper app (Next.js)
    dashboard/            Monitoring dashboard (Next.js)
    liquidation-monitor/  Liquidation monitoring (Next.js)
    lp-manager/           LP position management (Next.js)
    sol/                  SOL keeper app (Next.js)
  cli/                    CLI tools for each matcher
  scripts/                Setup and test scripts
  tests/                  Integration tests
  docs/                   Per-matcher documentation
```

## Related repositories

| Repo | Author | Description |
|------|--------|-------------|
| [percolator](https://github.com/aeyakovenko/percolator) | Anatoly | Risk engine crate (core math) |
| [percolator-prog](https://github.com/aeyakovenko/percolator-prog) | Anatoly | On-chain Solana program |
| [percolator-cli](https://github.com/aeyakovenko/percolator-cli) | Anatoly | CLI for the core protocol |
| [percolator-match](https://github.com/aeyakovenko/percolator-match) | Anatoly | Reference matcher (±50bps passive) |
| [percolator-meta](https://github.com/aeyakovenko/percolator-meta) | Anatoly | Staking + futarchy governance |
| [percolator-stress-test](https://github.com/aeyakovenko/percolator-stress-test) | Anatoly | Stress testing suite |

## Dependencies

- **[@veil/crypto](https://github.com/psyto/veil)** — NaCl box encryption for the privacy solver
- **[matcher-common](sdk/)** — Shared CPI ABI types and context account utilities

## License

MIT
