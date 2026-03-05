'use client';

import { useQuery } from '@tanstack/react-query';

async function fetchSolPrice(): Promise<number> {
  // Try CoinGecko first
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.solana?.usd) return data.solana.usd;
    }
  } catch {
    // Fall through to Pyth
  }

  // Fallback: Pyth Hermes (SOL/USD feed)
  try {
    const res = await fetch(
      'https://hermes.pyth.network/v2/updates/price/latest?ids[]=ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const data = await res.json();
      const priceData = data?.parsed?.[0]?.price;
      if (priceData) {
        const price = Number(priceData.price) * Math.pow(10, priceData.expo);
        if (price > 0) return price;
      }
    }
  } catch {
    // Both failed
  }

  throw new Error('Failed to fetch SOL price');
}

export function useSolPrice() {
  const { data: solUsd = null } = useQuery({
    queryKey: ['sol-price'],
    queryFn: fetchSolPrice,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 2,
  });

  return { solUsd };
}
