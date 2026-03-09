/**
 * End-to-end CPI test for all 5 matchers on devnet.
 *
 * Usage:
 *   npx tsx scripts/test-cpi-devnet.ts                          # fresh slab + privacy-matcher
 *   npx tsx scripts/test-cpi-devnet.ts --matcher vol             # fresh slab + vol-matcher
 *   npx tsx scripts/test-cpi-devnet.ts --reuse-slab <pubkey>     # reuse slab + privacy-matcher
 *   npx tsx scripts/test-cpi-devnet.ts --reuse-slab <pubkey> --matcher event
 *   npx tsx scripts/test-cpi-devnet.ts --reuse-slab <pubkey> --matcher all  # test all 5
 */
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  createSyncNativeInstruction,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

// ---- Config ----
const RPC = "https://api.devnet.solana.com";
const PERCOLATOR_PROG = new PublicKey("2SSnp35m7FQ7cRLNKGdW5UzjYFF6RBUNq7d3m5mqNByp");

const MATCHERS: Record<string, PublicKey> = {
  privacy: new PublicKey("B2GB1aku91TAm2eRs3AAYiC9d5Xo35TdnbdA1mtqYuTG"),
  vol:     new PublicKey("73Zhah3R7mzDUMM2rKM7A4E7WYkv3aGUGmNrCj7uEqNn"),
  jpy:     new PublicKey("FZf6Zcw6nBzeLKtw4o4o9LFXzjxRa2poAdJxmLieuHF8"),
  event:   new PublicKey("6d8JHEuia8cJEVFDcQqeLUFnGhCo9igzqVLam1H9cpum"),
  macro:   new PublicKey("9E7yvQkrVj8i9RtBTkFPeDS9ZaVRodBHV9zTyL1fuKQV"),
};

const conn = new Connection(RPC, "confirmed");
const payer = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(
    path.join(process.env.HOME!, ".config/solana/id.json"), "utf-8"
  )))
);

// ---- CLI args ----
function parseArgs(): { reuseSlab?: string; matcherNames: string[] } {
  const args = process.argv.slice(2);
  let reuseSlab: string | undefined;
  let matcherNames: string[] = ["privacy"];

  const slabIdx = args.indexOf("--reuse-slab");
  if (slabIdx !== -1 && args[slabIdx + 1]) {
    reuseSlab = args[slabIdx + 1];
  }

  const matcherIdx = args.indexOf("--matcher");
  if (matcherIdx !== -1 && args[matcherIdx + 1]) {
    const val = args[matcherIdx + 1].toLowerCase();
    if (val === "all") {
      matcherNames = Object.keys(MATCHERS);
    } else {
      matcherNames = val.split(",").map(s => s.trim());
      for (const name of matcherNames) {
        if (!MATCHERS[name]) {
          console.error(`Unknown matcher: ${name}. Available: ${Object.keys(MATCHERS).join(", ")}`);
          process.exit(1);
        }
      }
    }
  }

  return { reuseSlab, matcherNames };
}

// ---- PDA derivation (matches percolator-cli) ----
function deriveVaultAuthority(programId: PublicKey, slab: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), slab.toBuffer()],
    programId
  );
}

function deriveLpPda(programId: PublicKey, slab: PublicKey, lpIdx: number): [PublicKey, number] {
  const idxBuf = Buffer.alloc(2);
  idxBuf.writeUInt16LE(lpIdx, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("lp"), slab.toBuffer(), idxBuf],
    programId
  );
}

// ---- Per-matcher init instruction builders ----
function buildInitData(matcherName: string): Buffer {
  switch (matcherName) {
    case "privacy": {
      // 45 bytes: tag(1) + base_spread(4) + max_spread(4) + solver_fee(4) + encryption_key(32)
      const buf = Buffer.alloc(45);
      buf[0] = 0x02;
      buf.writeUInt32LE(15, 1);   // base_spread_bps
      buf.writeUInt32LE(50, 5);   // max_spread_bps
      buf.writeUInt32LE(5, 9);    // solver_fee_bps
      // encryption_key left as zeros (test)
      return buf;
    }
    case "vol": {
      // 114 bytes
      const buf = Buffer.alloc(114);
      buf[0] = 0x02;
      buf[1] = 0x00;                       // mode = RealizedVol
      buf.writeUInt32LE(20, 2);             // base_spread_bps
      buf.writeUInt32LE(10, 6);             // vol_of_vol_spread_bps
      buf.writeUInt32LE(100, 10);           // max_spread_bps
      buf.writeUInt32LE(5, 14);             // impact_k_bps
      // liquidity_notional_e6 at [18..34] = 1_000_000_000 (u128 LE)
      buf.writeBigUInt64LE(1_000_000_000n, 18);
      buf.writeBigUInt64LE(0n, 26);
      // max_fill_abs at [34..50] = 100_000_000 (u128 LE)
      buf.writeBigUInt64LE(100_000_000n, 34);
      buf.writeBigUInt64LE(0n, 42);
      // variance_tracker at [50..82] = payer (dummy)
      payer.publicKey.toBuffer().copy(buf, 50);
      // vol_index at [82..114] = payer (dummy)
      payer.publicKey.toBuffer().copy(buf, 82);
      return buf;
    }
    case "jpy": {
      // 93 bytes
      const buf = Buffer.alloc(93);
      buf[0] = 0x02;
      buf[1] = 0x00;                       // mode = PassiveKYC
      buf[2] = 0x00;                       // min_kyc_level = 0 (no KYC for test)
      buf[3] = 0x00;                       // require_same_jurisdiction = false
      // kyc_registry at [4..36] = payer (dummy)
      payer.publicKey.toBuffer().copy(buf, 4);
      buf.writeUInt32LE(15, 36);            // base_spread_bps
      buf.writeUInt32LE(5, 40);             // kyc_discount_bps
      buf.writeUInt32LE(50, 44);            // max_spread_bps
      buf[48] = 0x00;                      // blocked_jurisdictions = none
      buf.writeBigUInt64LE(0n, 49);         // daily_volume_cap_e6 = 0 (unlimited)
      buf.writeUInt32LE(5, 57);             // impact_k_bps
      // liquidity_notional_e6 at [61..77]
      buf.writeBigUInt64LE(1_000_000_000n, 61);
      buf.writeBigUInt64LE(0n, 69);
      // max_fill_abs at [77..93]
      buf.writeBigUInt64LE(100_000_000n, 77);
      buf.writeBigUInt64LE(0n, 85);
      return buf;
    }
    case "event": {
      // 98 bytes
      const buf = Buffer.alloc(98);
      buf[0] = 0x02;
      buf[1] = 0x00;                       // mode = Continuous
      buf.writeUInt32LE(20, 2);             // base_spread_bps
      buf.writeUInt32LE(10, 6);             // edge_spread_bps
      buf.writeUInt32LE(100, 10);           // max_spread_bps
      buf.writeUInt32LE(5, 14);             // impact_k_bps
      buf.writeBigUInt64LE(500_000n, 18);   // initial_probability_e6 = 0.5
      buf.writeBigInt64LE(0n, 26);          // resolution_timestamp = 0 (no expiry)
      // liquidity_notional_e6 at [34..50]
      buf.writeBigUInt64LE(1_000_000_000n, 34);
      buf.writeBigUInt64LE(0n, 42);
      // max_fill_abs at [50..66]
      buf.writeBigUInt64LE(100_000_000n, 50);
      buf.writeBigUInt64LE(0n, 58);
      // event_oracle at [66..98] = payer (acts as oracle signer)
      payer.publicKey.toBuffer().copy(buf, 66);
      return buf;
    }
    case "macro": {
      // 82 bytes
      const buf = Buffer.alloc(82);
      buf[0] = 0x02;
      buf[1] = 0x00;                       // mode = RealRate
      buf.writeUInt32LE(20, 2);             // base_spread_bps
      buf.writeUInt32LE(15, 6);             // regime_spread_bps
      buf.writeUInt32LE(100, 10);           // max_spread_bps
      buf.writeUInt32LE(5, 14);             // impact_k_bps
      // liquidity_notional_e6 at [18..34]
      buf.writeBigUInt64LE(1_000_000_000n, 18);
      buf.writeBigUInt64LE(0n, 26);
      // max_fill_abs at [34..50]
      buf.writeBigUInt64LE(100_000_000n, 34);
      buf.writeBigUInt64LE(0n, 42);
      // macro_oracle at [50..82] = payer (acts as oracle signer)
      payer.publicKey.toBuffer().copy(buf, 50);
      return buf;
    }
    default:
      throw new Error(`No init data builder for ${matcherName}`);
  }
}

function buildInitAccounts(
  matcherName: string,
  matcherProgram: PublicKey,
  lpPda: PublicKey,
  ctxPubkey: PublicKey,
): TransactionInstruction["keys"] {
  switch (matcherName) {
    case "privacy":
      return [
        { pubkey: lpPda, isSigner: false, isWritable: false },
        { pubkey: ctxPubkey, isSigner: false, isWritable: true },
        { pubkey: payer.publicKey, isSigner: true, isWritable: false }, // solver
      ];
    default:
      // vol, jpy, event, macro all use 2 accounts: LP PDA + context
      return [
        { pubkey: lpPda, isSigner: false, isWritable: false },
        { pubkey: ctxPubkey, isSigner: false, isWritable: true },
      ];
  }
}

// ---- Per-matcher oracle update instruction builders ----
function buildOracleIx(
  matcherName: string,
  matcherProgram: PublicKey,
  ctxPubkey: PublicKey,
): TransactionInstruction {
  switch (matcherName) {
    case "privacy": {
      // Tag 0x03, 9 bytes: tag + price_e6
      const data = Buffer.alloc(9);
      data[0] = 0x03;
      data.writeBigUInt64LE(100_000_000n, 1);
      return new TransactionInstruction({
        programId: matcherProgram,
        keys: [
          { pubkey: payer.publicKey, isSigner: true, isWritable: false },
          { pubkey: ctxPubkey, isSigner: false, isWritable: true },
        ],
        data,
      });
    }
    case "jpy": {
      // Same as privacy: tag 0x03, 9 bytes
      const data = Buffer.alloc(9);
      data[0] = 0x03;
      data.writeBigUInt64LE(100_000_000n, 1);
      return new TransactionInstruction({
        programId: matcherProgram,
        keys: [
          { pubkey: payer.publicKey, isSigner: true, isWritable: false },
          { pubkey: ctxPubkey, isSigner: false, isWritable: true },
        ],
        data,
      });
    }
    case "vol": {
      // OracleSync: tag 0x03, 34 bytes. Accounts: context + variance_tracker + vol_index
      const data = Buffer.alloc(34);
      data[0] = 0x03;
      data.writeBigUInt64LE(2000n, 1);      // current_vol_bps
      data.writeBigUInt64LE(100_000_000n, 9); // vol_mark_price_e6
      data[17] = 0x00;                       // regime = 0
      data.writeBigUInt64LE(1800n, 18);      // vol_7d_avg_bps
      data.writeBigUInt64LE(2200n, 26);      // vol_30d_avg_bps
      return new TransactionInstruction({
        programId: matcherProgram,
        keys: [
          { pubkey: ctxPubkey, isSigner: false, isWritable: true },
          { pubkey: payer.publicKey, isSigner: false, isWritable: false }, // variance_tracker (dummy)
          { pubkey: payer.publicKey, isSigner: false, isWritable: false }, // vol_index (dummy)
        ],
        data,
      });
    }
    case "event": {
      // ProbabilitySync: tag 0x03, 25 bytes. Accounts: context + event_oracle
      const data = Buffer.alloc(25);
      data[0] = 0x03;
      data.writeBigUInt64LE(500_000n, 1);    // new_probability_e6 = 0.5
      data.writeBigUInt64LE(0n, 9);          // signal_severity = 0
      data.writeBigUInt64LE(0n, 17);         // signal_adjusted_spread = 0
      return new TransactionInstruction({
        programId: matcherProgram,
        keys: [
          { pubkey: ctxPubkey, isSigner: false, isWritable: true },
          { pubkey: payer.publicKey, isSigner: true, isWritable: false }, // event oracle (signer)
        ],
        data,
      });
    }
    case "macro": {
      // IndexSync: tag 0x03, 33 bytes. Accounts: context + macro_oracle
      const data = Buffer.alloc(33);
      data[0] = 0x03;
      data.writeBigUInt64LE(100_000_000n, 1);  // current_index_e6
      data.writeBigUInt64LE(0n, 9);            // index_components_packed
      data.writeBigUInt64LE(0n, 17);           // signal_severity = 0
      data.writeBigUInt64LE(0n, 25);           // signal_adjusted_spread = 0
      return new TransactionInstruction({
        programId: matcherProgram,
        keys: [
          { pubkey: ctxPubkey, isSigner: false, isWritable: true },
          { pubkey: payer.publicKey, isSigner: true, isWritable: false }, // macro oracle (signer)
        ],
        data,
      });
    }
    default:
      throw new Error(`No oracle builder for ${matcherName}`);
  }
}

// Helper: parse AcctIDs from slab:accounts output
function parseAcctIds(output: string): Set<number> {
  const ids = new Set<number>();
  for (const m of output.matchAll(/^\s*\d+\s+(?:LP|User)\s+(\d+)/gm)) {
    ids.add(parseInt(m[1]));
  }
  return ids;
}

async function testMatcher(
  matcherName: string,
  slabPubkey: PublicKey,
  execSync: (cmd: string, opts: any) => string,
  cliPath: string,
  payerAta: { address: PublicKey },
  knownAcctIds: Set<number>,
  needsWrapAndUser: boolean,
): Promise<{ lpIdx: number; userIdx: number; ctxPubkey: PublicKey; allAcctIds: Set<number> }> {
  const matcherProgram = MATCHERS[matcherName];
  console.log(`\n--- Testing ${matcherName}-matcher (${matcherProgram.toBase58()}) ---\n`);

  // Step 4: Create matcher context account
  console.log(`[4] Creating ${matcherName}-matcher context account...`);
  const ctxKeypair = Keypair.generate();
  const ctxRent = await conn.getMinimumBalanceForRentExemption(320);

  await sendAndConfirmTransaction(conn, new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: ctxKeypair.publicKey,
      lamports: ctxRent,
      space: 320,
      programId: matcherProgram,
    })
  ), [payer, ctxKeypair]);
  console.log(`  Context: ${ctxKeypair.publicKey.toBase58()}`);

  // Step 5: Register LP
  console.log(`[5] Registering LP for ${matcherName}-matcher...`);
  const beforeLp = parseAcctIds(execSync(
    `cd "${cliPath}" && node dist/index.js slab:accounts --slab ${slabPubkey.toBase58()}`,
    { encoding: "utf-8", timeout: 15000 }
  ));

  try {
    const output = execSync(`cd "${cliPath}" && node dist/index.js init-lp \
      --slab ${slabPubkey.toBase58()} \
      --matcher-program ${matcherProgram.toBase58()} \
      --matcher-context ${ctxKeypair.publicKey.toBase58()} \
      --fee 0`, { encoding: "utf-8", timeout: 30000 });
    console.log(output);
  } catch (e: any) {
    console.error("init-lp failed:", e.stderr || e.message);
    process.exit(1);
  }

  const afterLp = parseAcctIds(execSync(
    `cd "${cliPath}" && node dist/index.js slab:accounts --slab ${slabPubkey.toBase58()}`,
    { encoding: "utf-8", timeout: 15000 }
  ));
  const newLpIds = [...afterLp].filter(id => !beforeLp.has(id));
  if (newLpIds.length !== 1) {
    console.error(`Expected 1 new LP, found ${newLpIds.length}: ${newLpIds}`);
    process.exit(1);
  }
  const lpIdx = newLpIds[0];
  console.log(`  LP AcctID: ${lpIdx}`);

  const [lpPda] = deriveLpPda(PERCOLATOR_PROG, slabPubkey, lpIdx);
  console.log(`  LP PDA: ${lpPda.toBase58()}`);

  // Step 5.5: Init matcher
  console.log(`[5.5] Initializing ${matcherName}-matcher...`);
  const initData = buildInitData(matcherName);
  const initKeys = buildInitAccounts(matcherName, matcherProgram, lpPda, ctxKeypair.publicKey);
  const initIx = new TransactionInstruction({
    programId: matcherProgram,
    keys: initKeys,
    data: initData,
  });
  await sendAndConfirmTransaction(conn, new Transaction().add(initIx), [payer]);
  console.log(`  Matcher initialized!`);

  // Step 6: Create user (or reuse)
  let userIdx: number;
  if (needsWrapAndUser) {
    console.log("[6] Creating user...");
    try {
      const output = execSync(`cd "${cliPath}" && node dist/index.js init-user \
        --slab ${slabPubkey.toBase58()} \
        --fee 0`, { encoding: "utf-8", timeout: 30000 });
      console.log("  User:", output.trim());
    } catch (e: any) {
      console.error("init-user failed:", e.stderr || e.message);
      process.exit(1);
    }

    const afterUser = parseAcctIds(execSync(
      `cd "${cliPath}" && node dist/index.js slab:accounts --slab ${slabPubkey.toBase58()}`,
      { encoding: "utf-8", timeout: 15000 }
    ));
    const newUserIds = [...afterUser].filter(id => !afterLp.has(id));
    if (newUserIds.length !== 1) {
      console.error(`Expected 1 new user, found ${newUserIds.length}: ${newUserIds}`);
      process.exit(1);
    }
    userIdx = newUserIds[0];
    console.log(`  User AcctID: ${userIdx}`);

    // Wrap SOL
    console.log("  Wrapping 0.5 SOL into wSOL ATA...");
    await sendAndConfirmTransaction(conn, new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: payerAta.address,
        lamports: 500_000_000,
      }),
      createSyncNativeInstruction(payerAta.address),
    ), [payer]);

    // Deposit to LP
    console.log("  Depositing 0.2 SOL to LP...");
    try {
      const output = execSync(`cd "${cliPath}" && node dist/index.js deposit \
        --slab ${slabPubkey.toBase58()} \
        --user-idx ${lpIdx} \
        --amount 200000000`, { encoding: "utf-8", timeout: 30000 });
      console.log("  LP Deposit:", output.trim());
    } catch (e: any) {
      console.error("LP deposit failed:", e.stderr || e.message);
      process.exit(1);
    }

    // Deposit to user
    try {
      const output = execSync(`cd "${cliPath}" && node dist/index.js deposit \
        --slab ${slabPubkey.toBase58()} \
        --user-idx ${userIdx} \
        --amount 200000000`, { encoding: "utf-8", timeout: 30000 });
      console.log("  User Deposit:", output.trim());
    } catch (e: any) {
      console.error("user deposit failed:", e.stderr || e.message);
      process.exit(1);
    }
  } else {
    // For subsequent matchers on same slab, create new user but skip big wrap
    console.log("[6] Creating user...");
    try {
      const output = execSync(`cd "${cliPath}" && node dist/index.js init-user \
        --slab ${slabPubkey.toBase58()} \
        --fee 0`, { encoding: "utf-8", timeout: 30000 });
      console.log("  User:", output.trim());
    } catch (e: any) {
      console.error("init-user failed:", e.stderr || e.message);
      process.exit(1);
    }

    const afterUser = parseAcctIds(execSync(
      `cd "${cliPath}" && node dist/index.js slab:accounts --slab ${slabPubkey.toBase58()}`,
      { encoding: "utf-8", timeout: 15000 }
    ));
    const newUserIds = [...afterUser].filter(id => !afterLp.has(id));
    if (newUserIds.length !== 1) {
      console.error(`Expected 1 new user, found ${newUserIds.length}: ${newUserIds}`);
      process.exit(1);
    }
    userIdx = newUserIds[0];
    console.log(`  User AcctID: ${userIdx}`);

    // Wrap more SOL and deposit
    console.log("  Wrapping 0.5 SOL into wSOL ATA...");
    await sendAndConfirmTransaction(conn, new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: payerAta.address,
        lamports: 500_000_000,
      }),
      createSyncNativeInstruction(payerAta.address),
    ), [payer]);

    console.log("  Depositing 0.2 SOL to LP...");
    try {
      execSync(`cd "${cliPath}" && node dist/index.js deposit \
        --slab ${slabPubkey.toBase58()} \
        --user-idx ${lpIdx} \
        --amount 200000000`, { encoding: "utf-8", timeout: 30000 });
    } catch (e: any) {
      console.error("LP deposit failed:", e.stderr || e.message);
      process.exit(1);
    }

    try {
      execSync(`cd "${cliPath}" && node dist/index.js deposit \
        --slab ${slabPubkey.toBase58()} \
        --user-idx ${userIdx} \
        --amount 200000000`, { encoding: "utf-8", timeout: 30000 });
    } catch (e: any) {
      console.error("user deposit failed:", e.stderr || e.message);
      process.exit(1);
    }
  }

  // Update matcher oracle
  console.log(`  Updating ${matcherName}-matcher oracle...`);
  const oracleIx = buildOracleIx(matcherName, matcherProgram, ctxKeypair.publicKey);
  await sendAndConfirmTransaction(conn, new Transaction().add(oracleIx), [payer]);
  console.log(`  ${matcherName}-matcher oracle updated.`);

  // Refresh percolator-prog oracle
  console.log("  Refreshing percolator-prog oracle price...");
  try {
    execSync(`cd "${cliPath}" && node dist/index.js push-oracle-price \
      --slab ${slabPubkey.toBase58()} \
      --price 100000000`, { encoding: "utf-8", timeout: 30000 });
    console.log("  Percolator oracle price refreshed.");
  } catch (e: any) {
    console.error("push-oracle-price failed:", e.stderr || e.message);
    process.exit(1);
  }

  // Keeper crank
  console.log("  Running keeper crank...");
  const slabConfigOut = execSync(
    `cd "${cliPath}" && node dist/index.js slab:config --slab ${slabPubkey.toBase58()}`,
    { encoding: "utf-8", timeout: 15000 }
  );
  const oracleFeedPk = slabConfigOut.match(/Index Feed ID:\s+(\S+)/)?.[1] || "";
  try {
    execSync(`cd "${cliPath}" && node dist/index.js keeper-crank \
      --slab ${slabPubkey.toBase58()} \
      --oracle ${oracleFeedPk}`, { encoding: "utf-8", timeout: 30000 });
    console.log("  Keeper crank done.");
  } catch (e: any) {
    console.error("keeper-crank failed:", e.stderr || e.message);
    process.exit(1);
  }

  // Reset risk-reduction threshold after crank (crank EWMA may set it > 0)
  console.log("  Resetting risk-reduction threshold to 0...");
  try {
    execSync(`cd "${cliPath}" && node dist/index.js set-risk-threshold \
      --slab ${slabPubkey.toBase58()} \
      --new-threshold 0`, { encoding: "utf-8", timeout: 30000 });
    console.log("  Threshold reset to 0.");
  } catch (e: any) {
    console.error("set-risk-threshold failed:", e.stderr || e.message);
    process.exit(1);
  }

  // Trade CPI
  console.log(`[7] Trading via ${matcherName}-matcher CPI...`);
  try {
    const output = execSync(`cd "${cliPath}" && node dist/index.js trade-cpi \
      --slab ${slabPubkey.toBase58()} \
      --lp-idx ${lpIdx} \
      --user-idx ${userIdx} \
      --size 1000000 \
      --matcher-program ${matcherProgram.toBase58()} \
      --matcher-context ${ctxKeypair.publicKey.toBase58()}`, { encoding: "utf-8", timeout: 30000 });
    if (output.includes("Error:")) {
      console.error("trade-cpi failed:", output);
      process.exit(1);
    }
    console.log("  Trade:", output.trim());
    console.log(`\n=== SUCCESS: ${matcherName}-matcher CPI trade executed! ===`);
  } catch (e: any) {
    console.error("trade-cpi failed:", e.stderr || e.message);
    console.log(`\n=== ${matcherName}-matcher trade CPI failed ===`);
    process.exit(1);
  }

  const allAcctIds = parseAcctIds(execSync(
    `cd "${cliPath}" && node dist/index.js slab:accounts --slab ${slabPubkey.toBase58()}`,
    { encoding: "utf-8", timeout: 15000 }
  ));

  return { lpIdx, userIdx, ctxPubkey: ctxKeypair.publicKey, allAcctIds };
}

async function main() {
  const { execSync } = (await import("child_process"));
  const cliPath = path.resolve(__dirname, "../../percolator-cli");
  const opts = parseArgs();

  console.log("=== Percolator CPI Integration Test ===\n");
  console.log(`Payer:           ${payer.publicKey.toBase58()}`);
  console.log(`Percolator-prog: ${PERCOLATOR_PROG.toBase58()}`);
  console.log(`Matchers:        ${opts.matcherNames.join(", ")}`);

  const balance = await conn.getBalance(payer.publicKey);
  console.log(`Balance:         ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);

  let slabPubkey: PublicKey;

  if (opts.reuseSlab) {
    slabPubkey = new PublicKey(opts.reuseSlab);
    console.log(`[1-3] Reusing existing slab: ${slabPubkey.toBase58()}\n`);
  } else {
    // ---- Step 1: Create slab ----
    console.log("[1/7] Creating slab account...");
    const SLAB_SIZE = 992616;
    const slabKeypair = Keypair.generate();
    const slabRent = await conn.getMinimumBalanceForRentExemption(SLAB_SIZE);

    await sendAndConfirmTransaction(conn, new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: slabKeypair.publicKey,
        lamports: slabRent,
        space: SLAB_SIZE,
        programId: PERCOLATOR_PROG,
      })
    ), [payer, slabKeypair]);
    slabPubkey = slabKeypair.publicKey;
    console.log(`  Slab: ${slabPubkey.toBase58()}`);

    // ---- Step 2: Create vault ----
    console.log("[2/7] Creating vault token account...");
    const [vaultPda] = deriveVaultAuthority(PERCOLATOR_PROG, slabPubkey);
    const vault = await getOrCreateAssociatedTokenAccount(
      conn, payer, NATIVE_MINT, vaultPda, true
    );
    console.log(`  Vault PDA: ${vaultPda.toBase58()}`);
    console.log(`  Vault ATA: ${vault.address.toBase58()}`);

    // ---- Step 3: Init market via percolator-cli ----
    console.log("[3/7] Initializing market via percolator-cli...");
    const solFeedId = "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

    try {
      const output = execSync(`cd "${cliPath}" && node dist/index.js init-market \
        --slab ${slabPubkey.toBase58()} \
        --mint ${NATIVE_MINT.toBase58()} \
        --vault ${vault.address.toBase58()} \
        --index-feed-id ${solFeedId} \
        --max-staleness-secs 120 \
        --conf-filter-bps 100 \
        --initial-mark-price 100000000 \
        --max-maintenance-fee 1000000 \
        --max-risk-threshold 1000000000 \
        --min-oracle-price-cap 0 \
        --warmup-period 0 \
        --maintenance-margin-bps 500 \
        --initial-margin-bps 1000 \
        --trading-fee-bps 5 \
        --max-accounts 64 \
        --new-account-fee 0 \
        --risk-reduction-threshold 0 \
        --maintenance-fee-per-slot 0 \
        --max-crank-staleness 1000 \
        --liquidation-fee-bps 100 \
        --liquidation-fee-cap 0 \
        --liquidation-buffer-bps 50 \
        --min-liquidation-abs 0`, { encoding: "utf-8", timeout: 30000 });
      console.log(output);
    } catch (e: any) {
      console.error("init-market failed:", e.stderr || e.message);
      process.exit(1);
    }

    // ---- Set oracle authority + push price ----
    console.log("[3.5] Setting oracle authority and pushing price...");
    try {
      execSync(`cd "${cliPath}" && node dist/index.js set-oracle-authority \
        --slab ${slabPubkey.toBase58()} \
        --authority ${payer.publicKey.toBase58()}`, { encoding: "utf-8", timeout: 30000 });
      execSync(`cd "${cliPath}" && node dist/index.js push-oracle-price \
        --slab ${slabPubkey.toBase58()} \
        --price 100000000`, { encoding: "utf-8", timeout: 30000 });
      console.log("  Oracle authority set and price pushed.");
    } catch (e: any) {
      console.error("oracle setup failed:", e.stderr || e.message);
      process.exit(1);
    }

    // ---- Disable risk-reduction gate (init-market may set a non-zero default) ----
    console.log("[3.6] Setting risk-reduction threshold to 0...");
    try {
      execSync(`cd "${cliPath}" && node dist/index.js set-risk-threshold \
        --slab ${slabPubkey.toBase58()} \
        --new-threshold 0`, { encoding: "utf-8", timeout: 30000 });
      console.log("  Risk-reduction threshold set to 0.");
    } catch (e: any) {
      console.error("set-risk-threshold failed:", e.stderr || e.message);
      process.exit(1);
    }
  }

  // ---- Ensure payer has a wSOL ATA ----
  console.log("[pre] Creating payer wSOL ATA...");
  const payerAta = await getOrCreateAssociatedTokenAccount(
    conn, payer, NATIVE_MINT, payer.publicKey
  );
  console.log(`  Payer wSOL ATA: ${payerAta.address.toBase58()}`);

  // ---- Test each matcher ----
  let knownAcctIds = new Set<number>();
  const results: Array<{ matcher: string; success: boolean; slab: string; context: string }> = [];

  for (let i = 0; i < opts.matcherNames.length; i++) {
    const matcherName = opts.matcherNames[i];
    const result = await testMatcher(
      matcherName,
      slabPubkey,
      execSync as any,
      cliPath,
      payerAta,
      knownAcctIds,
      true, // always create fresh user + wrap + deposit per matcher
    );
    knownAcctIds = result.allAcctIds;
    results.push({
      matcher: matcherName,
      success: true,
      slab: slabPubkey.toBase58(),
      context: result.ctxPubkey.toBase58(),
    });
  }

  // ---- Summary ----
  console.log("\n\n========================================");
  console.log("         TEST RESULTS SUMMARY");
  console.log("========================================");
  for (const r of results) {
    console.log(`  ${r.success ? "PASS" : "FAIL"} ${r.matcher}-matcher`);
  }
  console.log(`\n  Slab: ${slabPubkey.toBase58()}`);
  console.log(`  Tested at: ${new Date().toISOString()}`);
  console.log("========================================\n");

  console.log("Test details:", JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
