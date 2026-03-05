'use client';

import { useState, useMemo } from 'react';
import type { MarketData } from '@/hooks/use-market';
import type { MarketConfig } from '@/lib/solana/config';
import { AccountKind } from '@/lib/percolator';
import { formatNativeUnits } from '@/lib/format';

interface AccountsTableProps {
  market: MarketData | null | undefined;
  marketConfig: MarketConfig;
}

type FilterType = 'all' | 'user' | 'lp';

export function AccountsTable({ market, marketConfig }: AccountsTableProps) {
  const [filterType, setFilterType] = useState<FilterType>('all');

  const accounts = useMemo(() => {
    if (!market) return [];
    return market.accounts
      .filter((a) => {
        if (filterType === 'all') return true;
        if (filterType === 'user') return a.account.kind === AccountKind.User;
        return a.account.kind === AccountKind.LP;
      })
      .sort((a, b) => a.idx - b.idx);
  }, [market, filterType]);

  if (!market) {
    return <div className="text-muted-foreground text-sm p-4">Loading...</div>;
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {accounts.length} account{accounts.length !== 1 ? 's' : ''}
        </span>
        <div className="flex gap-1">
          {(['all', 'user', 'lp'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`rounded px-2 py-0.5 text-xs transition-colors ${
                filterType === t
                  ? 'bg-accent/20 text-accent'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'all' ? 'All' : t === 'user' ? 'Users' : 'LPs'}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2 text-left text-xs text-muted-foreground">Idx</th>
              <th className="px-3 py-2 text-left text-xs text-muted-foreground">Type</th>
              <th className="px-3 py-2 text-left text-xs text-muted-foreground">Owner</th>
              <th className="px-3 py-2 text-right text-xs text-muted-foreground">Capital</th>
              <th className="px-3 py-2 text-right text-xs text-muted-foreground">Position</th>
              <th className="px-3 py-2 text-right text-xs text-muted-foreground">PnL</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => {
              const isLP = a.account.kind === AccountKind.LP;
              return (
                <tr key={a.idx} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-3 py-2 text-muted-foreground">{a.idx}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs ${
                      isLP ? 'bg-accent/20 text-accent' : 'bg-muted text-muted-foreground'
                    }`}>
                      {isLP ? 'LP' : 'User'}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {a.account.owner.toBase58().slice(0, 8)}...
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatNativeUnits(a.account.capital, marketConfig.decimals, marketConfig.symbol)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {a.account.positionSize === 0n
                      ? '-'
                      : formatNativeUnits(
                          a.account.positionSize,
                          marketConfig.decimals,
                          marketConfig.symbol
                        )}
                  </td>
                  <td className={`px-3 py-2 text-right ${a.account.pnl >= 0n ? 'text-trade-green' : 'text-trade-red'}`}>
                    {a.account.pnl === 0n
                      ? '-'
                      : `${a.account.pnl >= 0n ? '+' : ''}${formatNativeUnits(a.account.pnl, marketConfig.decimals, marketConfig.symbol)}`}
                  </td>
                </tr>
              );
            })}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No accounts found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
