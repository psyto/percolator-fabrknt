import {
  EncryptionKeypair,
  EncryptedData,
  generateEncryptionKeypair,
  encrypt as veilEncrypt,
  decrypt as veilDecrypt,
} from "@veil/crypto";

/**
 * NaCl box encryption/decryption for privacy intents
 * Powered by @veil/crypto (Curve25519-XSalsa20-Poly1305)
 */

export { EncryptionKeypair, EncryptedData, generateEncryptionKeypair };

export function encrypt(
  message: Uint8Array,
  recipientPublicKey: Uint8Array,
  senderKeypair: EncryptionKeypair
): EncryptedData {
  return veilEncrypt(message, recipientPublicKey, senderKeypair);
}

export function decrypt(
  encryptedBytes: Uint8Array,
  senderPublicKey: Uint8Array,
  recipientKeypair: EncryptionKeypair
): Uint8Array {
  return veilDecrypt(encryptedBytes, senderPublicKey, recipientKeypair);
}

/**
 * Serialize an intent for encryption
 */
export function serializeIntent(intent: {
  size: bigint;
  maxSlippageBps: number;
  deadline: bigint;
}): Uint8Array {
  const buffer = new ArrayBuffer(26); // 16 (i128) + 2 (u16) + 8 (i64)
  const view = new DataView(buffer);

  // Write size as i128 (little-endian, split into two i64)
  const sizeLow = intent.size & BigInt("0xFFFFFFFFFFFFFFFF");
  const sizeHigh = (intent.size >> 64n) & BigInt("0xFFFFFFFFFFFFFFFF");
  view.setBigUint64(0, sizeLow, true);
  view.setBigUint64(8, sizeHigh, true);

  // Write maxSlippageBps as u16
  view.setUint16(16, intent.maxSlippageBps, true);

  // Write deadline as i64
  view.setBigInt64(18, intent.deadline, true);

  return new Uint8Array(buffer);
}

/**
 * Deserialize a decrypted intent
 */
export function deserializeIntent(data: Uint8Array): {
  size: bigint;
  maxSlippageBps: number;
  deadline: bigint;
} {
  if (data.length < 26) {
    throw new Error(`Invalid intent data length: ${data.length}, expected 26`);
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  const sizeLow = view.getBigUint64(0, true);
  const sizeHigh = view.getBigUint64(8, true);
  const size = (sizeHigh << 64n) | sizeLow;

  const maxSlippageBps = view.getUint16(16, true);
  const deadline = view.getBigInt64(18, true);

  return { size, maxSlippageBps, deadline };
}
