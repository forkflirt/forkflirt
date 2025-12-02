# ForkFlirt

A serverless dating protocol built on GitHub infrastructure.

ForkFlirt replaces centralized dating algorithms with transparent, user-owned logic. You do not "sign up" for ForkFlirt. You **fork** it.

## Protocol Overview

- **Database**: User profiles stored in public GitHub repositories
- **Discovery**: GitHub Search API for finding profiles (`topic:forkflirt-profile`)
- **Messaging**: End-to-end encrypted messages via GitHub Issues
- **Verification**: Cross-platform identity verification through DNS, Keybase, and social platforms

---

## Quick Start

1. **Database**: Profile stored as JSON file in your repository
2. **Algorithm**: Matching calculations run client-side in browser
3. **Encryption**: Messages use RSA-OAEP/AES-GCM encryption
4. **Identity**: Verify using DNS TXT records, Keybase, or social platforms

---

## Installation

1. **Fork this repository** to your GitHub account
2. **Enable GitHub Pages:**
   - Go to `Settings` -> `Pages`
   - Source: `GitHub Actions`
3. **Visit your deployed URL** (e.g., `https://username.github.io/forkflirt`)
4. **Run the setup wizard** to generate cryptographic keys and create your profile

---

## 📂 Monorepo Structure

This repository contains both the official client and the protocol standards.

| Directory                     | Description                                                                                                                |
| :---------------------------- | :------------------------------------------------------------------------------------------------------------------------- |
| **[`/client`](./client)**     | **The App.** A SvelteKit application (Adapter-Static) that acts as your interface to the network. This is what you deploy. |
| **[`/protocol`](./protocol)** | **The Standards.** JSON Schemas, Architecture Docs, and RFCs defining how clients communicate.                             |
| **[`/profile`](./profile)**   | **The Data.** This directory is empty by default. When you use the app, your images and `profile.json` are saved here.     |

---

## Protocol Documentation

- **[01 - Architecture](./protocol/docs/01-ARCHITECTURE.md):** GitHub as a serverless relay
- **[02 - Schema](./protocol/docs/02-SCHEMA.md):** Profile JSON structure and validation
- **[03 - Security](./protocol/docs/03-SECURITY.md):** Message encryption and key management
- **[04 - Matching](./protocol/docs/04-MATCHING.md):** Compatibility score calculation
- **[05 - Moderation](./protocol/docs/05-MODERATION.md):** Content filtering and blocking
- **[06 - Verification](./protocol/docs/06-VERIFICATION.md):** Identity verification methods

### Core Concepts

#### 1. Discovery

We rely on the GitHub Search API. Clients query `topic:forkflirt-profile` to populate the global feed.

#### 2. Messaging

No backend server. To message User B:

1. Client A fetches User B's public key from their profile
2. Client A encrypts message using RSA-OAEP/AES-GCM
3. Client A creates GitHub Issue on User B's repository
4. Client B decrypts message locally using their private key

#### 3. Identity Verification

Uses cross-platform identity verification:

- **DNS Verification**: TXT record (`forkflirt-verify=username`) on owned domain
- **Keybase**: Automatic verification of Twitter, Reddit, Mastodon proofs
- **Well-Known Files**: JSON verification file on owned domain
- **Mastodon**: Back-link verification through bio/metadata

---

## Transparency & Safety

### 🕊️ Warrant Canary

As of **December 1, 2025**:
- Plug Puppy LLC has not received any government warrants, subpoenas, court orders, or surveillance demands
- Plug Puppy LLC has not received any gag orders, National Security Letters, or non-disclosure requirements
- Plug Puppy LLC has not been compelled to modify the ForkFlirt codebase or provide user data
- Plug Puppy LLC has not been subjected to any compelled disclosure requests

This canary is automatically updated monthly. If this section is removed or not updated for 60 days, assume compromise.

**Last updated**: December 1, 2025
**Update method**: Automated GitHub Actions (`.github/workflows/warrant-canary.yml`)
**Immutable record**: `canary-2025-12-01` tag


### Security

#### Private Data
- Message content (end-to-end encrypted)
- Private keys (stored encrypted in IndexedDB, passphrase-protected)
- Passphrases (never stored, used for PBKDF2 key derivation)

#### Public Data
- Profile data (stored in public GitHub repository)
- Profile existence (discoverable via GitHub search)
- Interaction metadata (GitHub Issues between users)
- GitHub contribution graph

#### Security Features
- RSA-OAEP-2048 encryption with AES-GCM-256 session keys
- Mandatory RSA-PSS message signatures
- PBKDF2 key derivation (600,000 iterations)
- Key rotation for forward secrecy
- Replay protection and rate limiting

#### Privacy Best Practices
- Use a dedicated GitHub account for ForkFlirt
- Consider using approximate locations instead of exact city
- Keep profile information minimal and non-specific
- Use blocklists to control interactions
- Regularly review who can see your profile

For detailed security information, see [SECURITY.md](./SECURITY.md)

---

## 🤝 Contributing

We are an **Open Code** organization.

- **Client Improvements:** Submit PRs to `/client`.
- **Protocol Changes:** Submit RFCs to `/protocol/docs/rfc`.

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before pushing.

---

## ⚖️ License & Governance

**ForkFlirt** is managed by **Plug Puppy LLC**.

### GNU AGPL v3.0

This project is strictly open source. If you modify the client and host it for others, you **must** open-source your changes.

### Commercial Licensing

If you wish to create a closed-source "White Label" version of ForkFlirt for your organization or proprietary community, please contact Plug Puppy LLC for commercial licensing options.

### Liability Disclaimer

**This software is provided "AS IS".**
ForkFlirt is a communication protocol, not a vetted dating agency. Users are responsible for their own safety. Plug Puppy LLC assumes no liability for interactions facilitated by this software. Always verify identities and use common sense when meeting strangers.
