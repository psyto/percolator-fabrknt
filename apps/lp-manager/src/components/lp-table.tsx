'use client';

import { useState, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import type { MarketData } from '@/hooks/use-market';
import type { MarketConfig } from '@/lib/solana/config';
import { AccountKind } from '@/lib/percolator';
import { formatNativeUnits } from '@/lib/format';

interface LpTableProps {
  market: MarketData | null | undefined;
  marketConfig: MarketConfig;
  onSelectLp: (idx: number) => void;
}

export function LpTable({ market, marketConfig, onSelectLp }: LpTableProps) {
  const { publicKey } = useWallet();
  const [filterMine, setFilterMine] = useState(false);

  const lps = useMemo(() => {
    if (!market) return [];
    return market.accounts
      .filter((a) => a.account.kind === AccountKind.LP)
      .filter((a) => {
        if (!filterMine || !publicKey) return true;
        return a.account.owner.toBase58() === publicKey.toBase58();
      })
      .sort((a, b) => a.idx - b.idx);
  }, [market, filterMine, publicKey]);

  if (!market) {
    return <div className="text-muted-foreground text-sm p-4">Loading...</div>;
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {lps.length} LP{lps.length !== 1 ? 's' : ''}
        </span>
        {publicKey && (
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={filterMine}
              onChange={(e) => setFilterMine(e.target.checked)}
              className="accent-accent"
            />
            My LPs
          </label>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 py-2 text-left text-xs text-muted-foreground">Idx</th>
              <th className="px-3 py-2 text-left text-xs text-muted-foreground">Owner</th>
              <th className="px-3 py-2 text-right text-xs text-muted-foreground">Collateral</th>
              <th className="px-3 py-2 text-right text-xs text-muted-foreground">Position</th>
              <th className="px-3 py-2 text-right text-xs text-muted-foreground">PnL</th>
              <th className="px-3 py-2 text-left text-xs text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody>
            {lps.map((lp) => {
              const isMine = publicKey && lp.account.owner.toBase58() === publicKey.toBase58();
              return (
                <tr
                  key={lp.idx}
                  className={`border-b border-border/50 hover:bg-muted/30 cursor-pointer ${isMine ? 'bg-accent/5' : ''}`}
                  onClick={() => onSelectLp(lp.idx)}
                >
                  <td className="px-3 py-2 text-muted-foreground">{lp.idx}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {lp.account.owner.toBase58().slice(0, 8)}...
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatNativeUnits(lp.account.capital, marketConfig.decimals, marketConfig.symbol)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {lp.account.positionSize === 0n
                      ? '-'
                      : formatNativeUnits(lp.account.positionSize, marketConfig.decimals, marketConfig.symbol)}
                  </td>
                  <td className={`px-3 py-2 text-right ${lp.account.pnl >= 0n ? 'text-trade-green' : 'text-trade-red'}`}>
                    {lp.account.pnl === 0n
                      ? '-'
                      : `${lp.account.pnl >= 0n ? '+' : ''}${formatNativeUnits(lp.account.pnl, marketConfig.decimals, marketConfig.symbol)}`}
                  </td>
                  <td className="px-3 py-2">
                    {isMine && (
                      <span className="rounded bg-accent/20 px-1.5 py-0.5 text-xs text-accent">
                        mine
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {lps.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  No LP accounts found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
