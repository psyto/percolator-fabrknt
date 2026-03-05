import { clusterApiUrl } from '@solana/web3.js';

export const SOLANA_NETWORK = (process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet') as
  | 'devnet'
  | 'mainnet-beta'
  | 'testnet';

export const SOLANA_RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(SOLANA_NETWORK);

export const PROGRAM_ID =
  process.env.NEXT_PUBLIC_PROGRAM_ID || '2SSnp35m7FQ7cRLNKGdW5UzjYFF6RBUNq7d3m5mqNByp';

export interface MarketConfig {
  slab: string;
  oracle: string;
  mint: string;
  vault: string;
  symbol: string;
  decimals: number;
  unitScale: number;
  lpIdx: number;
}

export const MARKETS: Record<string, MarketConfig> = {
  SOL: {
    slab: 'A7wQtRT9DhFqYho8wTVqQCDc7kYPTUXGPATiyVbZKVFs',
    oracle: '99B2bTijsU6f1GCT73HmdR7HCFFjGMBcPZY6jZ96ynrR',
    mint: 'So11111111111111111111111111111111111111112',
    vault: '63juJmvm1XHCHveWv9WdanxqJX6tD6DLFTZD7dvH12dc',
    symbol: 'SOL',
    decimals: 9,
    unitScale: 1,
    lpIdx: 0,
  },
  ...(process.env.NEXT_PUBLIC_BTC_SLAB
    ? {
        BTC: {
          slab: process.env.NEXT_PUBLIC_BTC_SLAB,
          oracle: process.env.NEXT_PUBLIC_BTC_ORACLE || '',
          mint: process.env.NEXT_PUBLIC_BTC_MINT || '',
          vault: process.env.NEXT_PUBLIC_BTC_VAULT || '',
          symbol: 'BTC',
          decimals: 8,
          unitScale: 100,
          lpIdx: 0,
        },
      }
    : {}),
};

export function getExplorerUrl(type: 'address' | 'tx', value: string): string {
  const suffix = SOLANA_NETWORK === 'mainnet-beta' ? '' : `?cluster=${SOLANA_NETWORK}`;
  return `https://explorer.solana.com/${type}/${value}${suffix}`;
}
