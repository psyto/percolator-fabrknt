'use client';

import type { MarketData } from '@/hooks/use-market';

interface CrankStatusProps {
  market: MarketData | null | undefined;
}

export function CrankStatus({ market }: CrankStatusProps) {
  if (!market) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="h-4 w-24 animate-pulse rounded bg-muted mb-2" />
        <div className="h-6 w-32 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  const lastCrankSlot = market.engine.lastCrankSlot;
  // Staleness: we can't get current slot here, so show the raw value
  // and indicate if it seems stale relative to the engine data
  const maxStaleness = market.params.maxCrankStalenessSlots;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-xs text-muted-foreground mb-2">Crank Status</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Last Crank Slot</span>
          <span className="text-foreground font-mono">{lastCrankSlot.toString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Max Staleness</span>
          <span className="text-foreground">{maxStaleness.toString()} slots</span>
        </div>
      </div>
    </div>
  );
}
