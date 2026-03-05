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

// Re-export PDA derivation
export { deriveVaultAuthority } from '../../../../percolator-cli/src/solana/pda';
