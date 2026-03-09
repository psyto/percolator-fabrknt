/**
 * Percolator Crank for Event Oracle
 *
 * Handles two percolator-prog operations:
 * 1. PushOraclePrice — push probability as mark price (e6 format) to percolator-prog
 * 2. KeeperCrank — keep the market fresh for trading
 *
 * This makes the event-oracle a standalone service (no need for separate event-keeper).
 */
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  ComputeBudgetProgram,
  SYSVAR_CLOCK_PUBKEY,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { encodeKeeperCrank, encodePushOraclePrice } from "../../../../percolator-cli/src/abi/instructions.js";
import {
  ACCOUNTS_KEEPER_CRANK,
  ACCOUNTS_PUSH_ORACLE_PRICE,
  buildAccountMetas,
} from "../../../../percolator-cli/src/abi/accounts.js";
import { buildIx } from "../../../../percolator-cli/src/runtime/tx.js";

const CRANK_NO_CALLER = 65535;

export class PercolatorCrank {
  private crankCount = 0;
  private consecutiveErrors = 0;
  private lastPushedPrice: number | null = null;

  constructor(
    private connection: Connection,
    private payer: Keypair,
    private percolatorProgramId: PublicKey,
    private slab: PublicKey,
    private oracleFeed: PublicKey,
  ) {}

  /**
   * Push oracle price to percolator-prog.
   * Price is the event probability in e6 format (e.g., 500000 = 50%).
   */
  async pushOraclePrice(priceE6: number): Promise<string> {
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const data = encodePushOraclePrice({
      priceE6: BigInt(priceE6),
      timestamp,
    });

    const keys = buildAccountMetas(ACCOUNTS_PUSH_ORACLE_PRICE, [
      this.payer.publicKey,
      this.slab,
    ]);

    const tx = new Transaction();
    tx.add(buildIx({ programId: this.percolatorProgramId, keys, data }));

    const sig = await sendAndConfirmTransaction(this.connection, tx, [this.payer], {
      commitment: "confirmed",
      skipPreflight: true,
    });

    this.lastPushedPrice = priceE6;
    return sig;
  }

  /**
   * Run keeper crank on percolator-prog.
   */
  private async runCrank(): Promise<string> {
    const crankData = encodeKeeperCrank({
      callerIdx: CRANK_NO_CALLER,
      allowPanic: false,
    });

    const keys = buildAccountMetas(ACCOUNTS_KEEPER_CRANK, [
      this.payer.publicKey,
      this.slab,
      SYSVAR_CLOCK_PUBKEY,
      this.oracleFeed,
    ]);

    const tx = new Transaction();
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }));
    tx.add(buildIx({ programId: this.percolatorProgramId, keys, data: crankData }));

    return await sendAndConfirmTransaction(this.connection, tx, [this.payer], {
      commitment: "confirmed",
      skipPreflight: true,
    });
  }

  /**
   * Run the keeper crank loop continuously.
   */
  async runCrankLoop(intervalMs: number): Promise<void> {
    while (true) {
      try {
        const sig = await this.runCrank();
        this.crankCount++;
        this.consecutiveErrors = 0;
        if (this.crankCount % 10 === 0) {
          console.log(
            `[${new Date().toISOString()}] Event crank #${this.crankCount} OK: ${sig.slice(0, 16)}...`
          );
        }
      } catch (err: any) {
        this.consecutiveErrors++;
        const msg = err.message || String(err);

        // Suppress stale-crank noise (normal when no activity)
        if (!msg.includes("CrankTooSoon") && !msg.includes("0x1775")) {
          console.error(
            `[${new Date().toISOString()}] Event crank error (${this.consecutiveErrors}): ${msg.slice(0, 120)}`
          );
        }

        // Back off on consecutive errors
        if (this.consecutiveErrors > 10) {
          console.warn("Too many consecutive crank errors, backing off 30s...");
          await new Promise((r) => setTimeout(r, 30_000));
          this.consecutiveErrors = 0;
        }
      }

      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
}
