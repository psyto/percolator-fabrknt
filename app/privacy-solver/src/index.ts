import { PublicKey } from "@solana/web3.js";
import { PrivacyPerpsSolver } from "./solver";
import { SolverConfig, DEFAULT_PERCOLATOR_PROG } from "./config";
import * as dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return val;
}

async function main() {
  // Required env vars for trade execution
  const slabPubkey = new PublicKey(requireEnv("SLAB_PUBKEY"));
  const lpIdx = parseInt(requireEnv("LP_IDX"), 10);
  const userIdx = parseInt(requireEnv("USER_IDX"), 10);
  const oracleFeedPubkey = new PublicKey(requireEnv("ORACLE_FEED_PUBKEY"));

  if (isNaN(lpIdx) || lpIdx < 0) {
    console.error(`Invalid LP_IDX: ${process.env.LP_IDX}`);
    process.exit(1);
  }
  if (isNaN(userIdx) || userIdx < 0) {
    console.error(`Invalid USER_IDX: ${process.env.USER_IDX}`);
    process.exit(1);
  }

  const config: SolverConfig = {
    rpcUrl: process.env.RPC_URL || "https://api.devnet.solana.com",
    solverKeypairPath: process.env.SOLVER_KEYPAIR || "~/.config/solana/id.json",
    matcherProgramId: new PublicKey(
      process.env.MATCHER_PROGRAM_ID || "B2GB1aku91TAm2eRs3AAYiC9d5Xo35TdnbdA1mtqYuTG"
    ),
    matcherContextAccount: new PublicKey(
      process.env.MATCHER_CONTEXT || "11111111111111111111111111111111"
    ),
    percolatorProgId: process.env.PERCOLATOR_PROG_ID
      ? new PublicKey(process.env.PERCOLATOR_PROG_ID)
      : DEFAULT_PERCOLATOR_PROG,
    slabPubkey,
    lpIdx,
    userIdx,
    oracleFeedPubkey,
    percolatorCliPath: process.env.PERCOLATOR_CLI || "percolator-cli",
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || "1000"),
    maxSlippageBps: parseInt(process.env.MAX_SLIPPAGE_BPS || "500"),
    intentQueueUrl: process.env.INTENT_QUEUE_URL || "ws://localhost:8080",
  };

  const solver = new PrivacyPerpsSolver(config);

  process.on("SIGINT", () => {
    console.log("\nShutting down solver...");
    solver.stop();
    process.exit(0);
  });

  await solver.start();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
