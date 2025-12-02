import { get, set, del } from "idb-keyval";
import zxcvbn from 'zxcvbn';

const PRIVATE_KEY_DB = "forkflirt_priv_key";
const PUBLIC_KEY_DB = "forkflirt_pub_key";
const ENCRYPTED_PRIVATE_KEY_DB = "forkflirt_encrypted_priv_key";

// --- Types ---

export interface KeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}

export interface EncryptedPrivateKey {
  algorithm: "AES-GCM";
  salt: Uint8Array;
  iv: Uint8Array;
  wrappedKey: ArrayBuffer;
  version: 1;
}

export interface PassphraseValidation {
  valid: boolean;
  reason?: string;
}

// --- Passphrase Validation ---

export function validatePassphrase(passphrase: string): PassphraseValidation {
  const words = passphrase.trim().split(/[\s\-\.]+/);
  const hasLetters = /[a-zA-Z]/.test(passphrase);
  const hasNumbers = /\d/.test(passphrase);
  const hasSymbols = /[^\w\s]/.test(passphrase);

  // Basic requirements
  if (words.length < 4) return { valid: false, reason: "Must be at least 4 words" };
  if (passphrase.length < 12) return { valid: false, reason: "Must be at least 12 characters" };

  const complexityCount = [hasLetters, hasNumbers, hasSymbols].filter(Boolean).length;
  if (complexityCount < 2) return { valid: false, reason: "Must include at least 2 of: letters, numbers, symbols" };

  // Enhanced strength validation
  const strength = zxcvbn(passphrase);

  if (strength.score < 3) {
    const suggestions = strength.feedback?.suggestions || [];
    const warning = strength.feedback?.warning || '';

    let reason = "Passphrase is too weak. ";
    if (warning) reason += warning + ". ";
    if (suggestions.length > 0) reason += suggestions.join('. ');

    return { valid: false, reason };
  }

  // Check for common patterns
  const commonPatterns = [
    /password/i,
    /123456/,
    /qwerty/i,
    /letmein/i,
    /admin/i
  ];

  if (commonPatterns.some(pattern => pattern.test(passphrase))) {
    return { valid: false, reason: "Passphrase contains common patterns that are easily guessed" };
  }

  // Check for sequential characters
  if (/(.)\1{2,}/.test(passphrase)) {
    return { valid: false, reason: "Passphrase contains repeated characters" };
  }

  return { valid: true };
}

// --- Key Derivation ---

async function deriveEncryptionKey(
  passphrase: string, 
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new Uint8Array(salt), // Ensure proper BufferSource
      iterations: 600000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"]
  );
}

// --- Key Generation ---

/**
 * Generates a new RSA-OAEP-2048 Keypair with passphrase protection.
 * The Private Key is encrypted with AES-GCM using PBKDF2-derived key.
 */
export async function generateIdentityWithPassphrase(
  passphrase: string
): Promise<KeyPair> {
  const validation = validatePassphrase(passphrase);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true, // Extractable for wrapping
    ["encrypt", "decrypt"]
  );

  // Store public key normally
  await set(PUBLIC_KEY_DB, keyPair.publicKey);

  // Encrypt and store private key
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptionKey = await deriveEncryptionKey(passphrase, salt);

  const wrappedKey = await window.crypto.subtle.wrapKey(
    "pkcs8",
    keyPair.privateKey,
    encryptionKey,
    { name: "AES-GCM", iv }
  );

  const encryptedKey: EncryptedPrivateKey = {
    algorithm: "AES-GCM",
    salt,
    iv,
    wrappedKey,
    version: 1
  };

  await set(ENCRYPTED_PRIVATE_KEY_DB, encryptedKey);
  return keyPair;
}

/**
 * Legacy function - redirects to passphrase version for backward compatibility.
 * @deprecated Use generateIdentityWithPassphrase instead.
 */
export async function generateIdentity(): Promise<KeyPair> {
  throw new Error("generateIdentity() is deprecated. Use generateIdentityWithPassphrase() instead.");
}

/**
 * Checks if an identity already exists in this browser.
 */
export async function hasIdentity(): Promise<boolean> {
  const encrypted = await get(ENCRYPTED_PRIVATE_KEY_DB);
  const legacy = await get(PRIVATE_KEY_DB);
  return !!(encrypted || legacy);
}

/**
 * Checks if passphrase-protected identity exists.
 */
export async function hasEncryptedIdentity(): Promise<boolean> {
  const encrypted = await get(ENCRYPTED_PRIVATE_KEY_DB);
  return !!encrypted;
}

/**
 * Retrieves the Private Key for decryption with passphrase.
 */
export async function getPrivateKeyWithPassphrase(
  passphrase: string
): Promise<CryptoKey> {
  const encryptedKey = await get<EncryptedPrivateKey>(
    ENCRYPTED_PRIVATE_KEY_DB
  );
  
  if (!encryptedKey) {
    throw new Error("No encrypted private key found");
  }

  const encryptionKey = await deriveEncryptionKey(
    passphrase, 
    encryptedKey.salt
  );

  try {
    return await window.crypto.subtle.unwrapKey(
      "pkcs8",
      encryptedKey.wrappedKey,
      encryptionKey,
      { name: "AES-GCM", iv: new Uint8Array(encryptedKey.iv) },
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["decrypt"]
    );
  } catch (error) {
    throw new Error("Invalid passphrase or corrupted key");
  }
}

/**
 * Legacy function - redirects to passphrase version.
 * @deprecated Use getPrivateKeyWithPassphrase instead.
 */
export async function getPrivateKey(): Promise<CryptoKey | undefined> {
  const encrypted = await get(ENCRYPTED_PRIVATE_KEY_DB);
  if (encrypted) {
    throw new Error("Private key is passphrase-protected. Use getPrivateKeyWithPassphrase() instead.");
  }
  
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

// --- Key Deletion (Critical for Privacy) ---

/**
 * Deletes all cryptographic identity from this browser.
 * This is critical for privacy in dating applications.
 */
export async function deleteIdentity(): Promise<void> {
  try {
    // Delete from IndexedDB
    await del(PRIVATE_KEY_DB);
    await del(PUBLIC_KEY_DB);
    await del(ENCRYPTED_PRIVATE_KEY_DB);
    
    // Clear any session storage
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
    
    // Clear any localStorage related to crypto
    if (typeof localStorage !== 'undefined') {
      // Remove replay protection data
      localStorage.removeItem('forkflirt_replay_protection');
      
      // Remove any other crypto-related data
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('forkflirt') || key.includes('crypto') || key.includes('key'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }

    // Clear replay protection from IndexedDB
    try {
      // Import the SecureReplayProtectionStore and create an instance
      const { SecureReplayProtectionStore } = await import('./cipher.js');
      const replayStore = new SecureReplayProtectionStore();
      await replayStore.clearAll();
    } catch (error) {
      console.warn('Failed to clear replay protection from IndexedDB:', error);
    }

    console.log('✅ All cryptographic identity data deleted successfully');
  } catch (error) {
    console.error('❌ Failed to delete identity:', error);
    throw new Error('Failed to securely delete identity data');
  }
}

/**
 * Checks if any identity data remains in storage.
 * Useful for verifying deletion was successful.
 */
export async function hasAnyIdentityData(): Promise<boolean> {
  try {
    const hasEncrypted = await hasEncryptedIdentity();
    const hasLegacy = await hasIdentity();
    
    // Check localStorage for any remaining data
    let hasLocalStorageData = false;
    if (typeof localStorage !== 'undefined') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('forkflirt') || key.includes('crypto') || key.includes('key'))) {
          hasLocalStorageData = true;
          break;
        }
      }
    }
    
    return hasEncrypted || hasLegacy || hasLocalStorageData;
  } catch {
    return false;
  }
}
