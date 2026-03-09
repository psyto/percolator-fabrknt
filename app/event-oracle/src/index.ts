import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { ProbabilityFeed } from "./probability-feed";
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
    process.env.MATCHER_PROGRAM_ID || "6d8JHEuia8cJEVFDcQqeLUFnGhCo9igzqVLam1H9cpum"
  );
  const matcherContext = new PublicKey(
    process.env.MATCHER_CONTEXT || "1111111111111111111111111111111111111111111"
  );
  const eventOracle = new PublicKey(
    process.env.EVENT_ORACLE || payer.publicKey
  );

  const updateIntervalMs = parseInt(process.env.UPDATE_INTERVAL_MS || "30000");
  const crankIntervalMs = parseInt(process.env.CRANK_INTERVAL_MS || "2000");

  // Percolator-prog integration (optional — set SLAB to enable)
  const slabStr = process.env.SLAB;
  const oracleFeedStr = process.env.ORACLE_FEED;
  const percolatorProgStr = process.env.PERCOLATOR_PROG || DEFAULT_PERCOLATOR_PROG;

  const percolatorOpts = slabStr && oracleFeedStr
    ? {
        percolatorProgramId: new PublicKey(percolatorProgStr),
        slab: new PublicKey(slabStr),
        oracleFeed: new PublicKey(oracleFeedStr),
      }
    : undefined;

  const feed = new ProbabilityFeed(
    connection,
    payer,
    matcherProgramId,
    matcherContext,
    eventOracle,
    percolatorOpts,
  );

  console.log("=== Event Oracle Service ===\n");
  console.log(`  Matcher Program: ${matcherProgramId.toBase58()}`);
  console.log(`  Matcher Context: ${matcherContext.toBase58()}`);
  console.log(`  Oracle:          ${eventOracle.toBase58()}`);
  console.log(`  Update interval: ${updateIntervalMs}ms`);

  if (percolatorOpts) {
    console.log(`  Percolator Prog: ${percolatorOpts.percolatorProgramId.toBase58()}`);
    console.log(`  Slab:            ${percolatorOpts.slab.toBase58()}`);
    console.log(`  Oracle Feed:     ${percolatorOpts.oracleFeed.toBase58()}`);
    console.log(`  Crank interval:  ${crankIntervalMs}ms`);
  } else {
    console.log(`  Percolator crank: disabled (set SLAB + ORACLE_FEED to enable)`);
  }
  console.log();

  process.on("SIGINT", () => {
    console.log("\nShutting down oracle...");
    process.exit(0);
  });

  // Build concurrent loops
  const loops: Promise<void>[] = [];

  // 1. Probability sync loop (existing)
  loops.push(
    (async () => {
      while (true) {
        try {
          await feed.updateProbability();
        } catch (err) {
          console.error("Oracle update error:", err);
        }
        await new Promise((r) => setTimeout(r, updateIntervalMs));
      }
    })()
  );

  // 2. Percolator crank loop (new — only if slab is configured)
  const crank = feed.getPercolatorCrank();
  if (crank) {
    loops.push(crank.runCrankLoop(crankIntervalMs));
  }

  await Promise.all(loops);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
