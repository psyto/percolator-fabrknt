import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { VolOracleSync } from "./vol-oracle-sync";
import { VolCrank } from "./crank";
import * as dotenv from "dotenv";
import * as fs from "fs";

dotenv.config();

const DEFAULT_PERCOLATOR_PROG = "2SSnp35m7FQ7cRLNKGdW5UzjYFF6RBUNq7d3m5mqNByp";

async function main() {
  const rpcUrl = process.env.RPC_URL || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  const walletPath = process.env.WALLET_PATH || `${process.env.HOME}/.config/solana/id.json`;
  const payer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")))
  );

  const matcherProgramId = new PublicKey(
    process.env.MATCHER_PROGRAM_ID || "73Zhah3R7mzDUMM2rKM7A4E7WYkv3aGUGmNrCj7uEqNn"
  );
  const matcherContext = new PublicKey(
    process.env.MATCHER_CONTEXT || "1111111111111111111111111111111111111111111"
  );
  const varianceTracker = new PublicKey(
    process.env.VARIANCE_TRACKER || "1111111111111111111111111111111111111111111"
  );
  const volIndex = new PublicKey(
    process.env.VOL_INDEX || "1111111111111111111111111111111111111111111"
  );

  const percolatorProg = new PublicKey(
    process.env.PERCOLATOR_PROG || DEFAULT_PERCOLATOR_PROG
  );
  const slab = process.env.SLAB ? new PublicKey(process.env.SLAB) : null;
  const oracle = process.env.ORACLE ? new PublicKey(process.env.ORACLE) : null;

  const syncIntervalMs = parseInt(process.env.SYNC_INTERVAL_MS || "5000");
  const crankIntervalMs = parseInt(process.env.CRANK_INTERVAL_MS || "2000");

  const sync = new VolOracleSync(
    connection,
    payer,
    matcherProgramId,
    matcherContext,
    varianceTracker,
    volIndex,
  );

  // Shared mutable state: latest oracle price from vol sync
  // The crank loop reads this to push oracle price before cranking
  let latestOraclePriceE6: bigint | null = null;

  console.log("=== Vol Oracle Keeper ===\n");
  console.log(`  Matcher Program: ${matcherProgramId.toBase58()}`);
  console.log(`  Matcher Context: ${matcherContext.toBase58()}`);
  console.log(`  Percolator Prog: ${percolatorProg.toBase58()}`);
  console.log(`  Slab:            ${slab ? slab.toBase58() : "(not set)"}`);
  console.log(`  Oracle:          ${oracle ? oracle.toBase58() : "(not set)"}`);
  console.log(`  Sync interval:   ${syncIntervalMs}ms`);
  console.log(`  Crank interval:  ${crankIntervalMs}ms`);
  console.log(`  Payer:           ${payer.publicKey.toBase58()}\n`);

  process.on("SIGINT", () => {
    console.log("\nShutting down vol keeper...");
    process.exit(0);
  });

  // Build concurrent task list
  const tasks: Promise<void>[] = [];

  // Task 1: Vol oracle sync loop (matcher context updates)
  tasks.push((async () => {
    while (true) {
      try {
        await sync.syncOracle();
        // TODO: when vol-oracle-sync exposes the latest price, capture it here
        // For now, use a default vol price: 30% annualized = 3000 bps = 3_000_000_000 e6
        if (latestOraclePriceE6 === null) {
          latestOraclePriceE6 = 3_000_000_000n;
        }
      } catch (err) {
        console.error("Sync error:", err);
      }
      await new Promise((r) => setTimeout(r, syncIntervalMs));
    }
  })());

  // Task 2: Percolator crank loop (push-oracle-price + keeper-crank)
  if (slab && oracle) {
    const crank = new VolCrank(connection, payer, percolatorProg, slab, oracle);
    tasks.push(
      crank.run(crankIntervalMs, () => latestOraclePriceE6)
    );
  } else {
    console.log("SLAB/ORACLE not set — running vol oracle sync only (no percolator crank)");
  }

  await Promise.all(tasks);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
