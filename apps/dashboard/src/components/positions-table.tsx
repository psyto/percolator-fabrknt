'use client';

import { useState, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import type { MarketData } from '@/hooks/use-market';
import type { MarketConfig } from '@/lib/solana/config';
import { AccountKind } from '@/lib/percolator';
import { formatNativeUnits, formatPriceE6 } from '@/lib/format';

interface PositionsTableProps {
  market: MarketData | null | undefined;
  marketConfig: MarketConfig;
}

type SortField = 'size' | 'pnl' | 'margin';
type SortDir = 'asc' | 'desc';

export function PositionsTable({ market, marketConfig }: PositionsTableProps) {
  const { publicKey } = useWallet();
  const [filterMine, setFilterMine] = useState(false);
  const [sortField, setSortField] = useState<SortField>('size');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const positions = useMemo(() => {
    if (!market) return [];
    return market.accounts
      .filter((a) => a.account.positionSize !== 0n)
      .filter((a) => {
        if (!filterMine || !publicKey) return true;
        return a.account.owner.toBase58() === publicKey.toBase58();
      })
      .map((a) => {
        const pos = a.account.positionSize;
        const absPos = pos < 0n ? -pos : pos;
        const marginRatio = a.account.capital > 0n && absPos > 0n && market.markPriceE6 > 0n
          ? Number(a.account.capital * 10000n * BigInt(10 ** marketConfig.decimals)) /
            Number(absPos * market.markPriceE6)
          : 0;
        return { ...a, absPos, marginRatio };
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === 'size') cmp = Number(a.absPos - b.absPos);
        else if (sortField === 'pnl') cmp = Number(a.account.pnl - b.account.pnl);
        else cmp = a.marginRatio - b.marginRatio;
        return sortDir === 'desc' ? -cmp : cmp;
      });
  }, [market, filterMine, publicKey, sortField, sortDir, marketConfig]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortIndicator = (field: SortField) =>
    sortField === field ? (sortDir === 'asc' ? ' ^' : ' v') : '';

  if (!market) {
    return <div className="text-muted-foreground text-sm p-4">Loading...</div>;
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {positions.length} position{positions.length !== 1 ? 's' : ''}
        </span>
        {publicKey && (
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={filterMine}
              onChange={(e) => setFilterMine(e.target.checked)}
              className="accent-accent"
            />
            My positions
          </label>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2 text-left text-xs text-muted-foreground">Idx</th>
              <th className="px-3 py-2 text-left text-xs text-muted-foreground">Owner</th>
              <th className="px-3 py-2 text-left text-xs text-muted-foreground">Side</th>
              <th
                className="px-3 py-2 text-right text-xs text-muted-foreground cursor-pointer hover:text-foreground"
                onClick={() => toggleSort('size')}
              >
                Size{sortIndicator('size')}
              </th>
              <th className="px-3 py-2 text-right text-xs text-muted-foreground">Entry</th>
              <th
                className="px-3 py-2 text-right text-xs text-muted-foreground cursor-pointer hover:text-foreground"
                onClick={() => toggleSort('pnl')}
              >
                uPnL{sortIndicator('pnl')}
              </th>
              <th
                className="px-3 py-2 text-right text-xs text-muted-foreground cursor-pointer hover:text-foreground"
                onClick={() => toggleSort('margin')}
              >
                Margin %{sortIndicator('margin')}
              </th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const isLong = p.account.positionSize > 0n;
              const isMine = publicKey && p.account.owner.toBase58() === publicKey.toBase58();
              return (
                <tr
                  key={p.idx}
                  className={`border-b border-border/50 hover:bg-muted/30 ${isMine ? 'bg-accent/5' : ''}`}
                >
                  <td className="px-3 py-2 text-muted-foreground">{p.idx}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {p.account.owner.toBase58().slice(0, 8)}...
                  </td>
                  <td className="px-3 py-2">
                    <span className={isLong ? 'text-trade-green' : 'text-trade-red'}>
                      {isLong ? 'LONG' : 'SHORT'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatNativeUnits(p.absPos, marketConfig.decimals, marketConfig.symbol)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    ${formatPriceE6(p.account.entryPrice)}
                  </td>
                  <td className={`px-3 py-2 text-right ${p.account.pnl >= 0n ? 'text-trade-green' : 'text-trade-red'}`}>
                    {p.account.pnl >= 0n ? '+' : ''}
                    {formatNativeUnits(p.account.pnl, marketConfig.decimals, marketConfig.symbol)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {(p.marginRatio * 100).toFixed(1)}%
                  </td>
                </tr>
              );
            })}
            {positions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  No open positions
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
