# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ForkFlirt is a decentralized, serverless dating protocol built entirely on GitHub infrastructure. Users fork the repository, deploy their own instance via GitHub Pages, and interact through encrypted GitHub Issues and public profile JSON files. The project consists of a SvelteKit client application and protocol specifications.

## Development Commands

### Client Development (Primary work in `/client`)
```bash
cd client

# Development server with hot reload
npm run dev

# Production build (creates static files for GitHub Pages)
npm run build

# Strict TypeScript type checking (fails on warnings)
npm run check

# Type checking with file watcher
npm run check:watch

# Preview production build locally
npm run preview
```

### Protocol Schema Validation
```bash
cd protocol

# Validate profile schemas using AJV
npm run test:schema
```

### Root Level Commands
```bash
# Install git hooks (Husky)
npm run prepare
```

## Architecture Overview

### Monorepo Structure
- **`/client`**: SvelteKit 2.49.0 application (static adapter) - user interface
- **`/protocol`**: JSON schemas, documentation, and protocol standards
- **`/profile`**: Empty by default - stores user profile.json and images when deployed

### Key Technologies
- **Frontend**: SvelteKit 2.49.0, Svelte 5.45.2, TypeScript 5.9.3 (strict mode)
- **Styling**: TailwindCSS 4.1.17 with DaisyUI 5.5.5
- **Build**: Vite 7.2.6 with static adapter for GitHub Pages
- **Crypto**: OpenPGP 6.2.2 (RSA-OAEP/AES-GCM encryption)
- **GitHub**: @octokit/rest, @octokit/auth-oauth-device
- **Security**: DOMPurify 3.3.0, AJV 8.17.1 (schema validation)
- **Storage**: idb-keyval 6.2.2 (IndexedDB)

### Core Architecture Patterns

**Serverless P2P Design**:
- GitHub APIs serve as the only infrastructure/relay layer
- All matching, decryption, and processing happens client-side
- User data stored in user-owned repositories as JSON files

**Security Architecture**:
- End-to-end encryption using RSA-OAEP for key exchange
- AES-GCM for message encryption
- Client-side key generation (never transmitted)
- Input sanitization with DOMPurify
- Schema validation with AJV

**Client Structure** (`client/src/lib/`):
- `api/`: GitHub API integration and authentication
- `components/`: Reusable Svelte UI components
- `crypto/`: Encryption/decryption operations
- `logic/`: Core business logic (matching, handshakes)
- `schemas/`: TypeScript type definitions
- `stores/`: Svelte stores for state management
- `utils/`: Utility functions

## Development Workflow

### Git Hooks (Husky)
Pre-commit hook enforces code quality:
- Runs `npm run check` (strict TypeScript checking)
- Blocks commits containing TODO/FIXME comments
- Located at `.husky/pre-commit`

### Deployment Process
- **Trigger**: Push to main branch or manual workflow_dispatch
- **Platform**: GitHub Actions → GitHub Pages
- **Build Environment**: Ubuntu, Node.js 20
- **Working Directory**: All commands run inside `./client`
- **Output**: Static files in `./client/build`

### Profile Creation Process
1. User forks repository to personal account
2. Enables GitHub Pages with GitHub Actions
3. Visits deployed URL (e.g., `https://username.github.io/forkflirt`)
4. Runs profile wizard - generates cryptographic keys client-side
5. Profile automatically committed to repository

## Key Protocol Concepts

### Discovery System
Uses GitHub Search API with `topic:forkflirt-profile` to find potential matches. Profiles are indexed by GitHub's search infrastructure.

### Messaging Protocol
1. Fetch recipient's public key from their profile.json
2. Encrypt message using RSA-OAEP
3. Create GitHub Issue titled "ForkFlirt Handshake" on recipient's repo
4. Recipient decrypts client-side using their private key

### Identity Verification
Cross-platform verification to prove real human identity:
- **DNS Verification**: TXT records with verification tokens
- **Keybase Integration**: Automatic trust of Keybase proofs
- **Supported Platforms**: Twitter, Reddit, Mastodon

## Schema and Data Validation

Profile data must validate against `protocol/schemas/profile.schema.json`. The client uses AJV 8.17.1 with ajv-formats for strict runtime validation. Test changes using `npm run test:schema` in the protocol directory.

## Security Considerations

This codebase handles sensitive user data and cryptographic operations:
- All encryption/decryption happens client-side
- Private keys never leave the user's browser
- Input sanitization required for all user-generated content
- Follow security-first development practices
- Report security vulnerabilities to `security@plugpuppy.com`

## Contributing Guidelines

- Client improvements: Submit PRs to `/client`
- Protocol changes: Submit RFCs to `/protocol/docs/rfc`
- All new features must default to "Private" or "Encrypted"
- Zero tolerance for harassment logic or privacy violations
- Read `CONTRIBUTING.md` for detailed process