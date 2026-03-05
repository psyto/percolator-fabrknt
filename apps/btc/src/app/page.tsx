'use client';

import { useState } from 'react';
import { Header } from '@/components/header';
import { MarketStats } from '@/components/market-stats';
import { OrderForm } from '@/components/order-form';
import { PositionPanel } from '@/components/position-panel';
import { AccountPanel } from '@/components/account-panel';
import { useMarket } from '@/hooks/use-market';
import { useTrade } from '@/hooks/use-trade';
import { MARKETS } from '@/lib/solana/config';

export default function TradingPage() {
  const [marketKey, setMarketKey] = useState(() => {
    const keys = Object.keys(MARKETS);
    return keys[0] || 'SOL';
  });

  const marketConfig = MARKETS[marketKey];
  const { data: market, isLoading, error } = useMarket(marketKey);
  const slabMissing = !isLoading && !market && !error;
  const { userAccount, initUser, deposit, withdraw, trade } = useTrade(
    marketKey,
    market,
  );

  const newAccountFee = market?.params.newAccountFee ?? 0n;

  return (
    <div className="flex min-h-screen flex-col">
      <Header marketKey={marketKey} onMarketChange={setMarketKey} />

      {marketConfig ? (
        <>
          <MarketStats
            market={market}
            marketConfig={marketConfig}
            isLoading={isLoading}
          />

          {slabMissing && (
            <div className="mx-4 mt-2 rounded-lg border border-trade-red/30 bg-trade-red/10 px-4 py-3 text-sm text-trade-red">
              Slab account not found on-chain. The market may need to be redeployed.
              <span className="block mt-1 text-xs text-muted-foreground font-mono">
                {marketConfig.slab}
              </span>
            </div>
          )}
          {error && (
            <div className="mx-4 mt-2 rounded-lg border border-trade-red/30 bg-trade-red/10 px-4 py-3 text-sm text-trade-red">
              Failed to fetch market: {String(error)}
            </div>
          )}

          <div className="flex flex-1 flex-col gap-4 p-4 lg:flex-row">
            {/* Left: Position */}
            <div className="flex-1 space-y-4">
              <PositionPanel
                userAccount={userAccount}
                market={market}
                marketConfig={marketConfig}
                onTrade={trade}
              />
              {!userAccount && market && (
                <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
                  Create an account and deposit collateral to start trading.
                </div>
              )}
            </div>

            {/* Right: Order form + Account */}
            <div className="w-full space-y-4 lg:w-80">
              <OrderForm
                market={market}
                marketConfig={marketConfig}
                onTrade={trade}
                hasAccount={!!userAccount}
              />
              <AccountPanel
                userAccount={userAccount}
                marketConfig={marketConfig}
                newAccountFee={newAccountFee}
                marketLoaded={!!market}
                onInitUser={initUser}
                onDeposit={deposit}
                onWithdraw={withdraw}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          No market configured. Check your environment variables.
        </div>
      )}
    </div>
  );
}
