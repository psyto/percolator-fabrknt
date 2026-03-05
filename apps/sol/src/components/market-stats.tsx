'use client';

import type { MarketData } from '@/hooks/use-market';
import {
  formatPriceE6,
  formatFundingRate8h,
  formatNativeUnits,
} from '@/lib/format';
import type { MarketConfig } from '@/lib/solana/config';

interface MarketStatsProps {
  market: MarketData | null | undefined;
  marketConfig: MarketConfig;
  isLoading: boolean;
}

export function MarketStats({ market, marketConfig, isLoading }: MarketStatsProps) {
  if (isLoading || !market) {
    return (
      <div className="flex items-center gap-8 border-b border-border px-4 py-3">
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
        <div className="h-5 w-24 animate-pulse rounded bg-muted" />
        <div className="h-5 w-24 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  const priceStr = formatPriceE6(market.markPriceE6);
  const fundingStr = formatFundingRate8h(market.fundingRateBpsPerSlot);
  const fundingPositive = market.fundingRateBpsPerSlot >= 0n;

  const oiStr = formatNativeUnits(
    market.totalOI,
    marketConfig.decimals,
    marketConfig.symbol
  );

  return (
    <div className="flex flex-wrap items-center gap-6 border-b border-border px-4 py-3 text-sm">
      {/* Mark Price */}
      <div>
        <div className="text-muted-foreground text-xs">Mark Price</div>
        <div className="text-lg font-bold text-foreground">${priceStr}</div>
      </div>

      {/* Funding Rate */}
      <div>
        <div className="text-muted-foreground text-xs">8h Funding</div>
        <div
          className={`font-medium ${
            fundingPositive ? 'text-trade-green' : 'text-trade-red'
          }`}
        >
          {fundingStr}
        </div>
      </div>

      {/* Open Interest */}
      <div>
        <div className="text-muted-foreground text-xs">Open Interest</div>
        <div className="font-medium text-foreground">{oiStr}</div>
      </div>

      {/* Vault */}
      <div>
        <div className="text-muted-foreground text-xs">Vault</div>
        <div className="font-medium text-foreground">
          {formatNativeUnits(market.engine.vault, marketConfig.decimals, marketConfig.symbol)}
        </div>
      </div>

      {/* Accounts */}
      <div>
        <div className="text-muted-foreground text-xs">Accounts</div>
        <div className="font-medium text-foreground">
          {market.engine.numUsedAccounts}
        </div>
      </div>
    </div>
  );
}
