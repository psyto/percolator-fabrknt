'use client';

import { useQuery } from '@tanstack/react-query';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import {
  parseHeader,
  parseConfig,
  parseEngine,
  parseParams,
  parseAllAccounts,
} from '@/lib/percolator';
import type {
  SlabHeader,
  MarketConfig as SlabConfig,
  EngineState,
  RiskParams,
  Account,
} from '@/lib/percolator';
import { MARKETS } from '@/lib/solana/config';

export interface MarketData {
  header: SlabHeader;
  config: SlabConfig;
  engine: EngineState;
  params: RiskParams;
  accounts: { idx: number; account: Account }[];
  markPriceE6: bigint;
  fundingRateBpsPerSlot: bigint;
  totalOI: bigint;
}

export function useMarket(marketKey: string) {
  const { connection } = useConnection();
  const marketConfig = MARKETS[marketKey];

  return useQuery<MarketData | null>({
    queryKey: ['market', marketKey],
    queryFn: async () => {
      if (!marketConfig) return null;

      const slabPubkey = new PublicKey(marketConfig.slab);
      const info = await connection.getAccountInfo(slabPubkey);
      if (!info) return null;

      const data = Buffer.from(info.data);
      const header = parseHeader(data);
      const config = parseConfig(data);
      const engine = parseEngine(data);
      const params = parseParams(data);
      const accounts = parseAllAccounts(data);

      const markPriceE6 = config.lastEffectivePriceE6 > 0n
        ? config.lastEffectivePriceE6
        : config.authorityPriceE6;

      return {
        header,
        config,
        engine,
        params,
        accounts,
        markPriceE6,
        fundingRateBpsPerSlot: engine.fundingRateBpsPerSlotLast,
        totalOI: engine.totalOpenInterest,
      };
    },
    enabled: !!marketConfig,
    refetchInterval: 2000,
    staleTime: 1000,
  });
}
