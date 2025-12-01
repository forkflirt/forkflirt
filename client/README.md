# ForkFlirt Reference Client (Web)

This is the official SvelteKit implementation of the ForkFlirt protocol. It is designed to be a "Zero-Backend" application that can be hosted entirely on GitHub Pages.

## 🏗 Technology Stack

- **Framework:** SvelteKit (Static Adapter)
- **Styling:** TailwindCSS
- **GitHub API:** Octokit.js
- **Cryptography:** Web Crypto API (Native Browser)
- **State:** LocalStorage (Persisted) + Svelte Stores (Runtime)

## 📂 Project Structure

```text
/src
├── components/
│   ├── cards/          # The Tinder-style Swipe UI
│   ├── crypto/         # Key generation & handshake logic
│   └── layout/         # Shell and Navigation
├── lib/
│   ├── github.ts       # Octokit wrappers (Search, Issues, Repo)
│   ├── schema.ts       # JSON Validation Logic
│   └── store.ts        # User session management
└── routes/
    ├── +page.svelte    # The Landing / Login
    ├── app/            # The Main App (Requires Auth)
    │   ├── swipe/      # Discovery Feed
    │   ├── profile/    # Editor for profile.json
    │   └── messages/   # Decrypted Inbox
    └── setup/          # Wizard for first-time profile creation
```

## ⚡️ Development Setup

### 1. Prerequisites

- Node.js 18+
- A GitHub Account (for creating the OAuth App)

### 2. Create a GitHub OAuth App

To allow users to login, you need a Client ID.

1.  Go to GitHub Developer Settings -> OAuth Apps -> New.
2.  **Application Name:** ForkFlirt (Local)
3.  **Homepage URL:** `http://localhost:5173`
4.  **Callback URL:** `http://localhost:5173/auth/callback`
5.  Copy the **Client ID**.

### 3. Installation

```bash
cd client
npm install
```

### 4. Configuration

Create a `.env` file in the `client/` root:

```bash
# The Client ID from Step 2
PUBLIC_GITHUB_CLIENT_ID=your_client_id_here

# Optional: For debugging API limits
PUBLIC_DEBUG_MODE=true
```

### 5. Run Local

```bash
npm run dev
# App will run at http://localhost:5173
```

## 📦 Deployment (GitHub Pages)

This app is designed to fork-and-deploy.

1.  **Build:**

    ```bash
    npm run build
    ```

    This generates a static `/build` folder using `@sveltejs/adapter-static`.

2.  **GitHub Actions:**
    The repository includes a `.github/workflows/deploy.yml` that automatically builds and deploys this client to GitHub Pages whenever you push to `main`.

## 🧩 Key Logic

### The "Serverless" Auth

We do not have a backend to exchange the OAuth Code for a Token. We use the **Device Flow** or a pure client-side token exchange proxy (like `gatekeeper`) depending on configuration.

_Default (Dev):_ The client prompts the user to paste a Personal Access Token (PAT) with `public_repo` scope if OAuth is not configured.

### Cryptography

Keys are generated in `src/lib/crypto.ts`.

- **Warning:** Clearing browser data will delete the Private Key.
- **Backup:** Users must use the "Export Keys" button in the settings panel to save a backup.
