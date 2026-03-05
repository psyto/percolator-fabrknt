'use client';

import type { Account } from '@/lib/percolator';
import type { MarketData } from '@/hooks/use-market';
import type { MarketConfig } from '@/lib/solana/config';
import {
  formatNativeUnits,
  formatPriceE6,
} from '@/lib/format';

interface PositionPanelProps {
  userAccount: { idx: number; account: Account } | null;
  market: MarketData | null | undefined;
  marketConfig: MarketConfig;
  onTrade: (size: bigint) => Promise<string>;
}

export function PositionPanel({
  userAccount,
  market,
  marketConfig,
  onTrade,
}: PositionPanelProps) {
  if (!userAccount || !market) return null;

  const { account } = userAccount;
  const posSize = account.positionSize;

  if (posSize === 0n) return null;

  const isLong = posSize > 0n;
  const absPosSize = isLong ? posSize : -posSize;
  const direction = isLong ? 'LONG' : 'SHORT';

  const entryStr = formatPriceE6(account.entryPrice);
  const markStr = formatPriceE6(market.markPriceE6);

  const pnl = account.pnl;
  const pnlPositive = pnl >= 0n;

  const sizeStr = formatNativeUnits(
    absPosSize,
    marketConfig.decimals,
    marketConfig.symbol
  );

  const pnlStr = formatNativeUnits(
    pnl,
    marketConfig.decimals,
    marketConfig.symbol
  );

  const handleClose = async () => {
    const closeSize = isLong ? -absPosSize : absPosSize;
    await onTrade(closeSize);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Position</h3>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            isLong
              ? 'bg-trade-green/20 text-trade-green'
              : 'bg-trade-red/20 text-trade-red'
          }`}
        >
          {direction}
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Size</span>
          <span className="text-foreground">{sizeStr}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Entry</span>
          <span className="text-foreground">${entryStr}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">Mark</span>
          <span className="text-foreground">${markStr}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-muted-foreground">uPnL</span>
          <div className="text-right">
            <div
              className={`font-medium ${
                pnlPositive ? 'text-trade-green' : 'text-trade-red'
              }`}
            >
              {pnl >= 0n ? '+' : ''}{pnlStr}
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={handleClose}
        className="mt-4 w-full rounded border border-border py-2 text-sm text-muted-foreground transition-colors hover:border-trade-red hover:text-trade-red"
      >
        Close Position
      </button>
    </div>
  );
}
