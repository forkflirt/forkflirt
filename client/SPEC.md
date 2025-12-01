# ForkFlirt Client Specification v1.2 (Monorepo)

**Role:** You are a Senior Frontend Architect building a "Serverless" Dating App.
**Stack:** SvelteKit (Static Adapter), TailwindCSS, Octokit, WebCrypto API, Zod.
**Context:** This is a Monorepo. The App source is in `/client`. User Data is in `/profile`. Protocol Docs are in `/protocol`.

## 1. Core Architecture

The app runs entirely in the browser using GitHub as a "dumb" backend.

- **Database:** `profile.json` stored in the `/profile` directory of the user's repo.
- **Auth:** GitHub OAuth (Device Flow or PAT).
- **Logic Layer:** All complex logic (matching, crypto, moderation) must be isolated in `src/lib/logic/`.

## 2. File System Structure

The generated SvelteKit project must follow this structure inside the `/client` directory:

```text
/client/src
├── lib/
│   ├── api/
│   │   ├── github.ts       # Octokit Wrapper (Search, Commit, Issues)
│   │   └── auth.ts         # Token management
│   ├── crypto/
│   │   ├── keys.ts         # RSA-OAEP Keygen (WebCrypto)
│   │   └── cipher.ts       # AES-GCM Encryption/Decryption
│   ├── logic/
│   │   ├── matching.ts     # The Compatibility Algorithm (Geometric Mean)
│   │   ├── moderation.ts   # .forkflirtignore parser & blocklist logic
│   │   └── verification.ts # "Green Squares" / Activity Score logic
│   ├── schemas/
│   │   └── profile.ts      # Zod definition matching Schema v1.1
│   ├── stores/
│   │   ├── user.ts         # Current user state & keys
│   │   ├── feed.ts         # Discovery queue (Filtered & Sorted)
│   └── components/
│       ├── ui/             # Atomic components
│       ├── profile/        # Complex Editor Forms (Multi-step)
│       └── swipe/          # The Card Stack UI
├── routes/
│   ├── +layout.svelte      # Main Shell
│   ├── +page.svelte        # Landing
│   ├── setup/              # Wizard (Keys -> Details -> Survey -> Commit)
│   ├── app/
│   │   ├── swipe/          # Main Feed
│   │   ├── messages/       # Encrypted Inbox
│   │   └── profile/        # Editor
```

## 3. Data Pathing Strategy

Since the app is hosted via GitHub Pages, it must access data via **HTTP (Raw)** or **API (Octokit)**.

- **Profile Path:** `profile/profile.json`
- **Assets Path:** `profile/assets/`
- **Read URL:** `https://raw.githubusercontent.com/{username}/{repo}/main/profile/profile.json`
- **Image URL Transformation:**
  - Input in JSON: `./assets/me.jpg`
  - Rendered URL: `https://raw.githubusercontent.com/{username}/{repo}/main/profile/assets/me.jpg`

## 4. Key Feature Requirements

### 4.1 The "Wizard" (Onboarding)

When a user authenticates, check for `profile/profile.json`. If missing, launch the Wizard.

- **Step 1: Identity:** Generate RSA-OAEP-2048 Keypair. Store Private Key in `IndexedDB`.
- **Step 2: Vitals:** Name, Age (18+), Location (City/Country).
- **Step 3: The Matrix:** Forms for `details` (Vices, Lifestyle) and `essays` (Prompts).
- **Step 4: The Survey:** Present 5-10 "Core Questions". User picks Answer + Importance.
- **Action:**
  1.  Create `profile/profile.json`.
  2.  Upload images to `profile/assets/`.
  3.  Commit both to the `main` branch using Octokit.

### 4.2 The Matching Algorithm (`lib/logic/matching.ts`)

The matching logic is bidirectional.

1.  **Fetch:** Query `topic:forkflirt-profile`.
2.  **Parse:** Validate `profile.json` via Zod.
3.  **Scoring:**
    - Map `importance` to points: `mandatory`(250), `very_important`(50), `somewhat`(10), `little`(1), `irrelevant`(0).
    - Calculate **Score A->B**: (Points Earned / Total Possible Points).
    - Calculate **Score B->A**: (Points Earned / Total Possible Points).
    - **Final Match %:** The Geometric Mean: $\sqrt{Score_{AB} \times Score_{BA}}$.
4.  **Sorting:** Feed must be sorted by Final Match %.

### 4.3 Decentralized Moderation (`lib/logic/moderation.ts`)

Before rendering the feed, the client must build a "Block Ruleset".

1.  **Fetch:** Download the user's `.forkflirtignore` file from the **Repo Root** (`/`).
2.  **Parse:** Handle `block:username`, `filter:tag`, and `filter:keyword` directives.
3.  **Imports:** Recursively fetch `import:` URLs (max depth 2) to load shared blocklists.
4.  **Apply:** Remove any candidate from the feed that matches a Rule.

### 4.4 Verification System (`lib/logic/verification.ts`)

Display "Trust Signals" on the profile card.

1.  **DNS Verification:**
    - Check for a TXT record on the user's custom domain (if provided in `links`).
    - Query: `https://cloudflare-dns.com/dns-query?name={domain}&type=TXT`
    - Look for string: `forkflirt-verify={github_username}`.
2.  **Keybase Verification:**
    - If `security.keybase_user` is present in profile (or inferred from links), fetch Keybase proofs.
    - Query: `https://keybase.io/_/api/1.0/user/lookup.json`
    - Check: Does `proofs_summary.github` match the current Repo Owner?
    - Action: If matched, display "Verified" badge and list other proofs (Twitter, Reddit, etc.).

### 4.5 Encrypted Messaging

- **Send:**
  1.  Fetch Recipient's `profile/profile.json`.
  2.  Extract `security.public_key`.
  3.  Generate random AES session key.
  4.  Encrypt Message (AES) + Encrypt AES Key (RSA).
  5.  Post as GitHub Issue: `ForkFlirt Handshake: [Hash]`.
- **Receive:**

  1.  Poll Issues with `ForkFlirt Handshake`.
  2.  Decrypt using Private Key from `IndexedDB`.

  ### 4.6 Advanced Security (PGP Check)

If `profile.json` contains `security.signature`:

1.  Lazy-load `openpgp.js` (to save bundle size).
2.  Fetch the user's PGP key from Keybase.
3.  Verify the signature against the `public_key`.
4.  If verification fails, display a **"Security Mismatch"** error overlay on the profile and disable the "Message" button.

## 5. Technical Constraints

- **Zod Schema:** Must strictly validate v1.1 features (Enum checks for vices, Survey structure).
- **Images:** Use `raw.githubusercontent.com` proxies. Handle 404s gracefully with a placeholder.
- **API Limits:** If OAuth is not present, warn the user about rate limits (60req/hr).
- **Base Path:** Ensure `svelte.config.js` `paths.base` is respected for routing on GitHub Pages.
