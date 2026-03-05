'use client';

import { useMemo } from 'react';
import type { MarketData } from '@/hooks/use-market';
import type { MarketConfig } from '@/lib/solana/config';
import { computeMarginRatio } from '@/lib/health';

interface RiskOverviewProps {
  market: MarketData | null | undefined;
  marketConfig: MarketConfig;
}

export function RiskOverview({ market, marketConfig }: RiskOverviewProps) {
  const counts = useMemo(() => {
    if (!market) return { healthy: 0, warning: 0, danger: 0, liquidatable: 0 };

    const result = { healthy: 0, warning: 0, danger: 0, liquidatable: 0 };
    for (const a of market.accounts) {
      if (a.account.positionSize === 0n) continue;
      const health = computeMarginRatio(
        a.account,
        market.markPriceE6,
        marketConfig.decimals,
        market.params.maintenanceMarginBps,
      );
      result[health.riskLevel]++;
    }
    return result;
  }, [market, marketConfig]);

  const cards = [
    { label: 'Healthy', count: counts.healthy, color: 'text-trade-green', bg: 'bg-trade-green/10' },
    { label: 'Warning', count: counts.warning, color: 'text-risk-yellow', bg: 'bg-risk-yellow/10' },
    { label: 'Danger', count: counts.danger, color: 'text-trade-red', bg: 'bg-trade-red/10' },
    { label: 'Liquidatable', count: counts.liquidatable, color: 'text-trade-red', bg: 'bg-trade-red/20' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-lg border border-border ${card.bg} p-4`}>
          <div className="text-xs text-muted-foreground mb-1">{card.label}</div>
          <div className={`text-2xl font-bold ${card.color}`}>{card.count}</div>
        </div>
      ))}
    </div>
  );
}
