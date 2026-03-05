'use client';

import type { MarketData } from '@/hooks/use-market';
import type { MarketConfig } from '@/lib/solana/config';
import {
  formatPriceE6,
  formatFundingRate8h,
  formatNativeUnits,
} from '@/lib/format';

interface MarketSummaryProps {
  market: MarketData | null | undefined;
  marketConfig: MarketConfig;
  isLoading: boolean;
}

export function MarketSummary({ market, marketConfig, isLoading }: MarketSummaryProps) {
  if (isLoading || !market) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            <div className="h-4 w-16 animate-pulse rounded bg-muted mb-2" />
            <div className="h-6 w-24 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  const fundingPositive = market.fundingRateBpsPerSlot >= 0n;

  const stats = [
    {
      label: 'Mark Price',
      value: `$${formatPriceE6(market.markPriceE6)}`,
    },
    {
      label: '8h Funding',
      value: formatFundingRate8h(market.fundingRateBpsPerSlot),
      color: fundingPositive ? 'text-trade-green' : 'text-trade-red',
    },
    {
      label: 'Open Interest',
      value: formatNativeUnits(market.totalOI, marketConfig.decimals, marketConfig.symbol),
    },
    {
      label: 'Vault Balance',
      value: formatNativeUnits(market.engine.vault, marketConfig.decimals, marketConfig.symbol),
    },
    {
      label: 'Insurance Fund',
      value: formatNativeUnits(market.engine.insuranceFund.balance, marketConfig.decimals, marketConfig.symbol),
    },
    {
      label: 'Accounts',
      value: String(market.engine.numUsedAccounts),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">{stat.label}</div>
          <div className={`text-lg font-bold ${stat.color || 'text-foreground'}`}>
            {stat.value}
          </div>
        </div>
      ))}
    </div>
  );
}
