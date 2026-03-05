'use client';

import type { MatcherParams } from '@/hooks/use-matcher-context';

interface MatcherInfoProps {
  params: MatcherParams | null | undefined;
  isLoading: boolean;
}

export function MatcherInfo({ params, isLoading }: MatcherInfoProps) {
  if (isLoading || !params) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="h-4 w-32 animate-pulse rounded bg-muted mb-2" />
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  const modeStr = params.kind === 0 ? 'Passive' : 'vAMM';

  const items = [
    { label: 'Mode', value: modeStr },
    { label: 'Trading Fee', value: `${(params.feeBps / 100).toFixed(2)}%` },
    { label: 'Spread', value: `${(params.spreadBps / 100).toFixed(2)}%` },
    { label: 'Impact K', value: `${params.impactKBps} bps` },
    { label: 'Liquidity', value: `${Number(params.liquidityE6) / 1_000_000}` },
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-xs text-muted-foreground mb-3">Matcher Parameters</h3>
      <div className="space-y-2 text-sm">
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
