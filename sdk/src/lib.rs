use solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, msg, program_error::ProgramError,
    pubkey::Pubkey,
};

/// Standard context account size for all Percolator matchers
pub const CTX_SIZE: usize = 320;

/// Return data region: first 64 bytes of the context account
pub const RETURN_DATA_OFFSET: usize = 0;
pub const RETURN_DATA_SIZE: usize = 64;

/// Magic bytes offset (all matchers store magic at byte 64)
pub const MAGIC_OFFSET: usize = 64;

/// LP PDA offset (all matchers store LP PDA at byte 80)
pub const LP_PDA_OFFSET: usize = 80;

// =========================================================================
// Matcher CPI ABI — must match percolator-prog's matcher_abi module
// =========================================================================

pub const MATCHER_ABI_VERSION: u32 = 1;
pub const MATCHER_CALL_TAG: u8 = 0;
pub const MATCHER_CALL_LEN: usize = 67;

pub const FLAG_VALID: u32 = 1;
pub const FLAG_PARTIAL_OK: u32 = 2;
pub const FLAG_REJECTED: u32 = 4;

/// Parsed matcher call from percolator-prog CPI instruction data (67 bytes).
#[derive(Clone, Copy, Debug)]
pub struct MatcherCall {
    pub req_id: u64,
    pub lp_idx: u16,
    pub lp_account_id: u64,
    pub oracle_price_e6: u64,
    pub req_size: i128,
}

impl MatcherCall {
    pub fn parse(data: &[u8]) -> Result<Self, ProgramError> {
        if data.len() < MATCHER_CALL_LEN {
            return Err(ProgramError::InvalidInstructionData);
        }
        if data[0] != MATCHER_CALL_TAG {
            return Err(ProgramError::InvalidInstructionData);
        }

        let req_id = u64::from_le_bytes(data[1..9].try_into().unwrap());
        let lp_idx = u16::from_le_bytes(data[9..11].try_into().unwrap());
        let lp_account_id = u64::from_le_bytes(data[11..19].try_into().unwrap());
        let oracle_price_e6 = u64::from_le_bytes(data[19..27].try_into().unwrap());
        let req_size = i128::from_le_bytes(data[27..43].try_into().unwrap());

        // Verify reserved bytes are zero
        for &b in &data[43..67] {
            if b != 0 {
                return Err(ProgramError::InvalidInstructionData);
            }
        }

        Ok(Self {
            req_id,
            lp_idx,
            lp_account_id,
            oracle_price_e6,
            req_size,
        })
    }
}

/// Matcher return structure written to context account at offset 0 (64 bytes).
/// Must match percolator-prog's `matcher_abi::MatcherReturn` layout exactly.
#[repr(C)]
#[derive(Clone, Copy, Debug, Default)]
pub struct MatcherReturn {
    pub abi_version: u32,
    pub flags: u32,
    pub exec_price_e6: u64,
    pub exec_size: i128,
    pub req_id: u64,
    pub lp_account_id: u64,
    pub oracle_price_e6: u64,
    pub reserved: u64,
}

impl MatcherReturn {
    /// Write the full 64-byte return to context account data at offset 0.
    pub fn write_to(&self, data: &mut [u8]) -> Result<(), ProgramError> {
        if data.len() < RETURN_DATA_SIZE {
            return Err(ProgramError::AccountDataTooSmall);
        }
        data[0..4].copy_from_slice(&self.abi_version.to_le_bytes());
        data[4..8].copy_from_slice(&self.flags.to_le_bytes());
        data[8..16].copy_from_slice(&self.exec_price_e6.to_le_bytes());
        data[16..32].copy_from_slice(&self.exec_size.to_le_bytes());
        data[32..40].copy_from_slice(&self.req_id.to_le_bytes());
        data[40..48].copy_from_slice(&self.lp_account_id.to_le_bytes());
        data[48..56].copy_from_slice(&self.oracle_price_e6.to_le_bytes());
        data[56..64].copy_from_slice(&self.reserved.to_le_bytes());
        Ok(())
    }

    /// Create a filled return (trade accepted).
    pub fn filled(
        exec_price_e6: u64,
        exec_size: i128,
        call: &MatcherCall,
    ) -> Self {
        Self {
            abi_version: MATCHER_ABI_VERSION,
            flags: FLAG_VALID,
            exec_price_e6,
            exec_size,
            req_id: call.req_id,
            lp_account_id: call.lp_account_id,
            oracle_price_e6: call.oracle_price_e6,
            reserved: 0,
        }
    }

    /// Create a zero-fill return (no fill, but not rejected).
    pub fn zero_fill(call: &MatcherCall) -> Self {
        Self {
            abi_version: MATCHER_ABI_VERSION,
            flags: FLAG_VALID | FLAG_PARTIAL_OK,
            exec_price_e6: 1, // Must be non-zero per ABI
            exec_size: 0,
            req_id: call.req_id,
            lp_account_id: call.lp_account_id,
            oracle_price_e6: call.oracle_price_e6,
            reserved: 0,
        }
    }

    /// Create a rejected return (trade refused by matcher).
    pub fn rejected(call: &MatcherCall) -> Self {
        Self {
            abi_version: MATCHER_ABI_VERSION,
            flags: FLAG_VALID | FLAG_REJECTED,
            exec_price_e6: 1, // Must be non-zero per ABI
            exec_size: 0,
            req_id: call.req_id,
            lp_account_id: call.lp_account_id,
            oracle_price_e6: call.oracle_price_e6,
            reserved: 0,
        }
    }
}

/// Read a u64 magic value from the context account
pub fn read_magic(ctx_data: &[u8]) -> u64 {
    if ctx_data.len() < MAGIC_OFFSET + 8 {
        return 0;
    }
    u64::from_le_bytes(ctx_data[MAGIC_OFFSET..MAGIC_OFFSET + 8].try_into().unwrap())
}

/// Read the LP PDA pubkey from the context account.
/// Returns `Pubkey::default()` if the buffer is too short.
pub fn read_lp_pda(ctx_data: &[u8]) -> Pubkey {
    if ctx_data.len() < LP_PDA_OFFSET + 32 {
        return Pubkey::default();
    }
    Pubkey::new_from_array(
        ctx_data[LP_PDA_OFFSET..LP_PDA_OFFSET + 32]
            .try_into()
            .unwrap(),
    )
}

/// Verify that the magic bytes match the expected value
pub fn verify_magic(ctx_data: &[u8], expected_magic: u64) -> bool {
    if ctx_data.len() < CTX_SIZE {
        return false;
    }
    read_magic(ctx_data) == expected_magic
}

/// Verify LP PDA: checks that account\[0\] is a signer and matches the stored LP PDA
/// in the context account. This is the critical security check for all matchers.
///
/// Returns Ok(()) on success, or an appropriate ProgramError on failure.
///
/// # Arguments
/// * `lp_pda` - The LP PDA account (must be signer)
/// * `ctx_account` - The matcher context account (must be initialized)
/// * `expected_magic` - The magic bytes for this matcher type
/// * `matcher_name` - Name for log messages (e.g., "PRIVACY-MATCHER")
pub fn verify_lp_pda(
    lp_pda: &AccountInfo,
    ctx_account: &AccountInfo,
    expected_magic: u64,
    matcher_name: &str,
) -> ProgramResult {
    // 1. LP PDA must be a signer
    if !lp_pda.is_signer {
        msg!("{}: LP PDA must be a signer", matcher_name);
        return Err(ProgramError::MissingRequiredSignature);
    }

    // 2. Context must be initialized (magic check)
    let ctx_data = ctx_account.try_borrow_data()?;
    if !verify_magic(&ctx_data, expected_magic) {
        msg!("{}: Context not initialized or magic mismatch", matcher_name);
        return Err(ProgramError::UninitializedAccount);
    }

    // 3. LP PDA must match stored value
    let stored_pda = read_lp_pda(&ctx_data);
    if *lp_pda.key != stored_pda {
        msg!(
            "{}: LP PDA mismatch: expected {}, got {}",
            matcher_name,
            stored_pda,
            lp_pda.key
        );
        return Err(ProgramError::InvalidAccountData);
    }

    Ok(())
}

/// Verify that the context account is writable, the right size, and not already initialized.
/// Used during Init instructions to prevent re-initialization.
///
/// # Arguments
/// * `ctx_account` - The matcher context account
/// * `expected_magic` - The magic bytes for this matcher type
/// * `matcher_name` - Name for log messages
pub fn verify_init_preconditions(
    ctx_account: &AccountInfo,
    expected_magic: u64,
    matcher_name: &str,
) -> ProgramResult {
    if !ctx_account.is_writable {
        return Err(ProgramError::InvalidAccountData);
    }
    if ctx_account.data_len() < CTX_SIZE {
        return Err(ProgramError::AccountDataTooSmall);
    }

    let ctx_data = ctx_account.try_borrow_data()?;
    if verify_magic(&ctx_data, expected_magic) {
        msg!("{}: Context already initialized", matcher_name);
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    Ok(())
}

/// Write the standard header fields to a context account during initialization.
/// Writes: return data (zeroed), magic, version (1), mode, padding, LP PDA.
///
/// # Arguments
/// * `ctx_data` - Mutable reference to the context account data
/// * `magic` - The magic bytes for this matcher type
/// * `mode` - The mode byte (matcher-specific)
/// * `lp_pda` - The LP PDA pubkey to store
pub fn write_header(ctx_data: &mut [u8], magic: u64, mode: u8, lp_pda: &Pubkey) {
    // Zero return data region
    ctx_data[RETURN_DATA_OFFSET..RETURN_DATA_OFFSET + RETURN_DATA_SIZE].fill(0);
    // Magic
    ctx_data[MAGIC_OFFSET..MAGIC_OFFSET + 8].copy_from_slice(&magic.to_le_bytes());
    // Version = 1
    ctx_data[72..76].copy_from_slice(&1u32.to_le_bytes());
    // Mode
    ctx_data[76] = mode;
    // Padding
    ctx_data[77..LP_PDA_OFFSET].fill(0);
    // LP PDA
    ctx_data[LP_PDA_OFFSET..LP_PDA_OFFSET + 32].copy_from_slice(&lp_pda.to_bytes());
}

/// Write an execution price to the return buffer (first 8 bytes of context account).
///
/// DEPRECATED: Use `MatcherReturn::write_to()` instead for full ABI compliance.
/// This only writes 8 bytes at offset 0, which does NOT conform to percolator-prog's
/// 64-byte MatcherReturn ABI. Kept for backward compatibility during migration.
pub fn write_exec_price(ctx_data: &mut [u8], price: u64) {
    ctx_data[0..8].copy_from_slice(&price.to_le_bytes());
}

/// Compute execution price given an oracle/mark price and spread in bps.
/// Returns `price * (10000 + spread_bps) / 10000` using checked arithmetic.
pub fn compute_exec_price(price: u64, spread_bps: u64) -> Result<u64, ProgramError> {
    let multiplier = 10_000u64.saturating_add(spread_bps);
    let result = (price as u128)
        .checked_mul(multiplier as u128)
        .ok_or(ProgramError::ArithmeticOverflow)?
        / 10_000u128;
    Ok(result as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_verify_magic() {
        let mut data = vec![0u8; 320];
        let magic = 0x5052_4956_4d41_5443u64;
        data[64..72].copy_from_slice(&magic.to_le_bytes());
        assert!(verify_magic(&data, magic));
        assert!(!verify_magic(&data, 0x1234));
    }

    #[test]
    fn test_verify_magic_short_buffer() {
        let data = vec![0u8; 100];
        assert!(!verify_magic(&data, 0x1234));
    }

    #[test]
    fn test_compute_exec_price() {
        // 100_000_000 * (10000 + 50) / 10000 = 100_500_000
        assert_eq!(compute_exec_price(100_000_000, 50).unwrap(), 100_500_000);
    }

    #[test]
    fn test_compute_exec_price_zero_spread() {
        assert_eq!(compute_exec_price(100_000_000, 0).unwrap(), 100_000_000);
    }

    #[test]
    fn test_write_header() {
        let mut data = vec![0u8; 320];
        let magic = 0x5052_4956_4d41_5443u64;
        let lp = Pubkey::new_unique();
        write_header(&mut data, magic, 0, &lp);

        assert_eq!(u64::from_le_bytes(data[64..72].try_into().unwrap()), magic);
        assert_eq!(u32::from_le_bytes(data[72..76].try_into().unwrap()), 1);
        assert_eq!(data[76], 0);
        assert_eq!(Pubkey::new_from_array(data[80..112].try_into().unwrap()), lp);
    }

    #[test]
    fn test_write_exec_price() {
        let mut data = vec![0u8; 320];
        write_exec_price(&mut data, 12345678);
        assert_eq!(u64::from_le_bytes(data[0..8].try_into().unwrap()), 12345678);
    }

    // ===================================================================
    // Matcher CPI ABI Tests
    //
    // These tests verify the byte-level ABI contract that percolator-prog
    // expects from matchers via CPI:
    //   - MatcherCall: 67-byte instruction data sent by percolator-prog
    //   - MatcherReturn: 64-byte return written at offset 0 of context
    // ===================================================================

    #[test]
    fn test_matcher_call_parse() {
        let mut data = vec![0u8; MATCHER_CALL_LEN];
        data[0] = MATCHER_CALL_TAG;
        data[1..9].copy_from_slice(&42u64.to_le_bytes()); // req_id
        data[9..11].copy_from_slice(&3u16.to_le_bytes()); // lp_idx
        data[11..19].copy_from_slice(&99u64.to_le_bytes()); // lp_account_id
        data[19..27].copy_from_slice(&100_000_000u64.to_le_bytes()); // oracle_price_e6
        data[27..43].copy_from_slice(&(-500i128).to_le_bytes()); // req_size

        let call = MatcherCall::parse(&data).unwrap();
        assert_eq!(call.req_id, 42);
        assert_eq!(call.lp_idx, 3);
        assert_eq!(call.lp_account_id, 99);
        assert_eq!(call.oracle_price_e6, 100_000_000);
        assert_eq!(call.req_size, -500);
    }

    #[test]
    fn test_matcher_call_rejects_wrong_tag() {
        let mut data = vec![0u8; MATCHER_CALL_LEN];
        data[0] = 1; // wrong tag
        assert!(MatcherCall::parse(&data).is_err());
    }

    #[test]
    fn test_matcher_call_rejects_short_data() {
        let data = vec![0u8; 66]; // one byte short
        assert!(MatcherCall::parse(&data).is_err());
    }

    #[test]
    fn test_matcher_call_rejects_nonzero_reserved() {
        let mut data = vec![0u8; MATCHER_CALL_LEN];
        data[0] = MATCHER_CALL_TAG;
        data[50] = 1; // non-zero in reserved region
        assert!(MatcherCall::parse(&data).is_err());
    }

    #[test]
    fn test_matcher_return_filled_layout() {
        let mut data = vec![0u8; MATCHER_CALL_LEN];
        data[0] = MATCHER_CALL_TAG;
        data[1..9].copy_from_slice(&7u64.to_le_bytes());
        data[11..19].copy_from_slice(&88u64.to_le_bytes());
        data[19..27].copy_from_slice(&50_000_000u64.to_le_bytes());
        data[27..43].copy_from_slice(&1000i128.to_le_bytes());
        let call = MatcherCall::parse(&data).unwrap();

        let ret = MatcherReturn::filled(50_250_000, 1000, &call);
        let mut buf = vec![0u8; 64];
        ret.write_to(&mut buf).unwrap();

        // Verify ABI layout matches percolator-prog's read_matcher_return
        assert_eq!(u32::from_le_bytes(buf[0..4].try_into().unwrap()), MATCHER_ABI_VERSION);
        assert_eq!(u32::from_le_bytes(buf[4..8].try_into().unwrap()), FLAG_VALID);
        assert_eq!(u64::from_le_bytes(buf[8..16].try_into().unwrap()), 50_250_000);
        assert_eq!(i128::from_le_bytes(buf[16..32].try_into().unwrap()), 1000);
        assert_eq!(u64::from_le_bytes(buf[32..40].try_into().unwrap()), 7); // req_id echoed
        assert_eq!(u64::from_le_bytes(buf[40..48].try_into().unwrap()), 88); // lp_account_id echoed
        assert_eq!(u64::from_le_bytes(buf[48..56].try_into().unwrap()), 50_000_000); // oracle echoed
        assert_eq!(u64::from_le_bytes(buf[56..64].try_into().unwrap()), 0); // reserved
    }

    #[test]
    fn test_matcher_return_zero_fill() {
        let mut data = vec![0u8; MATCHER_CALL_LEN];
        data[0] = MATCHER_CALL_TAG;
        data[1..9].copy_from_slice(&5u64.to_le_bytes());
        data[11..19].copy_from_slice(&10u64.to_le_bytes());
        data[19..27].copy_from_slice(&100u64.to_le_bytes());
        let call = MatcherCall::parse(&data).unwrap();

        let ret = MatcherReturn::zero_fill(&call);
        let mut buf = vec![0u8; 64];
        ret.write_to(&mut buf).unwrap();

        assert_eq!(u32::from_le_bytes(buf[0..4].try_into().unwrap()), MATCHER_ABI_VERSION);
        assert_eq!(u32::from_le_bytes(buf[4..8].try_into().unwrap()), FLAG_VALID | FLAG_PARTIAL_OK);
        assert_eq!(u64::from_le_bytes(buf[8..16].try_into().unwrap()), 1); // non-zero
        assert_eq!(i128::from_le_bytes(buf[16..32].try_into().unwrap()), 0); // zero fill
    }

    #[test]
    fn test_matcher_return_rejected() {
        let mut data = vec![0u8; MATCHER_CALL_LEN];
        data[0] = MATCHER_CALL_TAG;
        data[1..9].copy_from_slice(&5u64.to_le_bytes());
        data[11..19].copy_from_slice(&10u64.to_le_bytes());
        data[19..27].copy_from_slice(&100u64.to_le_bytes());
        let call = MatcherCall::parse(&data).unwrap();

        let ret = MatcherReturn::rejected(&call);
        let mut buf = vec![0u8; 64];
        ret.write_to(&mut buf).unwrap();

        assert_eq!(u32::from_le_bytes(buf[4..8].try_into().unwrap()), FLAG_VALID | FLAG_REJECTED);
    }

    #[test]
    fn test_matcher_return_does_not_corrupt_header() {
        let mut data = vec![0u8; CTX_SIZE];
        let magic = 0x5052_4956_4d41_5443u64;
        let lp = Pubkey::new_unique();
        write_header(&mut data, magic, 0, &lp);

        // Write a MatcherReturn at offset 0
        let ret = MatcherReturn {
            abi_version: MATCHER_ABI_VERSION,
            flags: FLAG_VALID,
            exec_price_e6: 100_000_000,
            exec_size: 500,
            req_id: 1,
            lp_account_id: 2,
            oracle_price_e6: 99_500_000,
            reserved: 0,
        };
        ret.write_to(&mut data).unwrap();

        // Header at offset 64+ must be intact
        assert!(verify_magic(&data, magic));
        assert_eq!(read_lp_pda(&data), lp);
    }

    // ===================================================================
    // Legacy CPI Contract Tests (kept for write_header / verify_magic)
    // ===================================================================

    #[test]
    fn test_cpi_contract_header_roundtrip() {
        let mut data = vec![0u8; CTX_SIZE];
        let magic = 0x4556_4e54_4d41_5443u64;
        let lp = Pubkey::new_unique();

        write_header(&mut data, magic, 1, &lp);

        assert!(verify_magic(&data, magic));
        assert_eq!(read_lp_pda(&data), lp);
        assert_eq!(u32::from_le_bytes(data[72..76].try_into().unwrap()), 1);
        assert_eq!(data[76], 1);
        assert!(data[RETURN_DATA_OFFSET..RETURN_DATA_OFFSET + RETURN_DATA_SIZE]
            .iter()
            .all(|&b| b == 0));
    }

    #[test]
    fn test_cpi_contract_magic_mismatch_rejected() {
        let mut data = vec![0u8; CTX_SIZE];
        let privacy_magic = 0x5052_4956_4d41_5443u64;
        let vol_magic = 0x564F_4c4d_4154_4348u64;

        write_header(&mut data, privacy_magic, 0, &Pubkey::new_unique());

        assert!(verify_magic(&data, privacy_magic));
        assert!(!verify_magic(&data, vol_magic));
    }

    #[test]
    fn test_cpi_contract_lp_pda_mismatch_detected() {
        let mut data = vec![0u8; CTX_SIZE];
        let lp_a = Pubkey::new_unique();
        let lp_b = Pubkey::new_unique();

        write_header(&mut data, 0x1234_5678_9ABC_DEF0, 0, &lp_a);

        assert_eq!(read_lp_pda(&data), lp_a);
        assert_ne!(read_lp_pda(&data), lp_b);
    }

    #[test]
    fn test_cpi_contract_uninitialized_context_rejected() {
        let data = vec![0u8; CTX_SIZE];
        let any_magic = 0x5052_4956_4d41_5443u64;

        assert!(!verify_magic(&data, any_magic));
    }

    #[test]
    fn test_cpi_contract_undersized_context_rejected() {
        let mut data = vec![0u8; 200];
        let magic = 0x5052_4956_4d41_5443u64;
        if data.len() > MAGIC_OFFSET + 8 {
            data[MAGIC_OFFSET..MAGIC_OFFSET + 8].copy_from_slice(&magic.to_le_bytes());
        }
        assert!(!verify_magic(&data, magic));
    }

    #[test]
    fn test_cpi_contract_all_four_magics_unique() {
        // All four matcher magics must be distinct to prevent cross-matcher confusion.
        let privacy = 0x5052_4956_4d41_5443u64; // "PRIVMATC"
        let vol = 0x564F_4c4d_4154_4348u64;     // "VOLMATCH"
        let jpy = 0x4A50_594D_4154_4348u64;     // "JPYMATCH"
        let event = 0x4556_4e54_4d41_5443u64;   // "EVNTMATC"

        let magics = [privacy, vol, jpy, event];
        for i in 0..magics.len() {
            for j in (i + 1)..magics.len() {
                assert_ne!(magics[i], magics[j], "Magic values must be unique");
            }
        }

        // Each magic only validates against itself
        let mut data = vec![0u8; CTX_SIZE];
        for &magic in &magics {
            data[MAGIC_OFFSET..MAGIC_OFFSET + 8].copy_from_slice(&magic.to_le_bytes());
            assert!(verify_magic(&data, magic));
            for &other in &magics {
                if other != magic {
                    assert!(!verify_magic(&data, other));
                }
            }
        }
    }

    #[test]
    fn test_cpi_contract_exec_price_overwrite() {
        // Verify that writing a new exec price correctly overwrites the old one.
        // This is important because Percolator reads this on every CPI call.
        let mut data = vec![0u8; CTX_SIZE];
        write_exec_price(&mut data, 100_000_000);
        assert_eq!(u64::from_le_bytes(data[0..8].try_into().unwrap()), 100_000_000);

        write_exec_price(&mut data, 200_000_000);
        assert_eq!(u64::from_le_bytes(data[0..8].try_into().unwrap()), 200_000_000);
    }

    #[test]
    fn test_cpi_contract_read_magic_short_data() {
        // read_magic must handle data shorter than MAGIC_OFFSET + 8 gracefully
        let data = vec![0u8; 50]; // Less than MAGIC_OFFSET (64) + 8
        assert_eq!(read_magic(&data), 0);
    }

    #[test]
    fn test_read_lp_pda_short_buffer() {
        // read_lp_pda must handle data shorter than LP_PDA_OFFSET + 32 gracefully
        let data = vec![0u8; 100]; // Less than LP_PDA_OFFSET (80) + 32
        assert_eq!(read_lp_pda(&data), Pubkey::default());
    }

    // ===================================================================
    // Constants & Layout Tests
    // ===================================================================

    #[test]
    fn test_ctx_size_is_320() {
        assert_eq!(CTX_SIZE, 320);
    }

    #[test]
    fn test_return_data_layout() {
        assert_eq!(RETURN_DATA_OFFSET, 0);
        assert_eq!(RETURN_DATA_SIZE, 64);
    }

    #[test]
    fn test_magic_offset_is_64() {
        assert_eq!(MAGIC_OFFSET, 64);
    }

    #[test]
    fn test_lp_pda_offset_is_80() {
        assert_eq!(LP_PDA_OFFSET, 80);
    }

    #[test]
    fn test_layout_regions_do_not_overlap() {
        // Return data: [0..64), Magic: [64..72), Version: [72..76),
        // Mode: [76..77), Padding: [77..80), LP PDA: [80..112)
        let return_data_end = RETURN_DATA_OFFSET + RETURN_DATA_SIZE;
        let magic_end = MAGIC_OFFSET + 8;
        let lp_pda_end = LP_PDA_OFFSET + 32;

        // Return data ends where magic begins
        assert_eq!(return_data_end, MAGIC_OFFSET);
        // Magic ends before LP PDA begins
        assert!(magic_end <= LP_PDA_OFFSET);
        // Everything fits within CTX_SIZE
        assert!(lp_pda_end <= CTX_SIZE);
    }

    // ===================================================================
    // read_magic Boundary Tests
    // ===================================================================

    #[test]
    fn test_read_magic_exact_minimum_size() {
        // Buffer exactly MAGIC_OFFSET + 8 should work
        let mut data = vec![0u8; MAGIC_OFFSET + 8];
        let magic = 0xDEAD_BEEF_CAFE_BABEu64;
        data[MAGIC_OFFSET..MAGIC_OFFSET + 8].copy_from_slice(&magic.to_le_bytes());
        assert_eq!(read_magic(&data), magic);
    }

    #[test]
    fn test_read_magic_one_byte_short() {
        // Buffer one byte too short for magic must return 0
        let data = vec![0u8; MAGIC_OFFSET + 7];
        assert_eq!(read_magic(&data), 0);
    }

    #[test]
    fn test_read_magic_empty_buffer() {
        let data: Vec<u8> = vec![];
        assert_eq!(read_magic(&data), 0);
    }

    #[test]
    fn test_read_magic_zero_stored() {
        // Buffer with all zeros should read magic as 0
        let data = vec![0u8; CTX_SIZE];
        assert_eq!(read_magic(&data), 0);
    }

    // ===================================================================
    // read_lp_pda Boundary Tests
    // ===================================================================

    #[test]
    fn test_read_lp_pda_exact_minimum_size() {
        // Buffer exactly LP_PDA_OFFSET + 32 should work
        let mut data = vec![0u8; LP_PDA_OFFSET + 32];
        let lp = Pubkey::new_unique();
        data[LP_PDA_OFFSET..LP_PDA_OFFSET + 32].copy_from_slice(&lp.to_bytes());
        assert_eq!(read_lp_pda(&data), lp);
    }

    #[test]
    fn test_read_lp_pda_one_byte_short() {
        // Buffer one byte too short must return default
        let data = vec![0u8; LP_PDA_OFFSET + 31];
        assert_eq!(read_lp_pda(&data), Pubkey::default());
    }

    #[test]
    fn test_read_lp_pda_empty_buffer() {
        let data: Vec<u8> = vec![];
        assert_eq!(read_lp_pda(&data), Pubkey::default());
    }

    #[test]
    fn test_read_lp_pda_from_initialized_header() {
        let mut data = vec![0u8; CTX_SIZE];
        let lp = Pubkey::new_unique();
        write_header(&mut data, 0x1234, 0, &lp);
        assert_eq!(read_lp_pda(&data), lp);
    }

    // ===================================================================
    // verify_magic Edge Cases
    // ===================================================================

    #[test]
    fn test_verify_magic_zero_against_zero() {
        // A zeroed buffer has magic 0; verify_magic with expected 0 should still
        // fail because the buffer check passes but zero magic is valid if stored.
        // Actually verify_magic checks len < CTX_SIZE first, then compares magic.
        // With full-size buffer and magic 0, verify_magic(data, 0) returns true.
        let data = vec![0u8; CTX_SIZE];
        assert!(verify_magic(&data, 0));
    }

    #[test]
    fn test_verify_magic_exactly_319_bytes() {
        // One byte under CTX_SIZE must fail
        let data = vec![0u8; CTX_SIZE - 1];
        assert!(!verify_magic(&data, 0));
    }

    #[test]
    fn test_verify_magic_exactly_320_bytes() {
        let data = vec![0u8; CTX_SIZE];
        // Zero magic matches zero in buffer
        assert!(verify_magic(&data, 0));
    }

    // ===================================================================
    // write_header Detail Tests
    // ===================================================================

    #[test]
    fn test_write_header_all_mode_values() {
        // Mode is a single byte; test min, max, and a middle value
        for mode in [0u8, 1, 127, 255] {
            let mut data = vec![0u8; CTX_SIZE];
            write_header(&mut data, 0xABCD, mode, &Pubkey::new_unique());
            assert_eq!(data[76], mode, "Mode byte not stored correctly for {}", mode);
        }
    }

    #[test]
    fn test_write_header_padding_is_zeroed() {
        let mut data = vec![0xFFu8; CTX_SIZE]; // pre-fill with 0xFF
        write_header(&mut data, 0xABCD, 0, &Pubkey::new_unique());

        // Padding region: bytes 77..80 must be zeroed
        assert_eq!(data[77], 0);
        assert_eq!(data[78], 0);
        assert_eq!(data[79], 0);
    }

    #[test]
    fn test_write_header_zeros_return_data_region() {
        // Pre-fill return data with non-zero, then verify write_header zeros it
        let mut data = vec![0xFFu8; CTX_SIZE];
        write_header(&mut data, 0x1234, 0, &Pubkey::new_unique());

        for i in RETURN_DATA_OFFSET..RETURN_DATA_OFFSET + RETURN_DATA_SIZE {
            assert_eq!(data[i], 0, "Return data byte {} not zeroed", i);
        }
    }

    #[test]
    fn test_write_header_version_is_one() {
        let mut data = vec![0u8; CTX_SIZE];
        write_header(&mut data, 0x1234, 0, &Pubkey::new_unique());
        let version = u32::from_le_bytes(data[72..76].try_into().unwrap());
        assert_eq!(version, 1);
    }

    #[test]
    fn test_write_header_overwrite_reinitializes_cleanly() {
        let mut data = vec![0xFFu8; CTX_SIZE]; // Simulate dirty data

        let lp1 = Pubkey::new_unique();
        let magic1 = 0x1111_1111_1111_1111u64;
        write_header(&mut data, magic1, 5, &lp1);

        // Now overwrite with new values
        let lp2 = Pubkey::new_unique();
        let magic2 = 0x2222_2222_2222_2222u64;
        write_header(&mut data, magic2, 3, &lp2);

        // New values must be present
        assert!(verify_magic(&data, magic2));
        assert!(!verify_magic(&data, magic1));
        assert_eq!(read_lp_pda(&data), lp2);
        assert_ne!(read_lp_pda(&data), lp1);
        assert_eq!(data[76], 3);
        assert_eq!(u32::from_le_bytes(data[72..76].try_into().unwrap()), 1);
    }

    // ===================================================================
    // write_exec_price Edge Cases
    // ===================================================================

    #[test]
    fn test_write_exec_price_zero() {
        let mut data = vec![0xFFu8; CTX_SIZE];
        write_exec_price(&mut data, 0);
        assert_eq!(u64::from_le_bytes(data[0..8].try_into().unwrap()), 0);
    }

    #[test]
    fn test_write_exec_price_max_u64() {
        let mut data = vec![0u8; CTX_SIZE];
        write_exec_price(&mut data, u64::MAX);
        assert_eq!(u64::from_le_bytes(data[0..8].try_into().unwrap()), u64::MAX);
    }

    #[test]
    fn test_write_exec_price_does_not_corrupt_adjacent_bytes() {
        let mut data = vec![0xAAu8; CTX_SIZE];
        write_exec_price(&mut data, 42);
        // Bytes 8..64 must remain 0xAA (only bytes 0..8 written)
        for i in 8..RETURN_DATA_SIZE {
            assert_eq!(data[i], 0xAA, "Byte {} was corrupted", i);
        }
    }

    // ===================================================================
    // compute_exec_price Edge Cases
    // ===================================================================

    #[test]
    fn test_compute_exec_price_100_percent_spread() {
        // 10000 bps = 100%, price should double
        assert_eq!(compute_exec_price(100_000_000, 10_000).unwrap(), 200_000_000);
    }

    #[test]
    fn test_compute_exec_price_1_bps() {
        // 1 bps = 0.01%
        // 1_000_000 * 10001 / 10000 = 1_000_100
        assert_eq!(compute_exec_price(1_000_000, 1).unwrap(), 1_000_100);
    }

    #[test]
    fn test_compute_exec_price_truncation() {
        // When the result is not exact, integer division truncates
        // 1 * (10000 + 1) / 10000 = 10001 / 10000 = 1 (truncated)
        assert_eq!(compute_exec_price(1, 1).unwrap(), 1);
    }

    #[test]
    fn test_compute_exec_price_small_price_rounds_down() {
        // 3 * 10050 / 10000 = 30150 / 10000 = 3 (integer division)
        assert_eq!(compute_exec_price(3, 50).unwrap(), 3);
    }

    #[test]
    fn test_compute_exec_price_large_values() {
        // Near-max u64 price with small spread should not overflow due to u128 intermediate
        let price = u64::MAX / 2;
        let result = compute_exec_price(price, 50).unwrap();
        // Expected: price * 10050 / 10000
        let expected = ((price as u128) * 10_050u128 / 10_000u128) as u64;
        assert_eq!(result, expected);
    }

    #[test]
    fn test_compute_exec_price_zero_price() {
        assert_eq!(compute_exec_price(0, 500).unwrap(), 0);
    }

    #[test]
    fn test_compute_exec_price_max_u64_price_small_spread() {
        // u64::MAX * 10001 / 10000 -- intermediate is u128 so no overflow
        let result = compute_exec_price(u64::MAX, 1).unwrap();
        let expected = ((u64::MAX as u128) * 10_001u128 / 10_000u128) as u64;
        assert_eq!(result, expected);
    }

    #[test]
    fn test_compute_exec_price_large_spread() {
        // Very large spread (e.g., 50000 bps = 500%)
        // 1_000_000 * 60000 / 10000 = 6_000_000
        assert_eq!(compute_exec_price(1_000_000, 50_000).unwrap(), 6_000_000);
    }

    // ===================================================================
    // Full Roundtrip / Integration Tests
    // ===================================================================

    #[test]
    fn test_full_init_match_roundtrip() {
        // Simulate: init context, then write exec price, then read everything back
        let mut data = vec![0u8; CTX_SIZE];
        let magic = 0x5052_4956_4d41_5443u64;
        let lp = Pubkey::new_unique();

        // Step 1: Initialize header
        write_header(&mut data, magic, 2, &lp);

        // Step 2: Verify initialization
        assert!(verify_magic(&data, magic));
        assert_eq!(read_lp_pda(&data), lp);

        // Step 3: Compute and write exec price (simulating a match)
        let oracle_price = 150_000_000u64; // $150 in 6 decimal
        let spread_bps = 25u64; // 0.25%
        let exec_price = compute_exec_price(oracle_price, spread_bps).unwrap();
        write_exec_price(&mut data, exec_price);

        // Step 4: Read back and verify
        let stored_price = u64::from_le_bytes(data[0..8].try_into().unwrap());
        assert_eq!(stored_price, exec_price);
        // 150_000_000 * 10025 / 10000 = 150_375_000
        assert_eq!(stored_price, 150_375_000);

        // Step 5: Magic and LP PDA still intact after price write
        assert!(verify_magic(&data, magic));
        assert_eq!(read_lp_pda(&data), lp);
    }

    #[test]
    fn test_multiple_price_writes_preserve_header() {
        let mut data = vec![0u8; CTX_SIZE];
        let magic = 0x4A50_594D_4154_4348u64;
        let lp = Pubkey::new_unique();
        write_header(&mut data, magic, 0, &lp);

        // Write multiple prices in sequence
        for price in [1_000_000u64, 50_000_000, 999_999_999, 0, u64::MAX] {
            write_exec_price(&mut data, price);
            let stored = u64::from_le_bytes(data[0..8].try_into().unwrap());
            assert_eq!(stored, price);
            // Header remains intact
            assert!(verify_magic(&data, magic));
            assert_eq!(read_lp_pda(&data), lp);
            assert_eq!(data[76], 0);
        }
    }

    #[test]
    fn test_different_matchers_same_layout() {
        // All four matcher types use the same layout structure
        let magics = [
            0x5052_4956_4d41_5443u64, // PRIVACY
            0x564F_4c4d_4154_4348u64, // VOL
            0x4A50_594D_4154_4348u64, // JPY
            0x4556_4e54_4d41_5443u64, // EVENT
        ];

        for &magic in &magics {
            let mut data = vec![0u8; CTX_SIZE];
            let lp = Pubkey::new_unique();
            write_header(&mut data, magic, 1, &lp);

            assert!(verify_magic(&data, magic));
            assert_eq!(read_lp_pda(&data), lp);
            assert_eq!(read_magic(&data), magic);

            write_exec_price(&mut data, 42);
            assert_eq!(u64::from_le_bytes(data[0..8].try_into().unwrap()), 42);
            // Header still valid after price write
            assert!(verify_magic(&data, magic));
        }
    }
}
