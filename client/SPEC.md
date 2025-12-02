# ForkFlirt Client Specification v1.4

**Role:** Senior Frontend Architect
**Stack:** SvelteKit (Static Adapter), TailwindCSS, Octokit, WebCrypto API, Zod, IDB-Keyval.
**Context:** Monorepo. App is in `/client`, User Data is in `/profile`.

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
│   │   └── verification.ts # DNS & Keybase identity checks
│   ├── schemas/
│   │   └── profile.ts      # Zod definition matching Schema v1.2
│   ├── stores/
│   │   ├── user.ts         # Current user state & keys
│   │   ├── feed.ts         # Discovery queue (Filtered & Sorted)
│   ├── utils/
│   │   └── images.ts       # Asset URL resolution
│   └── components/
│       ├── ui/             # Atomic components
│       ├── profile/        # Complex Editor Forms (Multi-step)
│       └── swipe/          # The Card Stack UI
├── routes/
│   ├── +layout.svelte      # Main Shell
│   ├── +page.svelte        # Landing / Login / Host Profile View
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

## 4. Key Feature Requirements

### 4.1 Storage & Security

- **Secrets:** Private Keys MUST be stored in `IndexedDB` (using `idb-keyval` or similar). **NEVER** use `localStorage` for private keys (XSS risk).
- **Cache:** Public profiles and discovery results should be cached in `localStorage` with a timestamp.
  - **TTL:** 1 hour for public feeds.
  - **Strategy:** Stale-While-Revalidate (Show cached immediately, fetch fresh in background).

### 4.2 Image Handling (`lib/utils/images.ts`)

We cannot assume image paths. Implement `resolveAssetUrl(path, username, repo)`:

- **Logic:**
  - If `path` starts with `http`, return as-is.
  - If `path` is relative (`./assets/img.jpg`), transform to:
    `https://raw.githubusercontent.com/{username}/{repo}/main/profile/assets/img.jpg`
- **Error Handling:** Add an `onerror` handler to image tags to show a "Missing Asset" placeholder if the user deleted the file.

### 4.3 The "Wizard" (Onboarding)

Triggered ONLY if **Authenticated (Owner)** and `profile.json` is missing.

- **Step 1: Identity:** Generate RSA-OAEP-2048 Keypair. Store Private Key in `IndexedDB`.
- **Step 2: Vitals:** Name, Age (18+), Location (City/Country).
- **Step 3: The Matrix:** Forms for `details` (Vices, Lifestyle) and `essays` (Prompts).
- **Step 4: The Survey:** Present 5-10 "Core Questions". User picks Answer + Importance.
- **Action:**
  1.  Create `profile/profile.json`.
  2.  Upload images to `profile/assets/`.
  3.  Commit both to the `main` branch using Octokit.

### 4.4 Matching Algorithm (`lib/logic/matching.ts`)

The matching logic is bidirectional.

1.  **Fetch:** Query `topic:forkflirt-profile`.
2.  **Parse:** Validate `profile.json` via Zod.
3.  **Constraint:** If `overlapping_questions < 3`, do not show a Match %. Show "Insufficient Data."
4.  **Scoring:**
    - Map `importance` to points: `mandatory`(250), `very_important`(50), `somewhat`(10), `little`(1), `irrelevant`(0).
    - Calculate **Score A->B**: (Points Earned / Total Possible Points).
    - Calculate **Score B->A**: (Points Earned / Total Possible Points).
    - **Final Match %:** The Geometric Mean: $\sqrt{Score_{AB} \times Score_{BA}}$.
5.  **Sorting:** Feed must be sorted by Final Match %.

### 4.5 Moderation (`lib/logic/moderation.ts`)

Before rendering the feed, the client must build a "Block Ruleset".

1.  **Fetch:** Download the user's `.forkflirtignore` file from the **Repo Root** (`/`).
2.  **Parse:** Handle `block:username`, `filter:tag`, and `filter:keyword` directives.
3.  **Imports:** Recursively fetch `import:` URLs (max depth 2) to load shared blocklists.
4.  **Apply:** Remove any candidate from the feed that matches a Rule.

### 4.6 Verification System (`lib/logic/verification.ts`)

Display "Trust Signals" on the profile card. Support multiple providers to avoid lock-in.

1.  **Keybase Verification:**

    - Fetch Keybase user API.
    - Check if they have a `proof_type: github` that matches the repo owner.
    - If yes, display all their other proofs.

2.  **Mastodon Verification (Back-Link):**
    - **Input:** User provides Mastodon URL.
    - **Fetch:** `https://{instance}/api/v1/accounts/lookup?acct={username}`.
    - **Logic:** Scan `note` (Bio) and `fields` for the ForkFlirt repo URL.
3.  **DNS Verification:**

    - Fetch Google DNS JSON (`https://dns.google/resolve...`).
    - **Logic:** Iterate through **ALL** items in the `Answer` array.
    - Check for `forkflirt-verify={username}`.

4.  **Well-Known Resource Verification (File Upload):**
    - **Input:** User provides a Personal Domain (e.g., `https://my-blog.com`).
    - **Fetch:** `GET https://my-blog.com/.well-known/forkflirt.json`.
    - **Logic:** Parse JSON and check if `forkflirt_verify` matches the repo owner.
    - **Error Handling:** If the fetch fails due to CORS (Network Error), display a specific warning: _"Verification failed: Your server is blocking the request. Please enable CORS on your .well-known folder."_

### 4.7 Encrypted Messaging

- **Send:**

  1.  Fetch Recipient's `profile/profile.json`.
  2.  Extract `security.public_key`.
  3.  Generate random AES session key.
  4.  Encrypt Message (AES) + Encrypt AES Key (RSA).
  5.  Post as GitHub Issue: `ForkFlirt Handshake: [Hash]`.

- **Receive:**

  1.  Poll Issues with `ForkFlirt Handshake`.
  2.  Decrypt using Private Key from `IndexedDB`.

### 4.8 Base Path & Routing

- **Configuration:** `svelte.config.js` must use `paths.base`.
- **Usage:** All internal links (`<a href>`) and asset references (`<img src>`) must use the SvelteKit `$app/paths` module (e.g., `{base}/app/swipe`). Failing to do this will break the app when deployed to `github.io/repo-name/`.

## 5. Resilience & Error Handling

- **Octokit Failures:** Wrap all API calls. If 403 (Rate Limit), show a user-friendly "GitHub is tired, come back in an hour" modal.
- **Malformed Profiles:** If a `profile.json` fails Zod validation, log it to console and **skip** it in the feed. Do not crash the app.
