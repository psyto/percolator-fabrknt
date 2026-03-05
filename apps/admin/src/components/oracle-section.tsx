'use client';

import { useState, useCallback } from 'react';
import type { MarketData } from '@/hooks/use-market';

interface OracleSectionProps {
  market: MarketData;
  onSetOracleAuthority: (authority: string) => Promise<string>;
  onPushOraclePrice: (priceE6: string, timestamp: string) => Promise<string>;
  onSetOraclePriceCap: (maxChangeE2bps: string) => Promise<string>;
}

export function OracleSection({
  market,
  onSetOracleAuthority,
  onPushOraclePrice,
  onSetOraclePriceCap,
}: OracleSectionProps) {
  const [authority, setAuthority] = useState(market.config.oracleAuthority.toBase58());
  const [priceE6, setPriceE6] = useState('');
  const [priceCap, setPriceCap] = useState(market.config.oraclePriceCapE2bps.toString());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

  const handle = useCallback(async (fn: () => Promise<string>) => {
    setSubmitting(true);
    setError(null);
    setLastTx(null);
    try {
      const sig = await fn();
      setLastTx(sig);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* Set Oracle Authority */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-foreground mb-3">Set Oracle Authority</h3>
        <div className="mb-3">
          <label className="mb-1 block text-xs text-muted-foreground">Authority Pubkey</label>
          <input
            type="text"
            value={authority}
            onChange={(e) => setAuthority(e.target.value)}
            className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground font-mono outline-none focus:border-accent"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Set to 11111111111111111111111111111111 to disable manual pricing.
          </p>
        </div>
        <button
          onClick={() => handle(() => onSetOracleAuthority(authority))}
          disabled={submitting}
          className="w-full rounded bg-accent py-2 text-sm font-medium text-white transition-colors hover:bg-accent/80 disabled:opacity-50"
        >
          Set Authority
        </button>
      </div>

      {/* Push Oracle Price */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-foreground mb-3">Push Oracle Price</h3>
        <div className="mb-3">
          <label className="mb-1 block text-xs text-muted-foreground">Price E6</label>
          <input
            type="text"
            value={priceE6}
            onChange={(e) => setPriceE6(e.target.value)}
            placeholder={market.config.authorityPriceE6.toString() || 'e.g. 150000000'}
            className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground font-mono outline-none focus:border-accent placeholder-muted-foreground"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Price in E6 format. Timestamp will be set to current time.
          </p>
        </div>
        <button
          onClick={() =>
            handle(() =>
              onPushOraclePrice(priceE6, Math.floor(Date.now() / 1000).toString())
            )
          }
          disabled={submitting || !priceE6}
          className="w-full rounded bg-accent py-2 text-sm font-medium text-white transition-colors hover:bg-accent/80 disabled:opacity-50"
        >
          Push Price
        </button>
      </div>

      {/* Set Oracle Price Cap */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-foreground mb-3">Set Oracle Price Cap</h3>
        <div className="mb-3">
          <label className="mb-1 block text-xs text-muted-foreground">Max Change (e2bps)</label>
          <input
            type="text"
            value={priceCap}
            onChange={(e) => setPriceCap(e.target.value)}
            className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground font-mono outline-none focus:border-accent"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            In 0.01 bps units. 1,000,000 = 100%. 0 = disabled.
          </p>
        </div>
        <button
          onClick={() => handle(() => onSetOraclePriceCap(priceCap))}
          disabled={submitting}
          className="w-full rounded bg-accent py-2 text-sm font-medium text-white transition-colors hover:bg-accent/80 disabled:opacity-50"
        >
          Set Price Cap
        </button>
      </div>

      {error && (
        <div className="rounded bg-trade-red/10 px-3 py-2 text-xs text-trade-red">{error}</div>
      )}
      {lastTx && (
        <div className="text-xs text-muted-foreground">
          Tx: <span className="font-mono text-accent">{lastTx.slice(0, 24)}...</span>
        </div>
      )}
    </div>
  );
}
