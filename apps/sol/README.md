# sol

SOL perpetuals trading frontend for Percolator on Solana.

## Disclaimer

**FOR EDUCATIONAL PURPOSES ONLY**

This code has **NOT been audited**. Do NOT use in production or with real funds. The percolator program is experimental software provided for learning and testing purposes only. Use at your own risk.

## Stack

- Next.js 16, React 19, TypeScript
- Tailwind CSS
- Solana Wallet Adapter (Phantom, Solflare, etc.)
- React Query (polling every 2s)

## Quick Start

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Architecture

Single-page app that reads on-chain slab accounts and renders market state in real time. Parsers and instruction encoders are imported from the sibling `percolator-cli` repo via relative paths (`../../../percolator-cli/src/`). The Next.js webpack config uses `extensionAlias` to resolve `.js` imports as `.ts` files.

## Project Structure

```
src/
  app/          - Next.js App Router (layout, page, globals.css)
  components/   - UI: header, order form, position panel, account panel, market stats
  hooks/        - useMarket (slab polling), useSolPrice, useTrade (transactions)
  lib/          - percolator re-exports, formatting, Solana config
```

## Related

- [percolator-cli](../../percolator-cli) - CLI, SDK, and protocol docs
