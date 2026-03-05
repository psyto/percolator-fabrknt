'use client';

import { useState, useCallback } from 'react';
import type { MarketData } from '@/hooks/use-market';
import type { MarketConfig } from '@/lib/solana/config';
import { formatNativeUnits } from '@/lib/format';

interface InsuranceSectionProps {
  market: MarketData;
  marketConfig: MarketConfig;
  onTopUp: (amount: string) => Promise<string>;
  onWithdraw: () => Promise<string>;
}

export function InsuranceSection({ market, marketConfig, onTopUp, onWithdraw }: InsuranceSectionProps) {
  const [amount, setAmount] = useState('');
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
      {/* Current balance */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-xs text-muted-foreground mb-2">Insurance Fund</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Balance</span>
            <span className="text-foreground font-mono">
              {formatNativeUnits(market.engine.insuranceFund.balance, marketConfig.decimals, marketConfig.symbol)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fee Revenue</span>
            <span className="text-foreground font-mono">
              {formatNativeUnits(market.engine.insuranceFund.feeRevenue, marketConfig.decimals, marketConfig.symbol)}
            </span>
          </div>
        </div>
      </div>

      {/* Top Up */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-medium text-foreground mb-3">Top Up Insurance</h3>
        <div className="mb-3">
          <label className="mb-1 block text-xs text-muted-foreground">
            Amount (lamports / native units)
          </label>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 1000000000"
            className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground font-mono outline-none focus:border-accent placeholder-muted-foreground"
          />
        </div>
        <button
          onClick={() => handle(() => onTopUp(amount))}
          disabled={submitting || !amount}
          className="w-full rounded bg-trade-green py-2 text-sm font-medium text-white transition-colors hover:bg-trade-green/80 disabled:opacity-50"
        >
          Top Up
        </button>
      </div>

      {/* Withdraw */}
      <div className="rounded-lg border border-trade-red/30 bg-card p-4">
        <h3 className="text-sm font-medium text-trade-red mb-3">Withdraw Insurance</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Requires market to be RESOLVED and all positions closed.
        </p>
        <button
          onClick={() => handle(onWithdraw)}
          disabled={submitting || !market.header.resolved}
          className="w-full rounded bg-trade-red py-2 text-sm font-medium text-white transition-colors hover:bg-trade-red/80 disabled:opacity-50"
        >
          {market.header.resolved ? 'Withdraw Insurance' : 'Market Not Resolved'}
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
