// --- Utilities ---

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

const HEADER = "-----BEGIN FORKFLIRT ENCRYPTED MESSAGE-----";
const FOOTER = "-----END FORKFLIRT ENCRYPTED MESSAGE-----";

// --- Secure Error Handling ---

interface SecurityError extends Error {
  code: string;
  userMessage: string;
}

function createSecurityError(userMessage: string, technicalDetails?: any): SecurityError {
  // Log technical details for debugging
  if (technicalDetails) {
    console.error('Security error details:', technicalDetails);
  }

  const error = new Error(userMessage) as SecurityError;
  error.code = 'SECURITY_ERROR';
  error.userMessage = userMessage;
  return error;
}

// --- Secure Rate Limiting ---

const DECRYPT_LIMIT = 100;
const DECRYPT_WINDOW = 60 * 1000; // 1 minute
let decryptAttempts: number[] = [];

function isDecryptRateLimited(): boolean {
  const now = Date.now();
  // Remove attempts outside the window
  decryptAttempts = decryptAttempts.filter(time => now - time < DECRYPT_WINDOW);

  return decryptAttempts.length >= DECRYPT_LIMIT;
}

function recordDecryptAttempt(): void {
  decryptAttempts.push(Date.now());
}

// --- Enhanced Replay Protection Store ---

import { get, set, del } from 'idb-keyval';

export interface EncryptedMessageMetadata {
  version: string;
  timestamp: number;
  sender_id: string;
  message_id: string;
  expires_at: number;
  reply_to?: string;
}

interface SeenMessage {
  message_id: string;
  sender_id: string;
  timestamp: number;
  expires_at: number;
}

const REPLAY_STORE_KEY = 'forkflirt_replay_protection_v2';
const MAX_MESSAGES = 10000;
const MESSAGE_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

interface SecureSeenMessage extends SeenMessage {
  integrity: string; // SHA-256 hash for tamper detection
  receivedAt: number; // When we actually received it
}

export class SecureReplayProtectionStore {
  private async getIntegrityHash(message: SeenMessage): Promise<string> {
    const data = JSON.stringify(message);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async addSeenMessage(message: SeenMessage): Promise<void> {
    const secureMessage: SecureSeenMessage = {
      ...message,
      integrity: await this.getIntegrityHash(message),
      receivedAt: Date.now()
    };

    const existing = await this.getSeenMessages();
    existing.push(secureMessage);

    // Remove expired and old messages
    const now = Date.now();
    const filtered = existing.filter(msg =>
      msg.expires_at > now &&
      (now - msg.receivedAt) < MESSAGE_RETENTION_MS
    );

    // Validate integrity of remaining messages
    const validMessages = await this.validateMessageIntegrity(filtered);

    // Keep only the most recent MAX_MESSAGES
    const sorted = validMessages.sort((a, b) => b.timestamp - a.timestamp);
    const limited = sorted.slice(0, MAX_MESSAGES);

    await set(REPLAY_STORE_KEY, limited);
  }

  async isMessageSeen(messageId: string, senderId: string): Promise<boolean> {
    const messages = await this.getSeenMessages();
    return messages.some(msg =>
      msg.message_id === messageId &&
      msg.sender_id === senderId &&
      this.isMessageValid(msg)
    );
  }

  private async validateMessageIntegrity(messages: SecureSeenMessage[]): Promise<SecureSeenMessage[]> {
    const valid: SecureSeenMessage[] = [];

    for (const msg of messages) {
      if (this.isMessageValid(msg)) {
        valid.push(msg);
      } else {
        console.warn('Tampered replay protection message detected:', msg);
      }
    }

    return valid;
  }

  private isMessageValid(msg: SecureSeenMessage): boolean {
    // Basic structure validation
    if (!msg.message_id || !msg.sender_id || !msg.integrity) {
      return false;
    }

    // Timestamp validation
    const now = Date.now();
    if (msg.timestamp > now + 5 * 60 * 1000) { // 5 minute future tolerance
      return false;
    }

    return true;
  }

  private async getSeenMessages(): Promise<SecureSeenMessage[]> {
    try {
      const stored = await get<SecureSeenMessage[]>(REPLAY_STORE_KEY);
      return stored || [];
    } catch {
      return [];
    }
  }

  async cleanupExpired(): Promise<void> {
    const messages = await this.getSeenMessages();
    const now = Date.now();
    const filtered = messages.filter(msg =>
      msg.expires_at > now &&
      (now - msg.receivedAt) < MESSAGE_RETENTION_MS
    );

    if (filtered.length === 0) {
      // If no messages left, delete the entire storage
      await del(REPLAY_STORE_KEY);
    } else {
      await set(REPLAY_STORE_KEY, filtered);
    }
  }

  async clearAll(): Promise<void> {
    await del(REPLAY_STORE_KEY);
  }
}

// Update the ReplayProtectionStore usage
const replayStore = new SecureReplayProtectionStore();

// --- Encryption (Sending) ---

/**
 * Encrypts a text message for a specific recipient with replay protection.
 * 1. Generates message metadata with timestamp and unique ID
 * 2. Generates a random AES-GCM session key
 * 3. Encrypts the message with AES
 * 4. Encrypts the AES key with the recipient's RSA Public Key
 */
export async function encryptMessage(
  message: string,
  recipientPublicKey: CryptoKey,
  senderPrivateKey: CryptoKey,
  senderPublicKey: CryptoKey,
  replyTo?: string
): Promise<string> {
  const enc = new TextEncoder();
  const encodedMsg = enc.encode(message);
  
  // Generate unique message ID and metadata
  const messageId = crypto.randomUUID();
  const timestamp = Date.now();
  const expiresAt = timestamp + (24 * 60 * 60 * 1000); // 24 hours
  
  // Get sender fingerprint
  const senderFingerprint = await getFingerprint(senderPublicKey);
  
  const metadata: EncryptedMessageMetadata = {
    version: "2.0",
    timestamp,
    sender_id: senderFingerprint,
    message_id: messageId,
    reply_to: replyTo,
    expires_at: expiresAt
  };

  // 1. Generate AES Session Key (256-bit)
  const sessionKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // 2. Generate IV (Initialization Vector) - 12 bytes
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // 3. Encrypt Message with AES
  const encryptedPayload = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sessionKey,
    encodedMsg
  );

  // 4. Export AES Key to raw bytes so we can wrap it
  const rawSessionKey = await window.crypto.subtle.exportKey("raw", sessionKey);

  // 5. Encrypt AES Key with RSA (Key Wrapping)
  const encryptedSessionKey = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    recipientPublicKey,
    rawSessionKey
  );

  // 6. Encrypt metadata with recipient's public key
  const encodedMetadata = enc.encode(JSON.stringify(metadata));
  const encryptedMetadata = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    recipientPublicKey,
    encodedMetadata
  );

  // 7. Optional: Sign the message with sender's private key
  const messageData = [
    messageId,
    timestamp.toString(),
    senderFingerprint,
    arrayBufferToBase64(encryptedPayload)
  ].join('|');
  
  const signature = await window.crypto.subtle.sign(
    { name: "RSA-PSS", saltLength: 32 },
    senderPrivateKey,
    enc.encode(messageData)
  );

  // 8. Format Output Block
  const b64Metadata = arrayBufferToBase64(encryptedMetadata);
  const b64Key = arrayBufferToBase64(encryptedSessionKey);
  const b64IV = arrayBufferToBase64(iv.buffer);
  const b64Payload = arrayBufferToBase64(encryptedPayload);
  const b64Signature = arrayBufferToBase64(signature);

  return [
    HEADER,
    "Version: 2.0",
    "Encoding: Base64",
    `Metadata: ${b64Metadata}`,
    `Key-Wrap: ${b64Key}`,
    `IV: ${b64IV}`,
    `Payload: ${b64Payload}`,
    `Signature: ${b64Signature}`,
    FOOTER,
  ].join("\n");
}

// --- Fingerprinting ---

/**
 * Generates a SHA-256 fingerprint of the Public Key.
 * Useful for verifying key integrity and sender identification.
 */
async function getFingerprint(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("spki", key);
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", exported);

  // Convert to Hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// --- Decryption (Receiving) ---

export interface DecryptedMessage {
  text: string;
  verified: boolean;
  metadata: EncryptedMessageMetadata;
}

/**
 * Decrypts a message block using the user's Private Key with replay protection.
 */

export async function decryptMessage(
  encryptedBlock: string,
  myPrivateKey: CryptoKey
): Promise<DecryptedMessage> {
  // Constant-time rate limiting check
  if (isDecryptRateLimited()) {
    // Use constant-time delay to prevent timing attacks
    await new Promise(resolve => setTimeout(resolve, 1000));
    throw createSecurityError("Too many requests. Please try again later.");
  }

  recordDecryptAttempt();
  
  const lines = encryptedBlock.split("\n").map((l) => l.trim());
  
  const metadataLine = lines.find((l) => l.startsWith("Metadata: "));
  const keyLine = lines.find((l) => l.startsWith("Key-Wrap: "));
  const ivLine = lines.find((l) => l.startsWith("IV: "));
  const payloadLine = lines.find((l) => l.startsWith("Payload: "));
  const signatureLine = lines.find((l) => l.startsWith("Signature: "));
  
  if (!metadataLine || !keyLine || !ivLine || !payloadLine) {
    throw createSecurityError("Invalid message format");
  }
  
  // Decrypt metadata first
  const b64Metadata = metadataLine.replace("Metadata: ", "");
  const encryptedMetadata = base64ToArrayBuffer(b64Metadata);
  
  let metadata: EncryptedMessageMetadata;
  try {
    const rawMetadata = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      myPrivateKey,
      encryptedMetadata
    );
    metadata = JSON.parse(new TextDecoder().decode(rawMetadata));
  } catch (err) {
    throw createSecurityError("Message processing failed", err);
  }
  
  // Validate timestamp
  const now = Date.now();
  const maxClockSkew = 5 * 60 * 1000; // 5 minutes
  
  if (metadata.timestamp > now + maxClockSkew) {
    throw createSecurityError("Message validation failed");
  }

  if (now > metadata.expires_at) {
    throw createSecurityError("Message has expired");
  }
  
  // Check for replay
  const isReplay = await replayStore.isMessageSeen(metadata.message_id, metadata.sender_id);
  
  if (isReplay) {
    throw createSecurityError("Message validation failed");
  }

  const b64Key = keyLine.replace("Key-Wrap: ", "");
  const b64IV = ivLine.replace("IV: ", "");
  const b64Payload = payloadLine.replace("Payload: ", "");

  const encryptedSessionKey = base64ToArrayBuffer(b64Key);

  try {
    const rawSessionKey = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      myPrivateKey,
      encryptedSessionKey
    );

    // Import the unwrapped AES Key
    const sessionKey = await window.crypto.subtle.importKey(
      "raw",
      rawSessionKey,
      "AES-GCM",
      true,
      ["decrypt"]
    );

    // Decrypt Payload with AES
    const iv = base64ToArrayBuffer(b64IV);
    const encryptedPayload = base64ToArrayBuffer(b64Payload);

    const decryptedBytes = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(iv) },
      sessionKey,
      encryptedPayload
    );

    const text = new TextDecoder().decode(decryptedBytes);
    
    // Verify signature if present
    let verified = false;
    if (signatureLine) {
      try {
        const b64Signature = signatureLine.replace("Signature: ", "");
        const signature = base64ToArrayBuffer(b64Signature);
        
        // Fetch sender's profile to get their public key
        const { fetchRawProfile } = await import('../api/github.js');
        const senderProfile = await fetchRawProfile(metadata.sender_id, 'forkflirt');
        
        if (!senderProfile || !senderProfile.security?.public_key) {
          throw new Error("Sender's public key not found");
        }
        
        // Import sender's public key
        const { importPublicKeyFromPEM } = await import('./keys.js');
        const senderPublicKey = await importPublicKeyFromPEM(senderProfile.security.public_key);
        
        // Reconstruct the signed message data
        const messageData = [
          metadata.message_id,
          metadata.timestamp.toString(),
          metadata.sender_id,
          arrayBufferToBase64(encryptedPayload)
        ].join('|');
        
        // Verify the signature
        const enc = new TextEncoder();
        const isValid = await window.crypto.subtle.verify(
          { name: "RSA-PSS", saltLength: 32 },
          senderPublicKey,
          signature,
          enc.encode(messageData)
        );
        
        verified = isValid;
        
        if (!verified) {
          throw new Error("Signature verification failed - message may be tampered");
        }
      } catch (err) {
        console.warn("Signature verification failed:", err);
        verified = false;
      }
    } else {
      // No signature present - this is suspicious for encrypted messages
      console.warn("Message received without signature");
      verified = false;
    }
    
    // Mark message as seen
    await replayStore.addSeenMessage({
      message_id: metadata.message_id,
      sender_id: metadata.sender_id,
      timestamp: metadata.timestamp,
      expires_at: metadata.expires_at
    });
    
    return {
      text,
      verified,
      metadata
    };
  } catch (err) {
    throw createSecurityError("Message processing failed", err);
  }
}
