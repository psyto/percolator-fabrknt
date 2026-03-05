'use client';

import { useMemo } from 'react';
import type { MarketData } from '@/hooks/use-market';
import type { MarketConfig } from '@/lib/solana/config';
import { AccountKind } from '@/lib/percolator';
import { formatNativeUnits } from '@/lib/format';

interface LpOverviewProps {
  market: MarketData | null | undefined;
  marketConfig: MarketConfig;
}

export function LpOverview({ market, marketConfig }: LpOverviewProps) {
  const stats = useMemo(() => {
    if (!market) return null;

    const lps = market.accounts.filter((a) => a.account.kind === AccountKind.LP);
    const totalCollateral = lps.reduce((sum, a) => sum + a.account.capital, 0n);
    const netInventory = lps.reduce((sum, a) => sum + a.account.positionSize, 0n);
    const aggregatePnl = lps.reduce((sum, a) => sum + a.account.pnl, 0n);

    return {
      count: lps.length,
      totalCollateral,
      netInventory,
      aggregatePnl,
    };
  }, [market]);

  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            <div className="h-4 w-16 animate-pulse rounded bg-muted mb-2" />
            <div className="h-6 w-24 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    { label: 'Total LPs', value: String(stats.count) },
    {
      label: 'Total Collateral',
      value: formatNativeUnits(stats.totalCollateral, marketConfig.decimals, marketConfig.symbol),
    },
    {
      label: 'Net Inventory',
      value: formatNativeUnits(stats.netInventory, marketConfig.decimals, marketConfig.symbol),
    },
    {
      label: 'Aggregate PnL',
      value: `${stats.aggregatePnl >= 0n ? '+' : ''}${formatNativeUnits(stats.aggregatePnl, marketConfig.decimals, marketConfig.symbol)}`,
      color: stats.aggregatePnl >= 0n ? 'text-trade-green' : 'text-trade-red',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">{card.label}</div>
          <div className={`text-lg font-bold ${card.color || 'text-foreground'}`}>
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
}
