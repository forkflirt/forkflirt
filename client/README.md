# ForkFlirt Web Client

Reference implementation of the ForkFlirt Protocol using SvelteKit.

This client runs entirely in the browser, using your GitHub repository as its database.

## 🏗 Technology Stack

- **Framework:** SvelteKit (Static Adapter)
- **Styling:** TailwindCSS
- **GitHub API:** Octokit.js (REST)
- **Cryptography:** Web Crypto API (RSA-OAEP-2048 / AES-GCM)
- **State:** IndexedDB (encrypted keys) + Svelte Stores (Runtime)

## 📂 Project Structure

This project lives inside the `/client` directory of the Monorepo.

```text
/src
├── lib/
│   ├── api/            # GitHub API wrappers & authentication
│   ├── crypto/         # Key generation, encryption, signatures
│   ├── logic/          # Protocol implementation
│   │   ├── matching.ts     # Compatibility score calculation
│   │   ├── moderation.ts   # Content filtering & behavioral blocking
│   │   ├── verification.ts # Identity verification methods
│   │   └── behavioral-blocking.ts # Anti-abuse protection
│   ├── schemas/        # Profile validation (AJV)
│   └── stores/         # Svelte stores (User, authentication)
└── routes/
    ├── setup/          # The "Wizard" (Profile Creation)
    ├── app/            # The Main Interface
    │   ├── swipe/      # Discovery Feed
    │   ├── messages/   # Encrypted Inbox
    │   └── profile/    # Profile Editor
```

## ⚡️ Development Setup

### 1. Prerequisites

- Node.js 18+
- A GitHub Account

### 2. GitHub Configuration

To develop locally with full features, you need a Client ID for OAuth.

1.  **Developer Settings** -> **OAuth Apps** -> **New**.
2.  **Homepage:** `http://localhost:5173`
3.  **Callback:** `http://localhost:5173/auth/callback`

### 3. Installation

Since this is a Monorepo, make sure you are in the client directory.

```bash
cd client
npm install
```

### 4. Local Config

Create a `.env` file in `client/`:

```bash
PUBLIC_GITHUB_CLIENT_ID=your_client_id
```

### 5. Run Local

```bash
npm run dev
```

## 📦 Deployment

This app is designed to be **Forked** and **Deployed** by end-users.

1.  **The Automation:**
    The root `.github/workflows/deploy.yml` handles everything.
    It detects changes in `/client`, builds the static site, and deploys it to GitHub Pages.

2.  **Base Paths:**
    `svelte.config.js` is configured to respect the `BASE_PATH` environment variable, ensuring the app works when hosted at `username.github.io/repo-name/`.

## 🧩 Key Concepts

### 1. Data Storage (`/profile`)

This client does not use a typical database.

- **Read:** It fetches raw JSON from `https://raw.githubusercontent.com/.../main/profile/profile.json`.
- **Write:** It uses the GitHub API to commit changes to the `/profile` directory in the user's repo.

### 2. Client-Side Matching

No server algorithm. The client:

1. Fetches candidate profiles (`topic:forkflirt-profile`)
2. Parses their survey data
3. Calculates compatibility score using geometric mean formula
4. Applies behavioral blocking and content filtering

### 3. Identity Verification

Supports multiple verification methods:

- DNS TXT records on owned domains
- Keybase API verification (Twitter, Reddit, Mastodon)
- Mastodon back-link verification
- Well-known file verification

### 4. Security Features

- RSA-OAEP-2048/AES-GCM-256 encryption
- Mandatory RSA-PSS message signatures
- PBKDF2 key derivation (600,000 iterations)
- Key rotation for forward secrecy
- Rate limiting and replay protection
- Behavioral analysis for spam prevention

### 5. Authentication

Uses GitHub Personal Access Tokens for API access:
- CSRF protection for token input
- Rate limiting on login attempts
- CAPTCHA challenges after failed attempts
- Token format validation and scope checking
