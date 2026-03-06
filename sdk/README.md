# matcher-common

Shared Rust library for [Percolator](https://github.com/aeyakovenko/percolator) custom matching programs on Solana.

All Percolator matchers share a 320-byte context account layout and a common CPI ABI. This crate provides the constants, verification functions, ABI types, and header utilities that every matcher needs.

## Installation

Add to your matcher's `Cargo.toml`:

```toml
[dependencies]
matcher-common = { path = "../../sdk" }
```

## CPI ABI

Percolator-prog calls matchers via CPI. The matcher receives a 67-byte `MatcherCall` as instruction data and must write a 64-byte `MatcherReturn` at offset 0 of the context account.

### MatcherCall (67 bytes, sent by percolator-prog)

```
Offset | Size | Field
-------|------|------------------
0      | 1    | tag (must be 0x00)
1      | 8    | req_id
9      | 2    | lp_idx
11     | 8    | lp_account_id
19     | 8    | oracle_price_e6
27     | 16   | req_size (i128)
43     | 24   | reserved (must be zero)
```

### MatcherReturn (64 bytes, written to context account offset 0)

```
Offset | Size | Field
-------|------|------------------
0      | 4    | abi_version (must be 1)
4      | 4    | flags (FLAG_VALID=1, FLAG_PARTIAL_OK=2, FLAG_REJECTED=4)
8      | 8    | exec_price_e6 (must be non-zero)
16     | 16   | exec_size (i128)
32     | 8    | req_id (echoed from call)
40     | 8    | lp_account_id (echoed from call)
48     | 8    | oracle_price_e6 (echoed from call)
56     | 8    | reserved (must be 0)
```

### Return Types

| Type | Flags | Meaning |
|------|-------|---------|
| Filled | `FLAG_VALID` | Trade accepted at `exec_price_e6` for `exec_size` |
| Zero-fill | `FLAG_VALID \| FLAG_PARTIAL_OK` | No fill (exec_size=0), but not rejected |
| Rejected | `FLAG_VALID \| FLAG_REJECTED` | Matcher refuses the trade |

Matchers must **never return an error** for rejections. Instead, write `MatcherReturn::rejected()` and return `Ok(())`.

## Context Account Layout (320 bytes)

Every Percolator matcher operates on a 320-byte context account:

```
Offset  | Size  | Field
--------|-------|----------------------------------
0-63    | 64    | MatcherReturn (written during CPI)
64-71   | 8     | Magic bytes (matcher identity)
72-75   | 4     | Version (= 1)
76      | 1     | Mode (matcher-specific)
77-79   | 3     | Padding
80-111  | 32    | LP PDA (liquidity provider)
112-319 | 208   | Matcher-specific data
```

## Magic Values

Each matcher type has a unique 8-byte magic value:

| Matcher | Magic | Hex |
|---------|-------|-----|
| Privacy | `PRIVMATC` | `0x5052_4956_4d41_5443` |
| Volatility | `VOLMATCH` | `0x564F_4c4d_4154_4348` |
| JPY | `JPYMATCH` | `0x4A50_594D_4154_4348` |
| Event | `EVNTMATC` | `0x4556_4e54_4d41_5443` |
| Macro | `MACOMATC` | `0x4d41_434f_4d41_5443` |

## API Reference

### ABI Types

```rust
use matcher_common::{MatcherCall, MatcherReturn, FLAG_VALID, FLAG_PARTIAL_OK, FLAG_REJECTED};

// Parse CPI instruction data from percolator-prog
let call = MatcherCall::parse(instruction_data)?;
// call.req_id, call.lp_idx, call.lp_account_id, call.oracle_price_e6, call.req_size

// Write a filled return (trade accepted)
let ret = MatcherReturn::filled(exec_price_e6, exec_size, &call);
ret.write_to(&mut ctx_data)?;

// Write a zero-fill return (no fill, not rejected)
let ret = MatcherReturn::zero_fill(&call);
ret.write_to(&mut ctx_data)?;

// Write a rejected return (matcher refuses trade)
let ret = MatcherReturn::rejected(&call);
ret.write_to(&mut ctx_data)?;
```

### Constants

```rust
use matcher_common::{CTX_SIZE, RETURN_DATA_OFFSET, RETURN_DATA_SIZE, MAGIC_OFFSET, LP_PDA_OFFSET};

CTX_SIZE: usize = 320            // Standard context account size
RETURN_DATA_OFFSET: usize = 0    // Start of return data region
RETURN_DATA_SIZE: usize = 64     // Size of return data region
MAGIC_OFFSET: usize = 64         // Where magic bytes are stored
LP_PDA_OFFSET: usize = 80        // Where LP PDA is stored
```

### Reading Context Data

```rust
use matcher_common::{read_magic, read_lp_pda, verify_magic};

let magic = read_magic(&ctx_data);
let lp_pda = read_lp_pda(&ctx_data);
let is_valid = verify_magic(&ctx_data, PRIVMATC);
```

### Account Verification

#### `verify_lp_pda`

Verifies that the LP PDA account is a signer and matches the stored LP PDA in the context account.

```rust
use matcher_common::verify_lp_pda;

verify_lp_pda(lp_pda, ctx_account, magic, "PRIVACY-MATCHER")?;
// Checks: (1) signer, (2) magic matches, (3) LP PDA matches stored value
```

#### `verify_init_preconditions`

Validates that a context account is ready for initialization. Prevents re-initialization.

```rust
use matcher_common::verify_init_preconditions;

verify_init_preconditions(ctx_account, magic, "PRIVACY-MATCHER")?;
// Checks: (1) writable, (2) >= 320 bytes, (3) not already initialized
```

### Writing Context Data

#### `write_header`

Initializes standard header fields during Init.

```rust
use matcher_common::write_header;

let mut ctx_data = ctx_account.try_borrow_mut_data()?;
write_header(&mut ctx_data, MY_MAGIC, mode, &lp_pda.key());
```

### Price Computation

```rust
use matcher_common::compute_exec_price;

// price * (10_000 + spread_bps) / 10_000
let price = compute_exec_price(100_000_000, 50)?; // -> 100_500_000
```

## Writing a Custom Matcher

```rust
use matcher_common::*;
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    pubkey::Pubkey,
};

const MY_MAGIC: u64 = 0x4D59_4D41_5443_4845; // "MYMATCHE"

// Init instruction
pub fn process_init(accounts: &[AccountInfo], mode: u8) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let lp_pda = next_account_info(account_iter)?;
    let ctx_account = next_account_info(account_iter)?;

    verify_init_preconditions(ctx_account, MY_MAGIC, "MY-MATCHER")?;

    let mut ctx_data = ctx_account.try_borrow_mut_data()?;
    write_header(&mut ctx_data, MY_MAGIC, mode, lp_pda.key);
    Ok(())
}

// Match instruction (called by percolator-prog via CPI)
pub fn process_match(
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let account_iter = &mut accounts.iter();
    let lp_pda = next_account_info(account_iter)?;
    let ctx_account = next_account_info(account_iter)?;

    // 1. Verify LP PDA
    verify_lp_pda(lp_pda, ctx_account, MY_MAGIC, "MY-MATCHER")?;

    // 2. Parse the CPI call from percolator-prog
    let call = MatcherCall::parse(instruction_data)?;

    // 3. Compute execution price
    let spread_bps = 50u64;
    let exec_price = compute_exec_price(call.oracle_price_e6, spread_bps)?;

    // 4. Write full MatcherReturn to context account
    let mut ctx_data = ctx_account.try_borrow_mut_data()?;
    let ret = MatcherReturn::filled(exec_price, call.req_size, &call);
    ret.write_to(&mut ctx_data)?;

    Ok(())
}
```

## Testing

```bash
cargo test
```

## License

MIT
