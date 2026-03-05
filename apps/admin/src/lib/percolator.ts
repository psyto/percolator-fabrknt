// Re-export slab parsers
export {
  fetchSlab,
  parseHeader,
  parseConfig,
  parseEngine,
  parseParams,
  parseAccount,
  parseAllAccounts,
  parseUsedIndices,
  AccountKind,
} from '../../../../percolator-cli/src/solana/slab';
export type {
  SlabHeader,
  MarketConfig,
  EngineState,
  RiskParams,
  Account,
} from '../../../../percolator-cli/src/solana/slab';

// Re-export instruction encoders — including all admin instructions
export {
  encodeInitUser,
  encodeDepositCollateral,
  encodeWithdrawCollateral,
  encodeTradeNoCpi,
  encodeInitLP,
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
} from '../../../../percolator-cli/src/abi/instructions';

export type {
  UpdateConfigArgs,
  SetRiskThresholdArgs,
  SetMaintenanceFeeArgs,
  SetOracleAuthorityArgs,
  PushOraclePriceArgs,
  SetOraclePriceCapArgs,
  UpdateAdminArgs,
  TopUpInsuranceArgs,
} from '../../../../percolator-cli/src/abi/instructions';

// Re-export PDA derivation
export { deriveVaultAuthority } from '../../../../percolator-cli/src/solana/pda';

// ---------------------------------------------------------------------------
// Inlined account specs for all admin instructions
// ---------------------------------------------------------------------------
import {
  PublicKey,
  AccountMeta,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

interface AccountSpec {
  name: string;
  signer: boolean;
  writable: boolean;
}

export const ACCOUNTS_UPDATE_CONFIG: readonly AccountSpec[] = [
  { name: 'admin', signer: true, writable: false },
  { name: 'slab', signer: false, writable: true },
] as const;

export const ACCOUNTS_SET_RISK_THRESHOLD: readonly AccountSpec[] = [
  { name: 'admin', signer: true, writable: false },
  { name: 'slab', signer: false, writable: true },
] as const;

export const ACCOUNTS_SET_MAINTENANCE_FEE: readonly AccountSpec[] = [
  { name: 'admin', signer: true, writable: false },
  { name: 'slab', signer: false, writable: true },
] as const;

export const ACCOUNTS_SET_ORACLE_AUTHORITY: readonly AccountSpec[] = [
  { name: 'admin', signer: true, writable: false },
  { name: 'slab', signer: false, writable: true },
] as const;

export const ACCOUNTS_PUSH_ORACLE_PRICE: readonly AccountSpec[] = [
  { name: 'authority', signer: true, writable: false },
  { name: 'slab', signer: false, writable: true },
] as const;

export const ACCOUNTS_SET_ORACLE_PRICE_CAP: readonly AccountSpec[] = [
  { name: 'admin', signer: true, writable: false },
  { name: 'slab', signer: false, writable: true },
] as const;

export const ACCOUNTS_RESOLVE_MARKET: readonly AccountSpec[] = [
  { name: 'admin', signer: true, writable: false },
  { name: 'slab', signer: false, writable: true },
] as const;

export const ACCOUNTS_WITHDRAW_INSURANCE: readonly AccountSpec[] = [
  { name: 'admin', signer: true, writable: false },
  { name: 'slab', signer: false, writable: true },
  { name: 'adminAta', signer: false, writable: true },
  { name: 'vault', signer: false, writable: true },
  { name: 'tokenProgram', signer: false, writable: false },
  { name: 'vaultPda', signer: false, writable: false },
] as const;

export const ACCOUNTS_UPDATE_ADMIN: readonly AccountSpec[] = [
  { name: 'admin', signer: true, writable: false },
  { name: 'slab', signer: false, writable: true },
] as const;

export const ACCOUNTS_TOPUP_INSURANCE: readonly AccountSpec[] = [
  { name: 'user', signer: true, writable: false },
  { name: 'slab', signer: false, writable: true },
  { name: 'userAta', signer: false, writable: true },
  { name: 'vault', signer: false, writable: true },
  { name: 'tokenProgram', signer: false, writable: false },
] as const;

export function buildAccountMetas(
  spec: readonly AccountSpec[],
  keys: PublicKey[]
): AccountMeta[] {
  if (keys.length !== spec.length) {
    throw new Error(
      `Account count mismatch: expected ${spec.length}, got ${keys.length}`
    );
  }
  return spec.map((s, i) => ({
    pubkey: keys[i],
    isSigner: s.signer,
    isWritable: s.writable,
  }));
}

export const WELL_KNOWN = {
  tokenProgram: TOKEN_PROGRAM_ID,
  clock: SYSVAR_CLOCK_PUBKEY,
  rent: SYSVAR_RENT_PUBKEY,
  systemProgram: SystemProgram.programId,
} as const;

export function buildIx(params: {
  programId: PublicKey;
  keys: AccountMeta[];
  data: Buffer;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: params.programId,
    keys: params.keys,
    data: params.data,
  });
}
