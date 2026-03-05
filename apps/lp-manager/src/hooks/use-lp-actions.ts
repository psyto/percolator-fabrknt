'use client';

import { useCallback, useMemo } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from '@solana/spl-token';
import {
  encodeInitLP,
  encodeDepositCollateral,
  encodeWithdrawCollateral,
  ACCOUNTS_INIT_LP,
  ACCOUNTS_DEPOSIT_COLLATERAL,
  ACCOUNTS_WITHDRAW_COLLATERAL,
  buildAccountMetas,
  WELL_KNOWN,
  deriveVaultAuthority,
  AccountKind,
} from '@/lib/percolator';
import type { Account } from '@/lib/percolator';
import type { MarketData } from '@/hooks/use-market';
import { PROGRAM_ID, MARKETS } from '@/lib/solana/config';

export function useLpActions(
  marketKey: string,
  market: MarketData | null | undefined,
) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const marketConfig = MARKETS[marketKey];
  const programId = new PublicKey(PROGRAM_ID);
  const accounts = market?.accounts ?? [];

  // Find user's LP accounts
  const myLpAccounts = useMemo(() => {
    if (!publicKey || !accounts) return [];
    return accounts.filter(
      (a) =>
        a.account.kind === AccountKind.LP &&
        a.account.owner.toBase58() === publicKey.toBase58()
    );
  }, [publicKey, accounts]);

  const sendIx = useCallback(
    async (ix: TransactionInstruction, extraIxs?: TransactionInstruction[]) => {
      if (!publicKey || !sendTransaction) throw new Error('Wallet not connected');
      const tx = new Transaction();
      if (extraIxs) extraIxs.forEach((i) => tx.add(i));
      tx.add(ix);
      const latestBlockhash = await connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = latestBlockhash.blockhash;
      tx.feePayer = publicKey;
      const sig = await sendTransaction(tx, connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
      await connection.confirmTransaction(
        {
          signature: sig,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        'confirmed'
      );
      return sig;
    },
    [publicKey, sendTransaction, connection]
  );

  const deposit = useCallback(
    async (lpIdx: number, amount: bigint) => {
      if (!publicKey || !marketConfig || !market)
        throw new Error('No account');

      const slabPubkey = new PublicKey(marketConfig.slab);
      const mintPubkey = market.config.collateralMint;
      const vaultPubkey = market.config.vaultPubkey;
      const userAta = getAssociatedTokenAddressSync(mintPubkey, publicKey);

      const data = encodeDepositCollateral({ userIdx: lpIdx, amount });
      const keys = buildAccountMetas(ACCOUNTS_DEPOSIT_COLLATERAL, [
        publicKey,
        slabPubkey,
        userAta,
        vaultPubkey,
        WELL_KNOWN.tokenProgram,
        WELL_KNOWN.clock,
      ]);
      const ix = new TransactionInstruction({ programId, keys, data });
      return sendIx(ix);
    },
    [publicKey, marketConfig, market, programId, sendIx]
  );

  const withdraw = useCallback(
    async (lpIdx: number, amount: bigint) => {
      if (!publicKey || !marketConfig || !market)
        throw new Error('No account');

      const slabPubkey = new PublicKey(marketConfig.slab);
      const vaultPubkey = market.config.vaultPubkey;
      const mintPubkey = market.config.collateralMint;
      const userAta = getAssociatedTokenAddressSync(mintPubkey, publicKey);
      const [vaultPda] = deriveVaultAuthority(programId, slabPubkey);
      const oraclePubkey = new PublicKey(marketConfig.oracle);

      const data = encodeWithdrawCollateral({ userIdx: lpIdx, amount });
      const keys = buildAccountMetas(ACCOUNTS_WITHDRAW_COLLATERAL, [
        publicKey,
        slabPubkey,
        vaultPubkey,
        userAta,
        vaultPda,
        WELL_KNOWN.tokenProgram,
        WELL_KNOWN.clock,
        oraclePubkey,
      ]);
      const ix = new TransactionInstruction({ programId, keys, data });
      return sendIx(ix);
    },
    [publicKey, marketConfig, market, programId, sendIx]
  );

  return {
    myLpAccounts,
    deposit,
    withdraw,
  };
}
