/**
 * Vol Market Keeper Crank
 *
 * Native transaction building for Percolator vol market:
 * - Pushes oracle price (admin oracle / Hyperp mode)
 * - Runs keeper-crank to process funding, sweeps, maintenance
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
import {
  encodeKeeperCrank,
  encodePushOraclePrice,
} from "../../../../percolator-cli/src/abi/instructions.js";
import {
  ACCOUNTS_KEEPER_CRANK,
  ACCOUNTS_PUSH_ORACLE_PRICE,
  buildAccountMetas,
} from "../../../../percolator-cli/src/abi/accounts.js";
import { buildIx } from "../../../../percolator-cli/src/runtime/tx.js";

const CRANK_NO_CALLER = 65535;

export class VolCrank {
  constructor(
    private connection: Connection,
    private payer: Keypair,
    private programId: PublicKey,
    private slab: PublicKey,
    private oracle: PublicKey,
  ) {}

  /**
   * Push oracle price to the slab (Hyperp / admin oracle mode).
   * priceE6: price in e6 format (e.g. 3000 bps vol => 3_000_000_000)
   */
  async pushOraclePrice(priceE6: bigint): Promise<string> {
    const timestamp = BigInt(Math.floor(Date.now() / 1000));
    const data = encodePushOraclePrice({ priceE6, timestamp });

    const keys = buildAccountMetas(ACCOUNTS_PUSH_ORACLE_PRICE, [
      this.payer.publicKey,
      this.slab,
    ]);

    const tx = new Transaction();
    tx.add(buildIx({ programId: this.programId, keys, data }));

    return await sendAndConfirmTransaction(this.connection, tx, [this.payer], {
      commitment: "confirmed",
      skipPreflight: true,
    });
  }

  private async runCrank(): Promise<string> {
    const crankData = encodeKeeperCrank({
      callerIdx: CRANK_NO_CALLER,
      allowPanic: false,
    });

    const keys = buildAccountMetas(ACCOUNTS_KEEPER_CRANK, [
      this.payer.publicKey,
      this.slab,
      SYSVAR_CLOCK_PUBKEY,
      this.oracle,
    ]);

    const tx = new Transaction();
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }));
    tx.add(buildIx({ programId: this.programId, keys, data: crankData }));

    return await sendAndConfirmTransaction(this.connection, tx, [this.payer], {
      commitment: "confirmed",
      skipPreflight: true,
    });
  }

  /**
   * Run continuous push-oracle-price + keeper-crank loop.
   * getOraclePriceE6: callback returning the current oracle price to push.
   * If null, skips the push step (use external Pyth oracle instead).
   */
  async run(
    intervalMs: number,
    getOraclePriceE6?: () => bigint | null,
  ): Promise<void> {
    let crankCount = 0;
    let consecutiveErrors = 0;

    while (true) {
      // Step 1: Push oracle price if configured
      if (getOraclePriceE6) {
        try {
          const price = getOraclePriceE6();
          if (price !== null) {
            await this.pushOraclePrice(price);
          }
        } catch (err: any) {
          const msg = err.message || String(err);
          // Don't count push errors toward crank backoff; just log
          if (!msg.includes("0x1775")) {
            console.error(
              `[${new Date().toISOString()}] VOL push-oracle error: ${msg.slice(0, 120)}`
            );
          }
        }
      }

      // Step 2: Keeper crank
      try {
        const sig = await this.runCrank();
        crankCount++;
        consecutiveErrors = 0;
        if (crankCount % 10 === 0) {
          console.log(
            `[${new Date().toISOString()}] VOL crank #${crankCount} OK: ${sig.slice(0, 16)}...`
          );
        }
      } catch (err: any) {
        consecutiveErrors++;
        const msg = err.message || String(err);

        // Suppress stale-crank noise (normal when no activity)
        if (!msg.includes("CrankTooSoon") && !msg.includes("0x1775")) {
          console.error(
            `[${new Date().toISOString()}] VOL crank error (${consecutiveErrors}): ${msg.slice(0, 120)}`
          );
        }

        // Back off on consecutive errors
        if (consecutiveErrors > 10) {
          console.warn("Too many consecutive VOL crank errors, backing off 30s...");
          await new Promise((r) => setTimeout(r, 30_000));
          consecutiveErrors = 0;
        }
      }

      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
}
