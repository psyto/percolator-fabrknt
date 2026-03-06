# percolator-fabrknt

Fabrknt's extensions for [Percolator](https://github.com/nicholasgasior/percolator) — custom matching programs, shared SDK, and frontend apps for Solana.

Consolidated from three repos: `percolator-matchers`, `percolator-matcher-sdk`, and `percolator-apps`.

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

- **[@veil/crypto](https://github.com/psyto/veil)** — NaCl box encryption for the privacy solver (replaces raw tweetnacl)
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
