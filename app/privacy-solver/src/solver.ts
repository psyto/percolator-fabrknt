import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction,
  SYSVAR_CLOCK_PUBKEY,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { SolverConfig, EncryptedIntent, DecryptedIntent } from "./config";
import { decrypt, deserializeIntent, EncryptionKeypair, generateEncryptionKeypair } from "./encryption";
import { withRetry } from "../../shared/retry";
import * as fs from "fs";

// Jupiter Price API v2 endpoint for SOL/USD
const JUPITER_PRICE_URL = "https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112";
const SOL_MINT = "So11111111111111111111111111111111111111112";

// Slab layout constants (from percolator-cli/src/solana/slab.ts)
const ENGINE_OFF = 440;
const ENGINE_ACCOUNTS_OFF = 9136;
const ACCOUNT_SIZE = 240;
const ACCT_OWNER_OFF = 184; // owner pubkey offset within each account entry

// Percolator instruction tags (from percolator-cli ABI)
const IX_TAG = {
  KeeperCrank: 5,
  TradeCpi: 10,
  PushOraclePrice: 17,
} as const;

// Permissionless crank sentinel (u16::MAX)
const CRANK_NO_CALLER = 65535;

export class PrivacyPerpsSolver {
  private connection: Connection;
  private solverKeypair: Keypair;
  private encryptionKeypair: EncryptionKeypair;
  private config: SolverConfig;
  private running: boolean = false;
  private intentQueue: EncryptedIntent[] = [];
  private lastKnownPrice: bigint = 0n; // Cached oracle price in e6 for fallback

  constructor(config: SolverConfig) {
    this.config = config;
    this.connection = new Connection(config.rpcUrl, "confirmed");
    const keyData = JSON.parse(fs.readFileSync(config.solverKeypairPath, "utf-8"));
    this.solverKeypair = Keypair.fromSecretKey(Uint8Array.from(keyData));
    this.encryptionKeypair = generateEncryptionKeypair();
  }

  /**
   * Start the solver service
   */
  async start(): Promise<void> {
    this.running = true;
    console.log(`Privacy Perps Solver started`);
    console.log(`  Solver:          ${this.solverKeypair.publicKey.toBase58()}`);
    console.log(`  Matcher:         ${this.config.matcherProgramId.toBase58()}`);
    console.log(`  Percolator-prog: ${this.config.percolatorProgId.toBase58()}`);
    console.log(`  Slab:            ${this.config.slabPubkey.toBase58()}`);
    console.log(`  LP idx:          ${this.config.lpIdx}`);
    console.log(`  User idx:        ${this.config.userIdx}`);
    console.log(`  Oracle feed:     ${this.config.oracleFeedPubkey.toBase58()}`);
    console.log(`  Poll interval:   ${this.config.pollIntervalMs}ms`);

    while (this.running) {
      try {
        await this.pollAndProcess();
      } catch (err) {
        console.error("Solver error:", err);
      }
      await this.sleep(this.config.pollIntervalMs);
    }
  }

  /**
   * Stop the solver service
   */
  stop(): void {
    this.running = false;
    console.log("Solver stopping...");
  }

  /**
   * Poll for encrypted intents, decrypt, validate, price, and execute
   */
  private async pollAndProcess(): Promise<void> {
    // In production, this would poll a WebSocket or on-chain queue
    // For now, process any queued intents
    if (this.intentQueue.length === 0) return;

    const intent = this.intentQueue.shift()!;
    console.log(`Processing intent ${intent.id} from ${intent.userPubkey}`);

    // Step 1: Decrypt
    const decrypted = this.decryptIntent(intent);
    if (!decrypted) {
      console.error(`Failed to decrypt intent ${intent.id}`);
      return;
    }

    // Step 2: Validate
    if (!this.validateIntent(decrypted)) {
      console.error(`Intent ${intent.id} failed validation`);
      return;
    }

    // Step 3: Get current oracle price
    const oraclePrice = await this.fetchOraclePrice();
    if (oraclePrice === 0n) {
      console.error(`Cannot execute trade: no oracle price available`);
      return;
    }

    // Step 4: Push oracle price + keeper crank + update matcher + execute trade
    await this.pushOraclePriceToPercolator(oraclePrice);
    await this.runKeeperCrank();
    await this.updateOraclePrice(oraclePrice);
    await this.executeTrade(decrypted, oraclePrice);
  }

  /**
   * Decrypt an encrypted intent
   */
  private decryptIntent(intent: EncryptedIntent): DecryptedIntent | null {
    try {
      // Combine nonce + ciphertext into the format @veil/crypto expects
      const encryptedBytes = new Uint8Array(intent.nonce.length + intent.encryptedPayload.length);
      encryptedBytes.set(intent.nonce, 0);
      encryptedBytes.set(intent.encryptedPayload, intent.nonce.length);

      const decryptedBytes = decrypt(
        encryptedBytes,
        intent.userEphemeralPubkey,
        this.encryptionKeypair,
      );
      const parsed = deserializeIntent(decryptedBytes);
      return {
        id: intent.id,
        userPubkey: intent.userPubkey,
        ...parsed,
      };
    } catch (err) {
      console.error(`Decryption error: ${err}`);
      return null;
    }
  }

  /**
   * Validate a decrypted intent
   */
  private validateIntent(intent: DecryptedIntent): boolean {
    const now = BigInt(Math.floor(Date.now() / 1000));

    // Check deadline
    if (intent.deadline > 0n && now > intent.deadline) {
      console.error(`Intent ${intent.id} expired: deadline=${intent.deadline}, now=${now}`);
      return false;
    }

    // Check slippage tolerance
    if (intent.maxSlippageBps > this.config.maxSlippageBps) {
      console.error(`Intent ${intent.id} slippage too high: ${intent.maxSlippageBps} > ${this.config.maxSlippageBps}`);
      return false;
    }

    // Check size is non-zero
    if (intent.size === 0n) {
      console.error(`Intent ${intent.id} has zero size`);
      return false;
    }

    return true;
  }

  /**
   * Fetch current SOL/USD price from Jupiter Price API v2.
   * Falls back to lastKnownPrice on failure.
   */
  private async fetchOraclePrice(): Promise<bigint> {
    try {
      const response = await fetch(JUPITER_PRICE_URL);
      if (!response.ok) {
        throw new Error(`Jupiter API returned ${response.status}: ${response.statusText}`);
      }

      const json = await response.json() as {
        data: Record<string, { id: string; price: string }>;
      };

      const solData = json.data[SOL_MINT];
      if (!solData || !solData.price) {
        throw new Error(`No SOL price data in Jupiter response`);
      }

      const priceFloat = parseFloat(solData.price);
      if (isNaN(priceFloat) || priceFloat <= 0) {
        throw new Error(`Invalid SOL price from Jupiter: ${solData.price}`);
      }

      const priceE6 = BigInt(Math.round(priceFloat * 1_000_000));
      this.lastKnownPrice = priceE6;

      console.log(`[ORACLE] SOL/USD = $${priceFloat.toFixed(4)} (${priceE6} e6)`);
      return priceE6;
    } catch (err) {
      console.warn(`[ORACLE] Failed to fetch Jupiter price: ${err}`);
      if (this.lastKnownPrice > 0n) {
        console.warn(`[ORACLE] Falling back to cached price: ${this.lastKnownPrice} e6`);
        return this.lastKnownPrice;
      }
      console.error(`[ORACLE] No cached price available`);
      return 0n;
    }
  }

  /**
   * Push oracle price to percolator-prog (admin oracle mode: PushOraclePrice ix tag 17).
   * Layout: tag(1) + price_e6(8) + timestamp(8) = 17 bytes
   * Accounts: [authority(signer), slab(writable)]
   */
  private async pushOraclePriceToPercolator(price: bigint): Promise<void> {
    const timestamp = BigInt(Math.floor(Date.now() / 1000));

    const data = Buffer.alloc(17);
    data.writeUInt8(IX_TAG.PushOraclePrice, 0);
    data.writeBigUInt64LE(price, 1);
    data.writeBigInt64LE(timestamp, 9);

    const ix = new TransactionInstruction({
      programId: this.config.percolatorProgId,
      keys: [
        { pubkey: this.solverKeypair.publicKey, isSigner: true, isWritable: false },
        { pubkey: this.config.slabPubkey, isSigner: false, isWritable: true },
      ],
      data,
    });

    const tx = new Transaction().add(ix);
    const sig = await withRetry(
      () => sendAndConfirmTransaction(this.connection, tx, [this.solverKeypair]),
      { onRetry: (err, attempt, delay) => console.log(`[PUSH-ORACLE] retry ${attempt} in ${delay}ms: ${err}`) },
    );
    console.log(`[PUSH-ORACLE] price=${price} e6, timestamp=${timestamp}, tx=${sig}`);
  }

  /**
   * Run keeper crank on percolator-prog.
   * Layout: tag(1) + caller_idx(2) + allow_panic(1) = 4 bytes
   * Accounts: [caller(signer), slab(writable), clock, oracle]
   */
  private async runKeeperCrank(): Promise<void> {
    const data = Buffer.alloc(4);
    data.writeUInt8(IX_TAG.KeeperCrank, 0);
    data.writeUInt16LE(CRANK_NO_CALLER, 1); // permissionless
    data.writeUInt8(0, 3); // allowPanic = false

    const ix = new TransactionInstruction({
      programId: this.config.percolatorProgId,
      keys: [
        { pubkey: this.solverKeypair.publicKey, isSigner: true, isWritable: false },
        { pubkey: this.config.slabPubkey, isSigner: false, isWritable: true },
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
        { pubkey: this.config.oracleFeedPubkey, isSigner: false, isWritable: false },
      ],
      data,
    });

    const tx = new Transaction().add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ix,
    );
    const sig = await withRetry(
      () => sendAndConfirmTransaction(this.connection, tx, [this.solverKeypair]),
      { onRetry: (err, attempt, delay) => console.log(`[KEEPER-CRANK] retry ${attempt} in ${delay}ms: ${err}`) },
    );
    console.log(`[KEEPER-CRANK] tx=${sig}`);
  }

  /**
   * Update oracle price in matcher context (Tag 0x03)
   */
  private async updateOraclePrice(price: bigint): Promise<void> {
    const data = Buffer.alloc(9);
    data[0] = 0x03; // Oracle update tag
    data.writeBigUInt64LE(price, 1);

    const ix = new TransactionInstruction({
      programId: this.config.matcherProgramId,
      keys: [
        { pubkey: this.solverKeypair.publicKey, isSigner: true, isWritable: false },
        { pubkey: this.config.matcherContextAccount, isSigner: false, isWritable: true },
      ],
      data,
    });

    const tx = new Transaction().add(ix);
    const sig = await withRetry(
      () => sendAndConfirmTransaction(this.connection, tx, [this.solverKeypair]),
      { onRetry: (err, attempt, delay) => console.log(`[MATCHER-ORACLE] retry ${attempt} in ${delay}ms: ${err}`) },
    );
    console.log(`[MATCHER-ORACLE] price=${price}, tx=${sig}`);
  }

  /**
   * Execute trade via Percolator's TradeCpi instruction.
   *
   * TradeCpi ix data (21 bytes): tag(1) + lp_idx(2) + user_idx(2) + size(16 i128)
   *
   * Accounts (8, matches ACCOUNTS_TRADE_CPI):
   *   0: user (signer)         — the user/solver signing the trade
   *   1: lpOwner (read-only)   — LP owner pubkey (read from slab; not a signer for CPI trades)
   *   2: slab (writable)       — the market slab
   *   3: clock                 — Sysvar::Clock
   *   4: oracle                — oracle feed account (indexFeedId from slab config)
   *   5: matcherProg           — the matcher program ID
   *   6: matcherCtx (writable) — the matcher context account
   *   7: lpPda                 — LP PDA derived from ["lp", slab, lp_idx_le]
   */
  private async executeTrade(intent: DecryptedIntent, oraclePrice: bigint): Promise<void> {
    console.log(`[TRADE] Executing: user=${intent.userPubkey}, size=${intent.size}, oracle=${oraclePrice}`);

    // Derive LP PDA: seeds = ["lp", slab, lp_idx as u16 LE]
    const lpIdxBuf = Buffer.alloc(2);
    lpIdxBuf.writeUInt16LE(this.config.lpIdx, 0);
    const [lpPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("lp"), this.config.slabPubkey.toBuffer(), lpIdxBuf],
      this.config.percolatorProgId,
    );

    // Read LP owner from slab account data.
    // The LP owner is stored in the slab's account array. We need to fetch it live.
    const lpOwnerPubkey = await this.readLpOwnerFromSlab();

    // Encode TradeCpi instruction data: tag(1) + lp_idx(2) + user_idx(2) + size(16 i128 LE)
    const ixData = Buffer.alloc(21);
    ixData.writeUInt8(IX_TAG.TradeCpi, 0);
    ixData.writeUInt16LE(this.config.lpIdx, 1);
    ixData.writeUInt16LE(this.config.userIdx, 3);

    // Write i128 as two's complement little-endian
    let sizeUnsigned = intent.size;
    if (intent.size < 0n) {
      sizeUnsigned = (1n << 128n) + intent.size;
    }
    const lo = sizeUnsigned & 0xffff_ffff_ffff_ffffn;
    const hi = sizeUnsigned >> 64n;
    ixData.writeBigUInt64LE(lo, 5);
    ixData.writeBigUInt64LE(hi, 13);

    // Build the 8 account metas (order matches ACCOUNTS_TRADE_CPI)
    const ix = new TransactionInstruction({
      programId: this.config.percolatorProgId,
      keys: [
        { pubkey: this.solverKeypair.publicKey, isSigner: true, isWritable: false },  // user
        { pubkey: lpOwnerPubkey, isSigner: false, isWritable: false },                 // lpOwner
        { pubkey: this.config.slabPubkey, isSigner: false, isWritable: true },         // slab
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },           // clock
        { pubkey: this.config.oracleFeedPubkey, isSigner: false, isWritable: false },  // oracle
        { pubkey: this.config.matcherProgramId, isSigner: false, isWritable: false },  // matcherProg
        { pubkey: this.config.matcherContextAccount, isSigner: false, isWritable: true }, // matcherCtx
        { pubkey: lpPda, isSigner: false, isWritable: false },                         // lpPda
      ],
      data: ixData,
    });

    const tx = new Transaction().add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ix,
    );

    const sig = await withRetry(
      () => sendAndConfirmTransaction(this.connection, tx, [this.solverKeypair]),
      {
        maxAttempts: 2,
        onRetry: (err, attempt, delay) => console.log(`[TRADE] retry ${attempt} in ${delay}ms: ${err}`),
      },
    );
    console.log(`[TRADE] SUCCESS: size=${intent.size}, tx=${sig}`);
  }

  /**
   * Read LP owner pubkey from the slab account data.
   * Uses the slab layout constants from percolator-cli/src/solana/slab.ts:
   *   ENGINE_OFF (440) + ENGINE_ACCOUNTS_OFF (9136) + idx * ACCOUNT_SIZE (240) + ACCT_OWNER_OFF (184)
   */
  private async readLpOwnerFromSlab(): Promise<PublicKey> {
    const accountInfo = await this.connection.getAccountInfo(this.config.slabPubkey);
    if (!accountInfo || !accountInfo.data) {
      throw new Error(`Failed to fetch slab account: ${this.config.slabPubkey.toBase58()}`);
    }

    const data = Buffer.from(accountInfo.data);
    const ownerOffset = ENGINE_OFF + ENGINE_ACCOUNTS_OFF + this.config.lpIdx * ACCOUNT_SIZE + ACCT_OWNER_OFF;

    if (data.length < ownerOffset + 32) {
      throw new Error(`Slab data too short to read LP owner at index ${this.config.lpIdx}`);
    }

    return new PublicKey(data.subarray(ownerOffset, ownerOffset + 32));
  }

  /**
   * Add an encrypted intent to the queue (called by WebSocket handler)
   */
  addIntent(intent: EncryptedIntent): void {
    this.intentQueue.push(intent);
    console.log(`Intent ${intent.id} queued (queue size: ${this.intentQueue.length})`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
