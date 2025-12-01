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

// --- Replay Protection Types ---

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

// --- Replay Protection Store ---

class ReplayProtectionStore {
  private readonly STORE_NAME = 'forkflirt_replay_protection';
  private readonly MAX_MESSAGES = 10000;
  
  async addSeenMessage(message: SeenMessage): Promise<void> {
    const existing = await this.getSeenMessages();
    existing.push(message);
    
    // Remove expired messages
    const now = Date.now();
    const filtered = existing.filter(msg => msg.expires_at > now);
    
    // Keep only the most recent MAX_MESSAGES
    const sorted = filtered.sort((a, b) => b.timestamp - a.timestamp);
    const limited = sorted.slice(0, this.MAX_MESSAGES);
    
    await this.saveSeenMessages(limited);
  }
  
  async isMessageSeen(messageId: string, senderId: string): Promise<boolean> {
    const messages = await this.getSeenMessages();
    return messages.some(msg => 
      msg.message_id === messageId && msg.sender_id === senderId
    );
  }
  
  async cleanupExpired(): Promise<void> {
    const messages = await this.getSeenMessages();
    const now = Date.now();
    const filtered = messages.filter(msg => msg.expires_at > now);
    await this.saveSeenMessages(filtered);
  }
  
  private async getSeenMessages(): Promise<SeenMessage[]> {
    try {
      const stored = localStorage.getItem(this.STORE_NAME);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }
  
  private async saveSeenMessages(messages: SeenMessage[]): Promise<void> {
    try {
      localStorage.setItem(this.STORE_NAME, JSON.stringify(messages));
    } catch (e) {
      console.warn('Failed to save replay protection data:', e);
    }
  }
}

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

const DECRYPT_LIMIT = 100; // Max attempts per minute
let decryptAttempts = 0;

export async function decryptMessage(
  encryptedBlock: string,
  myPrivateKey: CryptoKey
): Promise<DecryptedMessage> {
  // Rate limiting protection
  if (decryptAttempts++ > DECRYPT_LIMIT) {
    throw new Error("Too many decryption attempts, please refresh");
  }
  
  const lines = encryptedBlock.split("\n").map((l) => l.trim());
  
  const metadataLine = lines.find((l) => l.startsWith("Metadata: "));
  const keyLine = lines.find((l) => l.startsWith("Key-Wrap: "));
  const ivLine = lines.find((l) => l.startsWith("IV: "));
  const payloadLine = lines.find((l) => l.startsWith("Payload: "));
  const signatureLine = lines.find((l) => l.startsWith("Signature: "));
  
  if (!metadataLine || !keyLine || !ivLine || !payloadLine) {
    throw new Error("Malformed Encrypted Block");
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
    throw new Error("Failed to decrypt metadata");
  }
  
  // Validate timestamp
  const now = Date.now();
  const maxClockSkew = 5 * 60 * 1000; // 5 minutes
  
  if (metadata.timestamp > now + maxClockSkew) {
    throw new Error("Message timestamp is in the future");
  }
  
  if (now > metadata.expires_at) {
    throw new Error("Message has expired");
  }
  
  // Check for replay
  const replayStore = new ReplayProtectionStore();
  const isReplay = await replayStore.isMessageSeen(metadata.message_id, metadata.sender_id);
  
  if (isReplay) {
    throw new Error("Message replay detected");
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
    throw new Error("Failed to decrypt message. Invalid key or corrupted data.");
  }
}
