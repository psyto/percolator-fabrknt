/**
 * End-to-end CPI test: creates a market, registers privacy-matcher as LP,
 * inits the matcher context, creates a user, deposits, and trades via CPI.
 *
 * Usage:
 *   npx tsx scripts/test-cpi-devnet.ts              # fresh market (needs ~7 SOL)
 *   npx tsx scripts/test-cpi-devnet.ts --reuse-slab <pubkey>  # reuse existing slab
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
const PRIVACY_MATCHER = new PublicKey("B2GB1aku91TAm2eRs3AAYiC9d5Xo35TdnbdA1mtqYuTG");

const conn = new Connection(RPC, "confirmed");
const payer = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(
    path.join(process.env.HOME!, ".config/solana/id.json"), "utf-8"
  )))
);

// ---- CLI args ----
function parseArgs(): { reuseSlab?: string } {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--reuse-slab");
  if (idx !== -1 && args[idx + 1]) {
    return { reuseSlab: args[idx + 1] };
  }
  return {};
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

async function main() {
  const { execSync } = await import("child_process");
  const cliPath = path.resolve(__dirname, "../../percolator-cli");
  const opts = parseArgs();

  console.log("=== Percolator CPI Integration Test ===\n");
  console.log(`Payer:           ${payer.publicKey.toBase58()}`);
  console.log(`Percolator-prog: ${PERCOLATOR_PROG.toBase58()}`);
  console.log(`Privacy-matcher: ${PRIVACY_MATCHER.toBase58()}`);

  const balance = await conn.getBalance(payer.publicKey);
  console.log(`Balance:         ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);

  let slabPubkey: PublicKey;

  if (opts.reuseSlab) {
    // ---- Reuse existing slab (skip steps 1-3) ----
    slabPubkey = new PublicKey(opts.reuseSlab);
    console.log(`[1-3] Reusing existing slab: ${slabPubkey.toBase58()}\n`);
  } else {
    // ---- Step 1: Create slab ----
    console.log("[1/7] Creating slab account...");
    const SLAB_SIZE = 992616; // Fixed size expected by deployed percolator-prog
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

    // SOL/USD Pyth devnet feed
    const solFeedId = "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

    const initMarketCmd = `cd "${cliPath}" && node dist/index.js init-market \
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
      --min-liquidation-abs 0`;

    try {
      const output = execSync(initMarketCmd, { encoding: "utf-8", timeout: 30000 });
      console.log(output);
    } catch (e: any) {
      console.error("init-market failed:", e.stderr || e.message);
      process.exit(1);
    }

    // ---- Set oracle authority + push price (for admin oracle mode) ----
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
  }

  // ---- Ensure payer has a wSOL ATA (required by init-lp/deposit) ----
  console.log("[pre] Creating payer wSOL ATA...");
  const payerAta = await getOrCreateAssociatedTokenAccount(
    conn, payer, NATIVE_MINT, payer.publicKey
  );
  console.log(`  Payer wSOL ATA: ${payerAta.address.toBase58()}`);

  // Helper: parse AcctIDs from slab:accounts output
  function parseAcctIds(output: string): Set<number> {
    const ids = new Set<number>();
    for (const m of output.matchAll(/^\s*\d+\s+(?:LP|User)\s+(\d+)/gm)) {
      ids.add(parseInt(m[1]));
    }
    return ids;
  }

  // ---- Step 4: Create matcher context account ----
  console.log("[4/7] Creating privacy-matcher context account...");
  const ctxKeypair = Keypair.generate();
  const ctxRent = await conn.getMinimumBalanceForRentExemption(320);

  await sendAndConfirmTransaction(conn, new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: ctxKeypair.publicKey,
      lamports: ctxRent,
      space: 320,
      programId: PRIVACY_MATCHER,
    })
  ), [payer, ctxKeypair]);
  console.log(`  Context: ${ctxKeypair.publicKey.toBase58()}`);

  // ---- Step 5: Register LP, then find its AcctID ----
  console.log("[5/7] Registering LP via percolator-cli...");

  // Snapshot AcctIDs before init-lp
  const beforeLp = parseAcctIds(execSync(
    `cd "${cliPath}" && node dist/index.js slab:accounts --slab ${slabPubkey.toBase58()}`,
    { encoding: "utf-8", timeout: 15000 }
  ));

  const initLpCmd = `cd "${cliPath}" && node dist/index.js init-lp \
    --slab ${slabPubkey.toBase58()} \
    --matcher-program ${PRIVACY_MATCHER.toBase58()} \
    --matcher-context ${ctxKeypair.publicKey.toBase58()} \
    --fee 0`;
  try {
    const output = execSync(initLpCmd, { encoding: "utf-8", timeout: 30000 });
    console.log(output);
  } catch (e: any) {
    console.error("init-lp failed:", e.stderr || e.message);
    process.exit(1);
  }

  // Snapshot AcctIDs after init-lp to find the new LP AcctID
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

  // Derive LP PDA and init matcher with it
  const [lpPda] = deriveLpPda(PERCOLATOR_PROG, slabPubkey, lpIdx);
  console.log(`  LP PDA: ${lpPda.toBase58()}`);

  // ---- Step 5.5: Init matcher with correct LP PDA ----
  console.log("[5.5] Initializing privacy-matcher with LP PDA...");
  const initData = Buffer.alloc(45);
  initData[0] = 0x02; // Init tag
  initData.writeUInt32LE(15, 1);  // base_spread_bps
  initData.writeUInt32LE(50, 5);  // max_spread_bps
  initData.writeUInt32LE(5, 9);   // solver_fee_bps

  const initIx = new TransactionInstruction({
    programId: PRIVACY_MATCHER,
    keys: [
      { pubkey: lpPda, isSigner: false, isWritable: false }, // LP PDA
      { pubkey: ctxKeypair.publicKey, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: false }, // solver
    ],
    data: initData,
  });

  await sendAndConfirmTransaction(conn, new Transaction().add(initIx), [payer]);
  console.log("  Matcher initialized with LP PDA!");

  // ---- Step 6: Create user, find its AcctID ----
  console.log("[6/7] Creating user...");
  const initUserCmd = `cd "${cliPath}" && node dist/index.js init-user \
    --slab ${slabPubkey.toBase58()} \
    --fee 0`;
  try {
    const output = execSync(initUserCmd, { encoding: "utf-8", timeout: 30000 });
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
  const userIdx = newUserIds[0];
  console.log(`  User AcctID: ${userIdx}`);

  // Wrap SOL into payer's wSOL ATA so deposit has funds
  console.log("  Wrapping 0.5 SOL into wSOL ATA...");
  const wrapAmount = 500_000_000; // 0.5 SOL in lamports
  await sendAndConfirmTransaction(conn, new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: payerAta.address,
      lamports: wrapAmount,
    }),
    createSyncNativeInstruction(payerAta.address),
  ), [payer]);

  // Deposit collateral to LP (needs collateral to take the other side)
  console.log("  Depositing 0.2 SOL to LP...");
  const depositLpCmd = `cd "${cliPath}" && node dist/index.js deposit \
    --slab ${slabPubkey.toBase58()} \
    --user-idx ${lpIdx} \
    --amount 200000000`;
  try {
    const output = execSync(depositLpCmd, { encoding: "utf-8", timeout: 30000 });
    console.log("  LP Deposit:", output.trim());
  } catch (e: any) {
    console.error("LP deposit failed:", e.stderr || e.message);
    process.exit(1);
  }

  // Deposit collateral to our new user
  const depositCmd = `cd "${cliPath}" && node dist/index.js deposit \
    --slab ${slabPubkey.toBase58()} \
    --user-idx ${userIdx} \
    --amount 200000000`;
  try {
    const output = execSync(depositCmd, { encoding: "utf-8", timeout: 30000 });
    console.log("  Deposit:", output.trim());
  } catch (e: any) {
    console.error("deposit failed:", e.stderr || e.message);
    process.exit(1);
  }

  // Update matcher oracle price
  console.log("  Updating matcher oracle price...");
  const oracleData = Buffer.alloc(9);
  oracleData[0] = 0x03; // Oracle Update tag
  oracleData.writeBigUInt64LE(100_000_000n, 1); // price in e6

  const oracleIx = new TransactionInstruction({
    programId: PRIVACY_MATCHER,
    keys: [
      { pubkey: payer.publicKey, isSigner: true, isWritable: false }, // solver
      { pubkey: ctxKeypair.publicKey, isSigner: false, isWritable: true },
    ],
    data: oracleData,
  });
  await sendAndConfirmTransaction(conn, new Transaction().add(oracleIx), [payer]);
  console.log("  Matcher oracle price updated.");

  // Push percolator-prog oracle price again (refresh timestamp for trade)
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

  // Run keeper crank (required before trading — stale crank = EngineUnauthorized)
  // Read the oracle feed ID from slab config for the --oracle flag
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

  // Trade CPI
  const tradeCpiCmd = `cd "${cliPath}" && node dist/index.js trade-cpi \
    --slab ${slabPubkey.toBase58()} \
    --lp-idx ${lpIdx} \
    --user-idx ${userIdx} \
    --size 1000000 \
    --matcher-program ${PRIVACY_MATCHER.toBase58()} \
    --matcher-context ${ctxKeypair.publicKey.toBase58()}`;
  try {
    const output = execSync(tradeCpiCmd, { encoding: "utf-8", timeout: 30000 });
    if (output.includes("Error:")) {
      console.error("trade-cpi failed:", output);
      process.exit(1);
    }
    console.log("  Trade:", output.trim());
    console.log("\n=== SUCCESS: CPI trade executed! ===");
  } catch (e: any) {
    console.error("trade-cpi failed:", e.stderr || e.message);
    console.log("\n=== Trade CPI failed ===");
    console.log("Check if the MatcherReturn ABI is correct.");
    process.exit(1);
  }

  // Save test market info
  const info = {
    slab: slabPubkey.toBase58(),
    matcherContext: ctxKeypair.publicKey.toBase58(),
    matcherProgram: PRIVACY_MATCHER.toBase58(),
    testedAt: new Date().toISOString(),
  };
  console.log("\nTest market:", JSON.stringify(info, null, 2));
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
