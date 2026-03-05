# percolator-fabrknt

Fabrknt's extensions for [Percolator](https://github.com/nicholasgasior/percolator) — custom matching programs, shared SDK, and frontend apps for Solana.

## Structure

```
percolator-fabrknt/
  sdk/                  Shared CPI library (matcher-common)
  programs/
    privacy-matcher/    MEV-protected private order matching
    vol-matcher/        Volatility-based price matching
    jpy-matcher/        JPY stablecoin price matching
    event-matcher/      Event-driven price matching
    macro-matcher/      Macro indicator price matching
  apps/
    admin/              Admin dashboard
    btc/                BTC keeper app
    dashboard/          Monitoring dashboard
    liquidation-monitor/ Liquidation monitoring
    lp-manager/         LP position management
    sol/                SOL keeper app
  cli/                  CLI tools
  tests/                Integration tests
  docs/                 Documentation
```

## Building

```bash
cargo build
```

## Testing

```bash
cargo test
```

## License

MIT
