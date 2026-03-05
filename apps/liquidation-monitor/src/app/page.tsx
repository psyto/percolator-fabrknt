'use client';

import { useState } from 'react';
import { Header } from '@/components/header';
import { RiskOverview } from '@/components/risk-overview';
import { LiquidationTable } from '@/components/liquidation-table';
import { CrankStatus } from '@/components/crank-status';
import { ParamsDisplay } from '@/components/params-display';
import { useMarket } from '@/hooks/use-market';
import { MARKETS } from '@/lib/solana/config';

export default function LiquidationMonitorPage() {
  const [marketKey, setMarketKey] = useState(() => {
    const keys = Object.keys(MARKETS);
    return keys[0] || 'SOL';
  });

  const marketConfig = MARKETS[marketKey];
  const { data: market, error } = useMarket(marketKey);

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

          <RiskOverview market={market} marketConfig={marketConfig} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <LiquidationTable market={market} marketConfig={marketConfig} />
            </div>
            <div className="space-y-4">
              <CrankStatus market={market} />
              <ParamsDisplay market={market} />
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
