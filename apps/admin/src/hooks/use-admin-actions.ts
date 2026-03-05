'use client';

import { useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import {
  encodeUpdateConfig,
  encodeSetRiskThreshold,
  encodeSetMaintenanceFee,
  encodeSetOracleAuthority,
  encodePushOraclePrice,
  encodeSetOraclePriceCap,
  encodeResolveMarket,
  encodeWithdrawInsurance,
  encodeUpdateAdmin,
  encodeTopUpInsurance,
  ACCOUNTS_UPDATE_CONFIG,
  ACCOUNTS_SET_RISK_THRESHOLD,
  ACCOUNTS_SET_MAINTENANCE_FEE,
  ACCOUNTS_SET_ORACLE_AUTHORITY,
  ACCOUNTS_PUSH_ORACLE_PRICE,
  ACCOUNTS_SET_ORACLE_PRICE_CAP,
  ACCOUNTS_RESOLVE_MARKET,
  ACCOUNTS_WITHDRAW_INSURANCE,
  ACCOUNTS_UPDATE_ADMIN,
  ACCOUNTS_TOPUP_INSURANCE,
  buildAccountMetas,
  WELL_KNOWN,
  deriveVaultAuthority,
} from '@/lib/percolator';
import type {
  UpdateConfigArgs,
  SetRiskThresholdArgs,
  SetMaintenanceFeeArgs,
  SetOracleAuthorityArgs,
  PushOraclePriceArgs,
  SetOraclePriceCapArgs,
  UpdateAdminArgs,
  TopUpInsuranceArgs,
} from '@/lib/percolator';
import type { MarketData } from '@/hooks/use-market';
import { PROGRAM_ID, MARKETS } from '@/lib/solana/config';

export function useAdminActions(
  marketKey: string,
  market: MarketData | null | undefined,
) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const marketConfig = MARKETS[marketKey];
  const programId = new PublicKey(PROGRAM_ID);

  const sendIx = useCallback(
    async (ix: TransactionInstruction) => {
      if (!publicKey || !sendTransaction) throw new Error('Wallet not connected');
      const tx = new Transaction();
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

  const slabPubkey = marketConfig ? new PublicKey(marketConfig.slab) : null;

  const updateConfig = useCallback(
    async (args: UpdateConfigArgs) => {
      if (!publicKey || !slabPubkey) throw new Error('Not ready');
      const data = encodeUpdateConfig(args);
      const keys = buildAccountMetas(ACCOUNTS_UPDATE_CONFIG, [publicKey, slabPubkey]);
      return sendIx(new TransactionInstruction({ programId, keys, data }));
    },
    [publicKey, slabPubkey, programId, sendIx]
  );

  const setRiskThreshold = useCallback(
    async (args: SetRiskThresholdArgs) => {
      if (!publicKey || !slabPubkey) throw new Error('Not ready');
      const data = encodeSetRiskThreshold(args);
      const keys = buildAccountMetas(ACCOUNTS_SET_RISK_THRESHOLD, [publicKey, slabPubkey]);
      return sendIx(new TransactionInstruction({ programId, keys, data }));
    },
    [publicKey, slabPubkey, programId, sendIx]
  );

  const setMaintenanceFee = useCallback(
    async (args: SetMaintenanceFeeArgs) => {
      if (!publicKey || !slabPubkey) throw new Error('Not ready');
      const data = encodeSetMaintenanceFee(args);
      const keys = buildAccountMetas(ACCOUNTS_SET_MAINTENANCE_FEE, [publicKey, slabPubkey]);
      return sendIx(new TransactionInstruction({ programId, keys, data }));
    },
    [publicKey, slabPubkey, programId, sendIx]
  );

  const setOracleAuthority = useCallback(
    async (args: SetOracleAuthorityArgs) => {
      if (!publicKey || !slabPubkey) throw new Error('Not ready');
      const data = encodeSetOracleAuthority(args);
      const keys = buildAccountMetas(ACCOUNTS_SET_ORACLE_AUTHORITY, [publicKey, slabPubkey]);
      return sendIx(new TransactionInstruction({ programId, keys, data }));
    },
    [publicKey, slabPubkey, programId, sendIx]
  );

  const pushOraclePrice = useCallback(
    async (args: PushOraclePriceArgs) => {
      if (!publicKey || !slabPubkey) throw new Error('Not ready');
      const data = encodePushOraclePrice(args);
      const keys = buildAccountMetas(ACCOUNTS_PUSH_ORACLE_PRICE, [publicKey, slabPubkey]);
      return sendIx(new TransactionInstruction({ programId, keys, data }));
    },
    [publicKey, slabPubkey, programId, sendIx]
  );

  const setOraclePriceCap = useCallback(
    async (args: SetOraclePriceCapArgs) => {
      if (!publicKey || !slabPubkey) throw new Error('Not ready');
      const data = encodeSetOraclePriceCap(args);
      const keys = buildAccountMetas(ACCOUNTS_SET_ORACLE_PRICE_CAP, [publicKey, slabPubkey]);
      return sendIx(new TransactionInstruction({ programId, keys, data }));
    },
    [publicKey, slabPubkey, programId, sendIx]
  );

  const resolveMarket = useCallback(
    async () => {
      if (!publicKey || !slabPubkey) throw new Error('Not ready');
      const data = encodeResolveMarket();
      const keys = buildAccountMetas(ACCOUNTS_RESOLVE_MARKET, [publicKey, slabPubkey]);
      return sendIx(new TransactionInstruction({ programId, keys, data }));
    },
    [publicKey, slabPubkey, programId, sendIx]
  );

  const withdrawInsurance = useCallback(
    async () => {
      if (!publicKey || !slabPubkey || !market) throw new Error('Not ready');
      const mintPubkey = market.config.collateralMint;
      const vaultPubkey = market.config.vaultPubkey;
      const adminAta = getAssociatedTokenAddressSync(mintPubkey, publicKey);
      const [vaultPda] = deriveVaultAuthority(programId, slabPubkey);
      const data = encodeWithdrawInsurance();
      const keys = buildAccountMetas(ACCOUNTS_WITHDRAW_INSURANCE, [
        publicKey,
        slabPubkey,
        adminAta,
        vaultPubkey,
        WELL_KNOWN.tokenProgram,
        vaultPda,
      ]);
      return sendIx(new TransactionInstruction({ programId, keys, data }));
    },
    [publicKey, slabPubkey, market, programId, sendIx]
  );

  const updateAdmin = useCallback(
    async (args: UpdateAdminArgs) => {
      if (!publicKey || !slabPubkey) throw new Error('Not ready');
      const data = encodeUpdateAdmin(args);
      const keys = buildAccountMetas(ACCOUNTS_UPDATE_ADMIN, [publicKey, slabPubkey]);
      return sendIx(new TransactionInstruction({ programId, keys, data }));
    },
    [publicKey, slabPubkey, programId, sendIx]
  );

  const topUpInsurance = useCallback(
    async (args: TopUpInsuranceArgs) => {
      if (!publicKey || !slabPubkey || !market) throw new Error('Not ready');
      const mintPubkey = market.config.collateralMint;
      const vaultPubkey = market.config.vaultPubkey;
      const userAta = getAssociatedTokenAddressSync(mintPubkey, publicKey);
      const data = encodeTopUpInsurance(args);
      const keys = buildAccountMetas(ACCOUNTS_TOPUP_INSURANCE, [
        publicKey,
        slabPubkey,
        userAta,
        vaultPubkey,
        WELL_KNOWN.tokenProgram,
      ]);
      return sendIx(new TransactionInstruction({ programId, keys, data }));
    },
    [publicKey, slabPubkey, market, programId, sendIx]
  );

  return {
    updateConfig,
    setRiskThreshold,
    setMaintenanceFee,
    setOracleAuthority,
    pushOraclePrice,
    setOraclePriceCap,
    resolveMarket,
    withdrawInsurance,
    updateAdmin,
    topUpInsurance,
  };
}
