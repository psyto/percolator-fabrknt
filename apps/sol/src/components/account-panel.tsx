'use client';

import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import type { Account } from '@/lib/percolator';
import type { MarketConfig } from '@/lib/solana/config';
import { formatNativeUnits } from '@/lib/format';

interface AccountPanelProps {
  userAccount: { idx: number; account: Account } | null;
  marketConfig: MarketConfig;
  newAccountFee: bigint;
  marketLoaded: boolean;
  onInitUser: (feePayment: bigint) => Promise<string>;
  onDeposit: (amount: bigint) => Promise<string>;
  onWithdraw: (amount: bigint) => Promise<string>;
}

export function AccountPanel({
  userAccount,
  marketConfig,
  newAccountFee,
  marketLoaded,
  onInitUser,
  onDeposit,
  onWithdraw,
}: AccountPanelProps) {
  const { connected } = useWallet();
  const [depositInput, setDepositInput] = useState('');
  const [withdrawInput, setWithdrawInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseAmount = (input: string): bigint | null => {
    try {
      const val = parseFloat(input);
      if (!val || val <= 0) return null;
      return BigInt(Math.floor(val * 10 ** marketConfig.decimals));
    } catch {
      return null;
    }
  };

  const handleCreateAccount = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onInitUser(newAccountFee);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [onInitUser, newAccountFee]);

  const handleDeposit = useCallback(async () => {
    const amount = parseAmount(depositInput);
    if (!amount) return;
    setSubmitting(true);
    setError(null);
    try {
      await onDeposit(amount);
      setDepositInput('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [depositInput, onDeposit]);

  const handleWithdraw = useCallback(async () => {
    const amount = parseAmount(withdrawInput);
    if (!amount) return;
    setSubmitting(true);
    setError(null);
    try {
      await onWithdraw(amount);
      setWithdrawInput('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }, [withdrawInput, onWithdraw]);

  if (!connected) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">
          Account
        </h3>
        <p className="text-sm text-muted-foreground">
          Connect wallet to continue
        </p>
      </div>
    );
  }

  if (!userAccount) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">
          Account
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Create an account to start trading. Fee:{' '}
          {formatNativeUnits(
            newAccountFee,
            marketConfig.decimals,
            marketConfig.symbol
          )}
        </p>
        <button
          onClick={handleCreateAccount}
          disabled={submitting || !marketLoaded}
          className="w-full rounded bg-accent py-2 text-sm font-medium text-black transition-colors hover:bg-accent/80 disabled:opacity-50"
        >
          {submitting ? 'Creating...' : !marketLoaded ? 'Loading market...' : 'Create Account'}
        </button>
        {error && (
          <div className="mt-2 text-xs text-trade-red">{error}</div>
        )}
      </div>
    );
  }

  const { account } = userAccount;
  const capitalStr = formatNativeUnits(
    account.capital,
    marketConfig.decimals,
    marketConfig.symbol
  );

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">
        Account
      </h3>

      {/* Collateral */}
      <div className="mb-4">
        <div className="text-xs text-muted-foreground">Collateral</div>
        <div className="text-lg font-bold text-foreground">{capitalStr}</div>
      </div>

      {/* Deposit */}
      <div className="mb-3">
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

      {/* Withdraw */}
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
        <div className="mt-3 rounded bg-trade-red/10 px-3 py-2 text-xs text-trade-red">
          {error}
        </div>
      )}
    </div>
  );
}
