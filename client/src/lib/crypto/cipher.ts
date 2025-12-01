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

// --- Encryption (Sending) ---

/**
 * Encrypts a text message for a specific recipient.
 * 1. Generates a random AES-GCM session key.
 * 2. Encrypts the message with AES.
 * 3. Encrypts the AES key with the recipient's RSA Public Key.
 */
export async function encryptMessage(
  message: string,
  recipientPublicKey: CryptoKey
): Promise<string> {
  const enc = new TextEncoder();
  const encodedMsg = enc.encode(message);

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

  // 6. Format Output Block
  const b64Key = arrayBufferToBase64(encryptedSessionKey);
  const b64IV = arrayBufferToBase64(iv.buffer);
  const b64Payload = arrayBufferToBase64(encryptedPayload);

  return [
    HEADER,
    "Version: 1.1",
    "Encoding: Base64",
    `Key-Wrap: ${b64Key}`,
    `IV: ${b64IV}`,
    `Payload: ${b64Payload}`,
    FOOTER,
  ].join("\n");
}

// --- Decryption (Receiving) ---

export interface DecryptedMessage {
  text: string;
  verified: boolean; // Placeholder for future signature checks
}

/**
 * Decrypts a message block using the user's Private Key.
 */

const DECRYPT_LIMIT = 100; // Max attempts per minute
let decryptAttempts = 0;

export async function decryptMessage(
  encryptedBlock: string,
  myPrivateKey: CryptoKey
): Promise<DecryptedMessage> {
  // this prevents DoS from issues spam with garbage encrypted messages; revisit
  if (decryptAttempts++ > DECRYPT_LIMIT) {
    throw new Error("Too many decryption attempts, please refresh");
  }

  // 1. Parse Block
  const lines = encryptedBlock.split("\n").map((l) => l.trim());

  const keyLine = lines.find((l) => l.startsWith("Key-Wrap: "));
  const ivLine = lines.find((l) => l.startsWith("IV: "));
  const payloadLine = lines.find((l) => l.startsWith("Payload: "));

  if (!keyLine || !ivLine || !payloadLine) {
    throw new Error("Malformed Encrypted Block");
  }

  const b64Key = keyLine.replace("Key-Wrap: ", "");
  const b64IV = ivLine.replace("IV: ", "");
  const b64Payload = payloadLine.replace("Payload: ", "");

  // 2. Unwrap AES Key (Decrypt with RSA Private Key)
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

    // 3. Decrypt Payload with AES
    const iv = base64ToArrayBuffer(b64IV);
    const encryptedPayload = base64ToArrayBuffer(b64Payload);

    const decryptedBytes = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(iv) },
      sessionKey,
      encryptedPayload
    );

    // 4. Decode
    const dec = new TextDecoder();
    return {
      text: dec.decode(decryptedBytes),
      verified: true,
    };
  } catch (err) {
    console.error("Decryption failed:", err);
    throw new Error(
      "Failed to decrypt message. Invalid key or corrupted data."
    );
  }
}
