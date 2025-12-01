# ForkFlirt Web Client

The official SvelteKit reference implementation for the **ForkFlirt Protocol**.
This client runs entirely in the browser, using your GitHub Repository as its database.

## 🏗 Technology Stack

- **Framework:** SvelteKit (Static Adapter)
- **Styling:** TailwindCSS
- **GitHub API:** Octokit.js (REST)
- **Cryptography:** Web Crypto API (RSA-OAEP-2048 / AES-GCM)
- **State:** LocalStorage (Persisted) + Svelte Stores (Runtime)

## 📂 Project Structure

This project lives inside the `/client` directory of the Monorepo.

```text
/src
├── lib/
│   ├── api/            # Octokit wrappers & Auth logic
│   ├── crypto/         # Key generation & Encryption primitives
│   ├── logic/          # PURE PROTOCOL LOGIC
│   │   ├── matching.ts     # Geometric Mean Compatibility Score
│   │   ├── moderation.ts   # .forkflirtignore parsing
│   │   └── verification.ts # DNS & Keybase identity checks
│   ├── schemas/        # Zod Validators for profile.json
│   └── stores/         # Svelte stores (User, Feed, Inbox)
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

There is no server algorithm. The client:

1.  Fetches candidate profiles (`topic:forkflirt-profile`).
2.  Parses their `survey` data.
3.  Calculates a **Compatibility Score** locally using the Geometric Mean formula defined in the Protocol.

### 3. Identity Verification

The client enforces the **Nerd Identity** protocol:

- It performs DNS lookups (DoH) to verify custom domains.
- It queries the Keybase API to verify social proofs (Twitter/Reddit).

### 4. "Serverless" Auth

We use the **Device Flow** (or direct Personal Access Token entry) to authenticate with GitHub without a proxy server. This ensures the app remains 100% static and cost-free.
