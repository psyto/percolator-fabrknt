'use client';

import { useState } from 'react';
import { Header } from '@/components/header';
import { LpOverview } from '@/components/lp-overview';
import { LpTable } from '@/components/lp-table';
import { LpCard } from '@/components/lp-card';
import { MatcherInfo } from '@/components/matcher-info';
import { useMarket } from '@/hooks/use-market';
import { useLpActions } from '@/hooks/use-lp-actions';
import { useMatcherContext } from '@/hooks/use-matcher-context';
import { MARKETS } from '@/lib/solana/config';
import { AccountKind } from '@/lib/percolator';

export default function LpManagerPage() {
  const [marketKey, setMarketKey] = useState(() => {
    const keys = Object.keys(MARKETS);
    return keys[0] || 'SOL';
  });
  const [selectedLpIdx, setSelectedLpIdx] = useState<number | null>(null);

  const marketConfig = MARKETS[marketKey];
  const { data: market, error } = useMarket(marketKey);
  const { myLpAccounts, deposit, withdraw } = useLpActions(marketKey, market);

  // Get matcher context for the selected LP
  const selectedLp = market?.accounts.find(
    (a) => a.idx === selectedLpIdx && a.account.kind === AccountKind.LP
  );
  const matcherContextKey = selectedLp
    ? selectedLp.account.matcherContext.toBase58()
    : null;
  const { data: matcherParams, isLoading: matcherLoading } = useMatcherContext(matcherContextKey);

  return (
    <div className="flex min-h-screen flex-col">
      <Header marketKey={marketKey} onMarketChange={setMarketKey} />

      {marketConfig ? (
        <div className="flex-1 p-4 space-y-4">
          {error && (
            <div className="rounded-lg border border-trade-red/30 bg-trade-red/10 px-4 py-3 text-sm text-trade-red">
              Failed to fetch market: {String(error)}
            </div>
          )}

          <LpOverview market={market} marketConfig={marketConfig} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <LpTable
                market={market}
                marketConfig={marketConfig}
                onSelectLp={setSelectedLpIdx}
              />
            </div>
            <div className="space-y-4">
              {selectedLpIdx !== null && (
                <>
                  <LpCard
                    lpIdx={selectedLpIdx}
                    market={market}
                    marketConfig={marketConfig}
                    onDeposit={deposit}
                    onWithdraw={withdraw}
                    onClose={() => setSelectedLpIdx(null)}
                  />
                  <MatcherInfo params={matcherParams} isLoading={matcherLoading} />
                </>
              )}
              {selectedLpIdx === null && (
                <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                  Select an LP from the table to view details
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          No market configured.
        </div>
      )}
    </div>
  );
}
