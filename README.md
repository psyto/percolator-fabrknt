# percolator-fabrknt

Fabrknt's custom matching programs, off-chain services, and frontend apps for [Percolator](https://github.com/nicholasgasior/percolator) on Solana.

## How it fits together

Percolator is a modular on-chain matching engine. Anatoly's core repos provide the protocol and CLI. This repo provides Fabrknt's custom matchers that plug into that protocol.

```
┌─────────────────────────────────────────────────────────┐
│  percolator-prog         (Anatoly)                      │
│  Core on-chain protocol — order book, matching engine,  │
│  settlement, and account layout                         │
└────────────────────────┬────────────────────────────────┘
                         │ CPI (cross-program invocation)
┌────────────────────────▼────────────────────────────────┐
│  percolator-fabrknt      (Fabrknt / this repo)          │
│  Custom matchers that implement pricing strategies      │
│  on top of the core protocol                            │
│                                                         │
│  programs/  ── on-chain matching programs (Rust)        │
│  sdk/       ── shared CPI library used by all matchers  │
│  app/       ── off-chain keepers & solvers (TypeScript)  │
│  apps/      ── frontend dashboards (Next.js)            │
│  cli/       ── CLI tools per matcher                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  percolator-cli          (Anatoly)                      │
│  CLI for the core protocol — market setup, inspection,  │
│  and admin operations                                   │
└─────────────────────────────────────────────────────────┘
```

**percolator-prog** defines the on-chain accounts and instructions that all matchers must conform to. Each matcher in `programs/` uses CPI via the shared `sdk/` (matcher-common) to interact with the core protocol. The off-chain `app/` services (keepers, solvers, oracles) watch the chain and submit transactions using the matcher programs. The `apps/` frontends provide dashboards for monitoring and management.

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
