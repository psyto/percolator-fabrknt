'use client';

import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import type { MarketData } from '@/hooks/use-market';
import type { MarketConfig } from '@/lib/solana/config';
import { AccountKind } from '@/lib/percolator';
import { formatNativeUnits, formatPriceE6 } from '@/lib/format';

interface LpCardProps {
  lpIdx: number;
  market: MarketData | null | undefined;
  marketConfig: MarketConfig;
  onDeposit: (lpIdx: number, amount: bigint) => Promise<string>;
  onWithdraw: (lpIdx: number, amount: bigint) => Promise<string>;
  onClose: () => void;
}

export function LpCard({ lpIdx, market, marketConfig, onDeposit, onWithdraw, onClose }: LpCardProps) {
  const { publicKey } = useWallet();
  const [depositInput, setDepositInput] = useState('');
  const [withdrawInput, setWithdrawInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lpAccount = market?.accounts.find(
    (a) => a.idx === lpIdx && a.account.kind === AccountKind.LP
  );

  if (!lpAccount || !market) return null;

  const { account } = lpAccount;
  const isMine = publicKey && account.owner.toBase58() === publicKey.toBase58();

  const parseAmount = (input: string): bigint | null => {
    try {
      const val = parseFloat(input);
      if (!val || val <= 0) return null;
      return BigInt(Math.floor(val * 10 ** marketConfig.decimals));
    } catch {
      return null;
    }
  };

  const handleDeposit = async () => {
    const amount = parseAmount(depositInput);
    if (!amount) return;
    setSubmitting(true);
    setError(null);
    try {
      await onDeposit(lpIdx, amount);
      setDepositInput('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseAmount(withdrawInput);
    if (!amount) return;
    setSubmitting(true);
    setError(null);
    try {
      await onWithdraw(lpIdx, amount);
      setWithdrawInput('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-foreground">LP #{lpIdx}</h3>
        <button
          onClick={onClose}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Close
        </button>
      </div>

      <div className="space-y-2 text-sm mb-4">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Owner</span>
          <span className="text-foreground font-mono text-xs">
            {account.owner.toBase58().slice(0, 16)}...
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Collateral</span>
          <span className="text-foreground">
            {formatNativeUnits(account.capital, marketConfig.decimals, marketConfig.symbol)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Position</span>
          <span className="text-foreground">
            {account.positionSize === 0n
              ? 'None'
              : formatNativeUnits(account.positionSize, marketConfig.decimals, marketConfig.symbol)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Entry Price</span>
          <span className="text-foreground">
            {account.entryPrice === 0n ? '-' : `$${formatPriceE6(account.entryPrice)}`}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">PnL</span>
          <span className={account.pnl >= 0n ? 'text-trade-green' : 'text-trade-red'}>
            {account.pnl >= 0n ? '+' : ''}
            {formatNativeUnits(account.pnl, marketConfig.decimals, marketConfig.symbol)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Matcher Program</span>
          <span className="text-foreground font-mono text-xs">
            {account.matcherProgram.toBase58().slice(0, 8)}...
          </span>
        </div>
      </div>

      {/* Deposit/Withdraw forms for owned LPs */}
      {isMine && (
        <div className="space-y-3 border-t border-border pt-4">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Deposit ({marketConfig.symbol})
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={depositInput}
                onChange={(e) => setDepositInput(e.target.value)}
                className="min-w-0 flex-1 rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-accent"
              />
              <button
                onClick={handleDeposit}
                disabled={submitting || !parseAmount(depositInput)}
                className="rounded bg-trade-green/20 px-4 py-2 text-sm text-trade-green transition-colors hover:bg-trade-green/30 disabled:opacity-50"
              >
                Deposit
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">
              Withdraw ({marketConfig.symbol})
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={withdrawInput}
                onChange={(e) => setWithdrawInput(e.target.value)}
                className="min-w-0 flex-1 rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-accent"
              />
              <button
                onClick={handleWithdraw}
                disabled={submitting || !parseAmount(withdrawInput)}
                className="rounded bg-trade-red/10 px-4 py-2 text-sm text-trade-red transition-colors hover:bg-trade-red/20 disabled:opacity-50"
              >
                Withdraw
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded bg-trade-red/10 px-3 py-2 text-xs text-trade-red">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
