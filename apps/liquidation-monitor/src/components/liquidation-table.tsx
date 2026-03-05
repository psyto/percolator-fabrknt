'use client';

import { useMemo } from 'react';
import type { MarketData } from '@/hooks/use-market';
import type { MarketConfig } from '@/lib/solana/config';
import { computeMarginRatio, type RiskLevel } from '@/lib/health';
import { formatNativeUnits, formatPriceE6 } from '@/lib/format';

interface LiquidationTableProps {
  market: MarketData | null | undefined;
  marketConfig: MarketConfig;
}

const RISK_COLORS: Record<RiskLevel, string> = {
  healthy: 'bg-trade-green/5',
  warning: 'bg-risk-yellow/10',
  danger: 'bg-trade-red/10',
  liquidatable: 'bg-trade-red/20',
};

const RISK_TEXT: Record<RiskLevel, string> = {
  healthy: 'text-trade-green',
  warning: 'text-risk-yellow',
  danger: 'text-trade-red',
  liquidatable: 'text-trade-red',
};

export function LiquidationTable({ market, marketConfig }: LiquidationTableProps) {
  const rows = useMemo(() => {
    if (!market) return [];
    return market.accounts
      .filter((a) => a.account.positionSize !== 0n)
      .map((a) => {
        const health = computeMarginRatio(
          a.account,
          market.markPriceE6,
          marketConfig.decimals,
          market.params.maintenanceMarginBps,
        );
        return { ...a, health };
      })
      .sort((a, b) => a.health.marginRatioBps - b.health.marginRatioBps);
  }, [market, marketConfig]);

  if (!market) {
    return <div className="text-muted-foreground text-sm p-4">Loading...</div>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-3 py-2 text-left text-xs text-muted-foreground">Idx</th>
            <th className="px-3 py-2 text-left text-xs text-muted-foreground">Owner</th>
            <th className="px-3 py-2 text-left text-xs text-muted-foreground">Side</th>
            <th className="px-3 py-2 text-right text-xs text-muted-foreground">Size</th>
            <th className="px-3 py-2 text-right text-xs text-muted-foreground">Capital</th>
            <th className="px-3 py-2 text-right text-xs text-muted-foreground">Margin %</th>
            <th className="px-3 py-2 text-left text-xs text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isLong = r.account.positionSize > 0n;
            const absPos = isLong ? r.account.positionSize : -r.account.positionSize;
            return (
              <tr key={r.idx} className={`border-b border-border/50 ${RISK_COLORS[r.health.riskLevel]}`}>
                <td className="px-3 py-2 text-muted-foreground">{r.idx}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                  {r.account.owner.toBase58().slice(0, 8)}...
                </td>
                <td className="px-3 py-2">
                  <span className={isLong ? 'text-trade-green' : 'text-trade-red'}>
                    {isLong ? 'LONG' : 'SHORT'}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">
                  {formatNativeUnits(absPos, marketConfig.decimals, marketConfig.symbol)}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatNativeUnits(r.account.capital, marketConfig.decimals, marketConfig.symbol)}
                </td>
                <td className={`px-3 py-2 text-right font-medium ${RISK_TEXT[r.health.riskLevel]}`}>
                  {(r.health.marginRatioBps / 100).toFixed(1)}%
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                    r.health.riskLevel === 'liquidatable'
                      ? 'bg-trade-red/30 text-trade-red'
                      : r.health.riskLevel === 'danger'
                        ? 'bg-trade-red/20 text-trade-red'
                        : r.health.riskLevel === 'warning'
                          ? 'bg-risk-yellow/20 text-risk-yellow'
                          : 'bg-trade-green/20 text-trade-green'
                  }`}>
                    {r.health.riskLevel}
                  </span>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                No accounts with open positions
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
