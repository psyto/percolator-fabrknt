// Re-export slab parsers (only depends on @solana/web3.js)
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

// Re-export instruction encoders (depends on @solana/web3.js + local encode.ts)
export {
  encodeInitUser,
  encodeDepositCollateral,
  encodeWithdrawCollateral,
  encodeTradeNoCpi,
} from '../../../../percolator-cli/src/abi/instructions';

// Re-export PDA derivation (only depends on @solana/web3.js)
export { deriveVaultAuthority } from '../../../../percolator-cli/src/solana/pda';

// ---------------------------------------------------------------------------
// Inlined from percolator-cli/src/abi/accounts.ts to avoid @solana/spl-token
// cross-project resolution issues.
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

export const ACCOUNTS_INIT_USER: readonly AccountSpec[] = [
  { name: 'user', signer: true, writable: false },
  { name: 'slab', signer: false, writable: true },
  { name: 'userAta', signer: false, writable: true },
  { name: 'vault', signer: false, writable: true },
  { name: 'tokenProgram', signer: false, writable: false },
] as const;

export const ACCOUNTS_DEPOSIT_COLLATERAL: readonly AccountSpec[] = [
  { name: 'user', signer: true, writable: false },
  { name: 'slab', signer: false, writable: true },
  { name: 'userAta', signer: false, writable: true },
  { name: 'vault', signer: false, writable: true },
  { name: 'tokenProgram', signer: false, writable: false },
  { name: 'clock', signer: false, writable: false },
] as const;

export const ACCOUNTS_WITHDRAW_COLLATERAL: readonly AccountSpec[] = [
  { name: 'user', signer: true, writable: false },
  { name: 'slab', signer: false, writable: true },
  { name: 'vault', signer: false, writable: true },
  { name: 'userAta', signer: false, writable: true },
  { name: 'vaultPda', signer: false, writable: false },
  { name: 'tokenProgram', signer: false, writable: false },
  { name: 'clock', signer: false, writable: false },
  { name: 'oracleIdx', signer: false, writable: false },
] as const;

export const ACCOUNTS_TRADE_NOCPI: readonly AccountSpec[] = [
  { name: 'user', signer: true, writable: false },
  { name: 'lp', signer: true, writable: false },
  { name: 'slab', signer: false, writable: true },
  { name: 'clock', signer: false, writable: false },
  { name: 'oracle', signer: false, writable: false },
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

// Inlined from percolator-cli/src/runtime/tx.ts
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
