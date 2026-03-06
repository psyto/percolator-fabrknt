# percolator-fabrknt

Fabrknt's custom matching programs, off-chain services, and frontend apps for [Percolator](https://github.com/nicholasgasior/percolator) on Solana.

## How it fits together

Percolator is a modular on-chain matching engine. Anatoly's core repos provide the protocol and CLI. This repo provides Fabrknt's custom matchers that plug into that protocol.

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

**percolator-prog** owns the market state (slab accounts) and calls into matcher programs via CPI during `TradeCpi`. Each matcher in `programs/` receives a 67-byte `MatcherCall` (containing `req_id`, `lp_account_id`, `oracle_price_e6`, `req_size`) and writes back a 64-byte `MatcherReturn` (with `exec_price_e6`, `exec_size`, and echoed request fields). The shared `sdk/` (matcher-common) provides the ABI types (`MatcherCall`, `MatcherReturn`) and context account utilities. The off-chain `app/` services (keepers, solvers, oracles) submit transactions to percolator-prog, which then CPI-calls the matcher. The `apps/` frontends provide dashboards for monitoring and management.

## Prerequisites

- **[percolator-prog](https://github.com/nicholasgasior/percolator)** must be deployed on-chain. The matcher programs invoke it via CPI.
- **[percolator-cli](https://github.com/nicholasgasior/percolator-cli)** is useful for setting up markets and inspecting state on the core protocol side.

## Structure

```
percolator-fabrknt/
  sdk/                    Shared CPI library (matcher-common)
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
  tests/                  Integration tests
  docs/                   Documentation
```

## Dependencies

- **[@veil/crypto](https://github.com/psyto/veil)** — NaCl box encryption for the privacy solver
- **[matcher-common](sdk/)** — Shared CPI contract and context account utilities for all matchers

## Building

```bash
# Rust programs
cargo build

# TypeScript apps
npm install
```

## Testing

```bash
# Rust unit tests
cargo test

# Integration tests
npm test
```

## License

MIT
