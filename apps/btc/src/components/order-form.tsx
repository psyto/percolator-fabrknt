'use client';

import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import type { MarketData } from '@/hooks/use-market';
import type { MarketConfig } from '@/lib/solana/config';
import { useBtcPrice } from '@/hooks/use-btc-price';
import {
  formatNativeUnits,
  formatUsdSecondary,
  formatPriceE6,
} from '@/lib/format';

interface OrderFormProps {
  market: MarketData | null | undefined;
  marketConfig: MarketConfig;
  onTrade: (size: bigint) => Promise<string>;
  hasAccount: boolean;
}

export function OrderForm({
  market,
  marketConfig,
  onTrade,
  hasAccount,
}: OrderFormProps) {
  const { connected } = useWallet();
  const { btcUsd } = useBtcPrice();
  const [side, setSide] = useState<'long' | 'short'>('long');
  const [sizeInput, setSizeInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

  const sizeNative = (() => {
    try {
      const val = parseFloat(sizeInput);
      if (!val || val <= 0) return null;
      return BigInt(Math.floor(val * 10 ** marketConfig.decimals));
    } catch {
      return null;
    }
  })();

  // Max leverage from initial margin
  const maxLeverage = market
    ? Math.floor(10000 / Number(market.params.initialMarginBps))
    : 20;

  const handleSubmit = useCallback(async () => {
    if (!sizeNative) return;
    setSubmitting(true);
    setError(null);
    setLastTx(null);
    try {
      const tradeSize = side === 'long' ? sizeNative : -sizeNative;
      const sig = await onTrade(tradeSize);
      setLastTx(sig);
      setSizeInput('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [sizeNative, side, onTrade]);

  const disabled = !connected || !hasAccount || !sizeNative || submitting;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">
        Trade
      </h3>

      {/* Long/Short Toggle */}
      <div className="mb-4 grid grid-cols-2 gap-1 rounded bg-muted p-1">
        <button
          onClick={() => setSide('long')}
          className={`rounded py-2 text-sm font-medium transition-colors ${
            side === 'long'
              ? 'bg-trade-green/20 text-trade-green'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Long
        </button>
        <button
          onClick={() => setSide('short')}
          className={`rounded py-2 text-sm font-medium transition-colors ${
            side === 'short'
              ? 'bg-trade-red/20 text-trade-red'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Short
        </button>
      </div>

      {/* Size Input */}
      <div className="mb-2">
        <label className="mb-1 block text-xs text-muted-foreground">
          Size ({marketConfig.symbol})
        </label>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={sizeInput}
          onChange={(e) => setSizeInput(e.target.value)}
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-btc"
        />
        {sizeNative && btcUsd && marketConfig.symbol === 'BTC' && (
          <div className="mt-1 text-xs text-muted-foreground">
            {formatUsdSecondary(
              (Number(sizeNative) / 10 ** marketConfig.decimals) * btcUsd
            )}
          </div>
        )}
        {sizeNative && market && (
          <div className="mt-1 text-xs text-muted-foreground">
            Notional: ${formatPriceE6(
              (sizeNative * market.markPriceE6) /
                BigInt(10 ** marketConfig.decimals)
            )}
          </div>
        )}
      </div>

      {/* Max leverage info */}
      <div className="mb-4 text-xs text-muted-foreground">
        Max leverage: {maxLeverage}x
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={disabled}
        className={`w-full rounded py-2.5 text-sm font-medium transition-colors ${
          side === 'long'
            ? 'bg-trade-green hover:bg-trade-green/80 disabled:bg-trade-green/30'
            : 'bg-trade-red hover:bg-trade-red/80 disabled:bg-trade-red/30'
        } text-white disabled:cursor-not-allowed disabled:text-white/50`}
      >
        {submitting
          ? 'Submitting...'
          : !connected
            ? 'Connect Wallet'
            : !hasAccount
              ? 'Create Account First'
              : `${side === 'long' ? 'Long' : 'Short'} ${marketConfig.symbol}`}
      </button>

      {/* Feedback */}
      {error && (
        <div className="mt-2 rounded bg-trade-red/10 px-3 py-2 text-xs text-trade-red">
          {error}
        </div>
      )}
      {lastTx && (
        <div className="mt-2 text-xs text-muted-foreground">
          Tx:{' '}
          <a
            href={`https://explorer.solana.com/tx/${lastTx}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-btc hover:underline"
          >
            {lastTx.slice(0, 16)}...
          </a>
        </div>
      )}
    </div>
  );
}
