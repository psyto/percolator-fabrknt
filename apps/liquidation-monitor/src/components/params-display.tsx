'use client';

import type { MarketData } from '@/hooks/use-market';

interface ParamsDisplayProps {
  market: MarketData | null | undefined;
}

export function ParamsDisplay({ market }: ParamsDisplayProps) {
  if (!market) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  const { params } = market;

  const items = [
    { label: 'Maintenance Margin', value: `${Number(params.maintenanceMarginBps) / 100}%` },
    { label: 'Initial Margin', value: `${Number(params.initialMarginBps) / 100}%` },
    { label: 'Liquidation Fee', value: `${Number(params.liquidationFeeBps) / 100}%` },
    { label: 'Liquidation Buffer', value: `${Number(params.liquidationBufferBps) / 100}%` },
    { label: 'Liquidation Fee Cap', value: params.liquidationFeeCap.toString() },
    { label: 'Min Liquidation', value: params.minLiquidationAbs.toString() },
    { label: 'Trading Fee', value: `${Number(params.tradingFeeBps) / 100}%` },
    { label: 'Warmup Period', value: `${params.warmupPeriodSlots} slots` },
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-xs text-muted-foreground mb-3">Liquidation Parameters</h3>
      <div className="grid grid-cols-2 gap-2 text-sm">
        {items.map((item) => (
          <div key={item.label} className="flex justify-between">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="text-foreground font-mono">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
