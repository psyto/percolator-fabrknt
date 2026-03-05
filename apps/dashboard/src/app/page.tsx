'use client';

import { useState } from 'react';
import { Header } from '@/components/header';
import { MarketSummary } from '@/components/market-summary';
import { PositionsTable } from '@/components/positions-table';
import { AccountsTable } from '@/components/accounts-table';
import { useMarket } from '@/hooks/use-market';
import { MARKETS } from '@/lib/solana/config';

type Tab = 'summary' | 'positions' | 'accounts';

export default function DashboardPage() {
  const [marketKey, setMarketKey] = useState(() => {
    const keys = Object.keys(MARKETS);
    return keys[0] || 'SOL';
  });
  const [tab, setTab] = useState<Tab>('summary');

  const marketConfig = MARKETS[marketKey];
  const { data: market, isLoading, error } = useMarket(marketKey);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'summary', label: 'Summary' },
    { key: 'positions', label: 'Positions' },
    { key: 'accounts', label: 'Accounts' },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <Header marketKey={marketKey} onMarketChange={setMarketKey} />

      {marketConfig ? (
        <div className="flex-1 p-4 space-y-4">
          {/* Tab bar */}
          <div className="flex gap-1 border-b border-border pb-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-t px-4 py-2 text-sm transition-colors ${
                  tab === t.key
                    ? 'bg-card text-accent border-b-2 border-accent'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="rounded-lg border border-trade-red/30 bg-trade-red/10 px-4 py-3 text-sm text-trade-red">
              Failed to fetch market: {String(error)}
            </div>
          )}

          {tab === 'summary' && (
            <MarketSummary
              market={market}
              marketConfig={marketConfig}
              isLoading={isLoading}
            />
          )}
          {tab === 'positions' && (
            <PositionsTable market={market} marketConfig={marketConfig} />
          )}
          {tab === 'accounts' && (
            <AccountsTable market={market} marketConfig={marketConfig} />
          )}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          No market configured.
        </div>
      )}
    </div>
  );
}
