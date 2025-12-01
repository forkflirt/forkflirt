# Security & Cryptography

**Status:** Draft 1.0
**Warning:** ForkFlirt is a client-side protocol. Security depends heavily on the browser environment (Web Crypto API).

## 1. Identity & Keys

Upon initialization, the client generates a cryptographic identity. This is distinct from the user's GitHub SSH keys.

### 1.1 Key Generation

The client must generate a **2048-bit RSA-OAEP** keypair using the native `window.crypto.subtle` API.

- **Private Key:** Stored in the browser's `localStorage` (or IndexedDB). It **never** leaves the user's device. It is exportable by the user as a `.pem` file for backup/migration.
- **Public Key:** Exported as SPKI (Subject Public Key Info), PEM-encoded, and written to `profile.json` in the public repository.

### 1.2 Key Usage

- **Encrypt:** Uses RSA-OAEP-256.
- **Decrypt:** Uses RSA-OAEP-256.
- **Hash:** SHA-256 used for calculating key fingerprints.

## 2. The "Handshake" (Messaging)

GitHub Issues are public. Therefore, we treat the issue body as a hostile environment. All "Direct Messages" are fully encrypted payloads.

### 2.1 Encryption Flow (Alice messaging Bob)

1.  **Fetch Key:** Alice's Client fetches Bob's `profile.json` and parses `security.public_key`.
2.  **Session Key:** Alice's Client generates a one-time random **AES-GCM (256-bit)** session key.
3.  **Encrypt Payload:** Alice's Client encrypts her message text + her own metadata using the AES session key.
4.  **Wrap Key:** Alice's Client encrypts the AES session key using Bob's RSA Public Key.
5.  **Transport:** Alice's Client uses the GitHub API to create a new Issue on Bob's repository.

### 2.2 The Issue Format

The Issue Title should be opaque to prevent leaking intent, but identifiable by the client.

- **Title:** `ForkFlirt Handshake: [Random 8-char Hash]`
- **Body:**

```text
-----BEGIN FORKFLIRT ENCRYPTED MESSAGE-----
Version: 1.0
Key-Wrap: [Base64 Encrypted AES Key]
IV: [Base64 Initialization Vector]
Payload: [Base64 Encrypted Message Body]
-----END FORKFLIRT ENCRYPTED MESSAGE-----
```

### 2.3 Decryption Flow (Bob reading messages)

1.  Bob's Client scans his repository's Issues for the `ForkFlirt Handshake` pattern.
2.  It parses the Base64 blocks.
3.  It unwraps the AES Key using Bob's Private Key (from `localStorage`).
4.  It decrypts the Payload using the AES Key.
5.  **Verification:** The inner payload contains Alice's Public Key. The client verifies this matches the `profile.json` of the sender (to prevent spoofing).

## 3. Threat Model

### 3.1 Known Risks

- **Metadata Leakage:** While the _content_ is encrypted, the _interaction_ is public. Anyone can see that User A created an Issue on User B's repo. This reveals the social graph.
- **Public Scrapers:** `profile.json` is public. Do not store sensitive PII (home address, phone number) in the JSON.
- **Forward Secrecy:** v1.0 does **not** implement perfect forward secrecy. If a user's Private Key is compromised, all historical messages stored in GitHub Issues can be decrypted.

### 3.2 Mitigation

- **Burner Accounts:** Users concerned about graph analysis should create a dedicated GitHub account for dating, separate from their professional code portfolio.
- **Issue Deletion:** Once a connection moves to a secure channel (Signal, Matrix), users should close and delete the GitHub Issue to remove the encrypted blob from the public view.

## 4. Key Integrity (Optional PGP Signing)

To prevent "Silent Key Swap" attacks (where an attacker compromises the GitHub account and replaces the Chat Key), users MAY sign their ForkFlirt Key with their Keybase PGP Key.

### 4.1 The Setup

1.  User generates ForkFlirt Key in browser.
2.  User copies the PEM string.
3.  User signs it externally: `echo "PEM_STRING" | keybase pgp sign`
4.  User pastes the output into `profile.json` -> `security.signature`.

### 4.2 Client Verification Logic

When a client encounters a profile with a `security.signature` field:

1.  **Fetch PGP Key:** Retrieve the PGP key from Keybase: `https://keybase.io/_/api/1.0/user/lookup.json`
2.  **Verify:** Use a PGP library (e.g., OpenPGP.js) to verify that `security.signature` signs the content of `security.public_key`.
3.  **Enforcement:**
    - **Valid:** Display "🔒 Signed Identity" badge.
    - **Invalid:** **CRITICAL WARNING.** Block messaging. This indicates the GitHub account content has been altered by someone who does not hold the PGP private key.
