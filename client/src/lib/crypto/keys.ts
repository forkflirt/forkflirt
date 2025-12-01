import { get, set } from "idb-keyval";

const PRIVATE_KEY_DB = "forkflirt_priv_key";
const PUBLIC_KEY_DB = "forkflirt_pub_key";

// --- Types ---

export interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

// --- Key Generation ---

/**
 * Generates a new RSA-OAEP-2048 Keypair.
 * The Private Key is non-extractable by default for security.
 */
export async function generateIdentity(): Promise<KeyPair> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    false, // extractable (Private key cannot be exported via JS later, only used)
    ["encrypt", "decrypt"]
  );

  // Store in IndexedDB (Browser handles serialization of CryptoKey objects)
  await set(PRIVATE_KEY_DB, keyPair.privateKey);
  await set(PUBLIC_KEY_DB, keyPair.publicKey);

  return keyPair;
}

/**
 * Checks if an identity already exists in this browser.
 */
export async function hasIdentity(): Promise<boolean> {
  const priv = await get(PRIVATE_KEY_DB);
  return !!priv;
}

/**
 * Retrieves the Private Key for decryption.
 */
export async function getPrivateKey(): Promise<CryptoKey | undefined> {
  return await get<CryptoKey>(PRIVATE_KEY_DB);
}

// --- Export Logic (PEM Format) ---

/**
 * Converts a CryptoKey (Public) into a PEM-encoded string.
 * This is what gets saved to profile.json.
 */
export async function exportPublicKeyToPEM(key: CryptoKey): Promise<string> {
  // 1. Export to SPKI (Subject Public Key Info) format
  const exported = await window.crypto.subtle.exportKey("spki", key);

  // 2. Convert ArrayBuffer to Base64
  const body = window.btoa(String.fromCharCode(...new Uint8Array(exported)));

  // 3. Format as PEM (64 chars per line)
  const formattedBody = body.match(/.{1,64}/g)?.join("\n");

  return `-----BEGIN PUBLIC KEY-----\n${formattedBody}\n-----END PUBLIC KEY-----`;
}

/**
 * Imports a PEM string back into a CryptoKey (for encrypting messages to others).
 */
export async function importPublicKeyFromPEM(pem: string): Promise<CryptoKey> {
  // 1. Strip headers and newlines
  const pemHeader = "-----BEGIN PUBLIC KEY-----";
  const pemFooter = "-----END PUBLIC KEY-----";

  const pemContents = pem
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s/g, ""); // Remove all whitespace/newlines

  // 2. Base64 Decode
  const binaryString = window.atob(pemContents);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // 3. Import
  return await window.crypto.subtle.importKey(
    "spki",
    bytes.buffer,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true, // extractable
    ["encrypt"] // Used to encrypt messages to this user
  );
}

// --- Fingerprinting ---

/**
 * Generates a SHA-256 fingerprint of the Public Key.
 * Useful for verifying key integrity.
 */
export async function getFingerprint(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("spki", key);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", exported);

  // Convert to Hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
