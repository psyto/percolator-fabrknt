'use client';

import { useQuery } from '@tanstack/react-query';
import { useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';

export interface MatcherParams {
  kind: number; // 0 = Passive, 1+ = vAMM
  feeBps: number;
  spreadBps: number;
  impactKBps: number;
  liquidityE6: bigint;
}

/**
 * Fetch and parse a matcher context account.
 * Layout (320 bytes): kind(1) + fee_bps(2) + spread_bps(2) + impact_k_bps(2) + reserved(9) + liquidity_e6(16) + ...
 */
export function useMatcherContext(matcherContextPubkey: string | null) {
  const { connection } = useConnection();

  return useQuery<MatcherParams | null>({
    queryKey: ['matcher-context', matcherContextPubkey],
    queryFn: async () => {
      if (!matcherContextPubkey) return null;

      const pubkey = new PublicKey(matcherContextPubkey);
      const info = await connection.getAccountInfo(pubkey);
      if (!info || info.data.length < 32) return null;

      const data = Buffer.from(info.data);
      return {
        kind: data.readUInt8(0),
        feeBps: data.readUInt16LE(1),
        spreadBps: data.readUInt16LE(3),
        impactKBps: data.readUInt16LE(5),
        liquidityE6: data.readBigUInt64LE(16),
      };
    },
    enabled: !!matcherContextPubkey,
    refetchInterval: 5000,
    staleTime: 3000,
  });
}
