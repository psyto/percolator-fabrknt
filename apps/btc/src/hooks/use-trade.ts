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
  encodeInitUser,
  encodeDepositCollateral,
  encodeWithdrawCollateral,
  encodeTradeNoCpi,
  ACCOUNTS_INIT_USER,
  ACCOUNTS_DEPOSIT_COLLATERAL,
  ACCOUNTS_WITHDRAW_COLLATERAL,
  ACCOUNTS_TRADE_NOCPI,
  buildAccountMetas,
  WELL_KNOWN,
  deriveVaultAuthority,
} from '@/lib/percolator';
import type { Account, MarketConfig as SlabConfig } from '@/lib/percolator';
import type { MarketData } from '@/hooks/use-market';
import { PROGRAM_ID, MARKETS } from '@/lib/solana/config';

export function useTrade(
  marketKey: string,
  market: MarketData | null | undefined,
) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const marketConfig = MARKETS[marketKey];
  const programId = new PublicKey(PROGRAM_ID);
  const accounts = market?.accounts ?? [];

  // Find user's account index
  const userAccount = useMemo(() => {
    if (!publicKey || !accounts) return null;
    const found = accounts.find(
      (a) => a.account.owner.toBase58() === publicKey.toBase58()
    );
    return found ?? null;
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

  // Use on-chain slab config for vault/mint (matches CLI behavior)
  const initUser = useCallback(
    async (feePayment: bigint) => {
      if (!publicKey || !marketConfig || !market)
        throw new Error('Wallet not connected or market not loaded');

      const slabPubkey = new PublicKey(marketConfig.slab);
      // Read vault and mint from on-chain config, not hardcoded JSON
      const mintPubkey = market.config.collateralMint;
      const vaultPubkey = market.config.vaultPubkey;
      const userAta = getAssociatedTokenAddressSync(mintPubkey, publicKey);

      const data = encodeInitUser({ feePayment });
      const keys = buildAccountMetas(ACCOUNTS_INIT_USER, [
        publicKey,             // user (signer)
        slabPubkey,            // slab
        userAta,               // userAta
        vaultPubkey,           // vault (from on-chain config)
        WELL_KNOWN.tokenProgram,
      ]);
      const ix = new TransactionInstruction({ programId, keys, data });

      // Ensure ATA exists
      const ataInfo = await connection.getAccountInfo(userAta);
      const extraIxs: TransactionInstruction[] = [];
      if (!ataInfo) {
        extraIxs.push(
          createAssociatedTokenAccountInstruction(
            publicKey,
            userAta,
            publicKey,
            mintPubkey
          )
        );
      }

      return sendIx(ix, extraIxs);
    },
    [publicKey, marketConfig, market, programId, connection, sendIx]
  );

  const deposit = useCallback(
    async (amount: bigint) => {
      if (!publicKey || !marketConfig || !market || !userAccount)
        throw new Error('No account');

      const slabPubkey = new PublicKey(marketConfig.slab);
      const mintPubkey = market.config.collateralMint;
      const vaultPubkey = market.config.vaultPubkey;
      const userAta = getAssociatedTokenAddressSync(mintPubkey, publicKey);

      const data = encodeDepositCollateral({
        userIdx: userAccount.idx,
        amount,
      });
      const keys = buildAccountMetas(ACCOUNTS_DEPOSIT_COLLATERAL, [
        publicKey,             // user (signer)
        slabPubkey,            // slab
        userAta,               // userAta
        vaultPubkey,           // vault
        WELL_KNOWN.tokenProgram,
        WELL_KNOWN.clock,
      ]);
      const ix = new TransactionInstruction({ programId, keys, data });
      return sendIx(ix);
    },
    [publicKey, marketConfig, market, userAccount, programId, sendIx]
  );

  const withdraw = useCallback(
    async (amount: bigint) => {
      if (!publicKey || !marketConfig || !market || !userAccount)
        throw new Error('No account');

      const slabPubkey = new PublicKey(marketConfig.slab);
      const vaultPubkey = market.config.vaultPubkey;
      const mintPubkey = market.config.collateralMint;
      const userAta = getAssociatedTokenAddressSync(mintPubkey, publicKey);
      const [vaultPda] = deriveVaultAuthority(programId, slabPubkey);
      const oraclePubkey = new PublicKey(marketConfig.oracle);

      const data = encodeWithdrawCollateral({
        userIdx: userAccount.idx,
        amount,
      });
      const keys = buildAccountMetas(ACCOUNTS_WITHDRAW_COLLATERAL, [
        publicKey,             // user (signer)
        slabPubkey,            // slab
        vaultPubkey,           // vault
        userAta,               // userAta
        vaultPda,              // vaultPda
        WELL_KNOWN.tokenProgram,
        WELL_KNOWN.clock,
        oraclePubkey,          // oracleIdx
      ]);
      const ix = new TransactionInstruction({ programId, keys, data });
      return sendIx(ix);
    },
    [publicKey, marketConfig, market, userAccount, programId, sendIx]
  );

  const trade = useCallback(
    async (size: bigint) => {
      if (!publicKey || !marketConfig || !userAccount)
        throw new Error('No account');

      const slabPubkey = new PublicKey(marketConfig.slab);
      const oraclePubkey = new PublicKey(marketConfig.oracle);

      const data = encodeTradeNoCpi({
        lpIdx: marketConfig.lpIdx,
        userIdx: userAccount.idx,
        size,
      });
      const keys = buildAccountMetas(ACCOUNTS_TRADE_NOCPI, [
        publicKey,             // user (signer)
        publicKey,             // lp (signer) — placeholder for devnet
        slabPubkey,            // slab
        WELL_KNOWN.clock,
        oraclePubkey,          // oracle
      ]);
      const ix = new TransactionInstruction({ programId, keys, data });
      return sendIx(ix);
    },
    [publicKey, marketConfig, userAccount, programId, sendIx]
  );

  return {
    userAccount,
    initUser,
    deposit,
    withdraw,
    trade,
  };
}
