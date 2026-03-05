'use client';

import { useQuery } from '@tanstack/react-query';

async function fetchBtcPrice(): Promise<number> {
  // Try CoinGecko first
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const data = await res.json();
      if (data?.bitcoin?.usd) return data.bitcoin.usd;
    }
  } catch {
    // Fall through to Pyth
  }

  // Fallback: Pyth Hermes
  try {
    const res = await fetch(
      'https://hermes.pyth.network/v2/updates/price/latest?ids[]=e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
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

  throw new Error('Failed to fetch BTC price');
}

export function useBtcPrice() {
  const { data: btcUsd = null } = useQuery({
    queryKey: ['btc-price'],
    queryFn: fetchBtcPrice,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 2,
  });

  return { btcUsd };
}
