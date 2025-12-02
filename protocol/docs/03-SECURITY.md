# Security & Cryptography

**Status:** Draft 2.0
**Warning:** ForkFlirt is a client-side protocol. Security depends heavily on the browser environment (Web Crypto API).

## 1. Identity & Keys

Upon initialization, the client generates a cryptographic identity. This is distinct from the user's GitHub SSH keys.

### 1.1 Key Generation

The client must generate a **2048-bit RSA-OAEP** keypair using the native `window.crypto.subtle` API.

- **Private Key:** Encrypted and stored in IndexedDB using passphrase protection. It **never** leaves the user's device. Private keys are encrypted with AES-GCM using PBKDF2-derived keys (600,000 iterations).
- **Public Key:** Exported as SPKI (Subject Public Key Info), PEM-encoded, and written to `profile.json` in the public repository.

### 1.2 Passphrase Protection

All private keys must be encrypted with user passphrases:

#### 1.2.1 Passphrase Requirements
- **Minimum**: 4 words, 12 characters
- **Complexity**: At least 2 of (letters, numbers, symbols)
- **Strength**: Validated using zxcvbn library (score ≥ 3)
- **Patterns**: Reject common patterns and sequential characters

#### 1.2.2 Key Derivation
- **Algorithm**: PBKDF2 with SHA-256
- **Iterations**: 600,000
- **Salt**: 16-byte random salt per key
- **Output**: AES-GCM 256-bit wrapping key

### 1.3 Key Usage

- **Encrypt:** Uses RSA-OAEP-256.
- **Decrypt:** Uses RSA-OAEP-256.
- **Hash:** SHA-256 used for calculating key fingerprints.

### 1.4 Key Rotation System

Clients must implement forward secrecy through key rotation:

#### 1.4.1 Rotation Configuration
- **Default Interval**: 365 days
- **Transition Period**: 90 days
- **Key History**: Maintain maximum 3 previous keys
- **Version Tracking**: Monotonically increasing version numbers

#### 1.4.2 Rotation Process
1. Generate new keypair before current key expires
2. Add current key to `previous_keys` array with deactivation timestamp
3. Update `current_key` and increment `rotation_version`
4. Set `next_rotation` timestamp
5. Maintain ability to decrypt messages encrypted with previous keys

#### 1.4.3 Key History Format
```json
{
  "public_key": "PEM-encoded previous key",
  "timestamp": "2024-01-01T00:00:00Z",
  "deactivated": "2025-01-01T00:00:00Z",
  "version": 1
}
```

## 2. The "Handshake" (Messaging)

GitHub Issues are public. Therefore, we treat the issue body as a hostile environment. All "Direct Messages" are fully encrypted payloads.

### 2.1 Message Format v2.0

All messages must use the v2.0 format with mandatory signatures:

#### 2.1.1 Message Metadata
Each message includes encrypted metadata:
- **version**: "2.0"
- **timestamp**: Unix timestamp with 5-minute clock skew tolerance
- **sender_id**: SHA-256 fingerprint of sender's public key
- **message_id**: UUID v4 for replay protection
- **expires_at**: Message expiration (default 24 hours)
- **reply_to**: Optional message_id for threading

#### 2.1.2 Metadata Protection
- **Padding**: Random padding to normalize metadata size (512 bytes target)
- **Integrity**: SHA-256 checksums for tampering detection
- **Encryption**: Metadata encrypted with recipient's RSA public key

### 2.2 Encryption Flow (Alice messaging Bob)

1.  **Fetch Key:** Alice's Client fetches Bob's `profile.json` and parses `security.public_key`.
2.  **Generate Metadata:** Create message metadata with UUID, timestamp, expiration.
3.  **Session Key:** Alice's Client generates a one-time random **AES-GCM (256-bit)** session key.
4.  **Encrypt Payload:** Alice's Client encrypts her message text using the AES session key.
5.  **Sign Message:** Alice signs message data (metadata + payload) with her private key using RSA-PSS.
6.  **Wrap Key:** Alice's Client encrypts the AES session key using Bob's RSA Public Key.
7.  **Encrypt Metadata:** Encrypt protected metadata with Bob's RSA Public Key.
8.  **Transport:** Alice's Client uses the GitHub API to create a new Issue on Bob's repository.

### 2.3 The Issue Format

The Issue Title should be opaque to prevent leaking intent, but identifiable by the client.

- **Title:** `ForkFlirt Handshake: [Random 8-char Hash]`
- **Body:**

```text
-----BEGIN FORKFLIRT ENCRYPTED MESSAGE-----
Version: 2.0
Encoding: Base64
Metadata: [Base64 Encrypted Protected Metadata]
Key-Wrap: [Base64 Encrypted AES Key]
IV: [Base64 Initialization Vector]
Payload: [Base64 Encrypted Message Body]
Signature: [Base64 RSA-PSS Signature]
-----END FORKFLIRT ENCRYPTED MESSAGE-----
```

### 2.4 Decryption Flow (Bob reading messages)

1.  Bob's Client scans his repository's Issues for the `ForkFlirt Handshake` pattern.
2.  **Rate Limiting Check**: Enforce 100 decrypt attempts per minute with constant-time delays.
3.  Parse Base64 blocks for Metadata, Key, IV, Payload, and Signature.
4.  **Decrypt Metadata**: Decrypt protected metadata using Bob's Private Key.
5.  **Validate Metadata**: Check timestamp (5-minute skew), expiration, and integrity.
6.  **Replay Protection**: Check if message_id/sender_id already seen. Reject duplicates.
7.  **Unwrap AES Key** using Bob's Private Key from encrypted storage.
8.  **Decrypt Payload** using the AES Key and IV.
9.  **Verify Signature**: Fetch sender's public key and verify RSA-PSS signature.
10. **Mark as Seen**: Add message to replay protection store.

#### 2.4.1 Replay Protection Store
- **Storage**: IndexedDB with SHA-256 integrity hashes
- **Capacity**: 10,000 messages maximum
- **Retention**: 24 hours from receipt time
- **Integrity**: Tamper detection on stored messages
- **Cleanup**: Automatic removal of expired messages

## 3. Profile Integrity

### 3.1 Profile Signatures

All profiles must be cryptographically signed to prevent tampering:

#### 3.1.1 Signature Requirements
- **Algorithm**: RSA-PSS with SHA-256, 32-byte salt
- **Data Signed**: Canonical JSON of profile (excluding signature fields)
- **Timestamp**: ISO 8601 timestamp with 24-hour validity
- **Nonce**: UUID v4 for uniqueness
- **Re-signing**: Required every 7 days or when profile content changes

#### 3.1.2 Signature Fields
```json
{
  "profile_signature": "base64-encoded RSA-PSS signature",
  "signature_timestamp": "2025-12-01T14:00:00Z",
  "signature_nonce": "uuid-v4-format-string"
}
```

#### 3.1.3 Verification Process
1. Check signature fields exist and are not expired
2. Create canonical profile JSON (sorted keys)
3. Recreate signed data: canonical + timestamp + nonce
4. Verify RSA-PSS signature with public key from profile
5. Reject profile if verification fails

### 3.2 Security Controls

#### 3.2.1 Rate Limiting
- **Decryption**: 100 attempts per minute per client
- **Constant-time**: Delays to prevent timing attacks
- **Exponential Backoff**: Progressive delays for repeated failures

#### 3.2.2 Timing Attack Prevention
- **String Comparison**: Constant-time comparison for sensitive data
- **Error Delays**: Consistent timing for success/failure paths
- **Padding**: Normalized response sizes to prevent analysis

#### 3.2.3 Input Validation
- **Format Validation**: Strict validation of all cryptographic inputs
- **Range Checking**: Validate timestamps, message sizes, key lengths
- **Rejection**: Immediate rejection of malformed messages

## 4. Threat Model

### 4.1 Known Risks

- **Metadata Leakage:** While the _content_ is encrypted, the _interaction_ is public. Anyone can see that User A created an Issue on User B's repo. This reveals the social graph.
- **Public Scrapers:** `profile.json` is public. Do not store sensitive PII (home address, phone number) in the JSON.

### 4.2 Mitigation

- **Metadata Protection**: Message v2.0 includes padding and normalized sizes
- **Burner Accounts:** Users concerned about graph analysis should create a dedicated GitHub account for dating, separate from their professional code portfolio.
- **Issue Deletion:** Once a connection moves to a secure channel (Signal, Matrix), users should close and delete the GitHub Issue to remove the encrypted blob from the public view.

### 4.3 Security Limitations

- **Key Compromise**: If a user's Private Key is compromised, an attacker can decrypt all messages sent to that user, including historical messages.
- **Profile Tampering**: Without proper signature verification, malicious actors could modify profile.json content.
- **Replay Attacks**: Without replay protection, valid messages could be resent and processed multiple times.

## 5. Key Integrity (Optional PGP Signing)

To prevent "Silent Key Swap" attacks (where an attacker compromises the GitHub account and replaces the Chat Key), users MAY sign their ForkFlirt Key with their Keybase PGP Key.

### 5.1 The Setup

1.  User generates ForkFlirt Key in browser.
2.  User copies the PEM string.
3.  User signs it externally: `echo "PEM_STRING" | keybase pgp sign`
4.  User pastes the output into `profile.json` -> `security.signature`.

### 5.2 Client Verification Logic

When a client encounters a profile with a `security.signature` field:

1.  **Fetch PGP Key:** Retrieve the PGP key from Keybase: `https://keybase.io/_/api/1.0/user/lookup.json`
2.  **Verify:** Use a PGP library (e.g., OpenPGP.js) to verify that `security.signature` signs the content of `security.public_key`.
3.  **Enforcement:**
    - **Valid:** Display "🔒 Signed Identity" badge.
    - **Invalid:** **CRITICAL WARNING.** Block messaging. This indicates the GitHub account content has been altered by someone who does not hold the PGP private key.
