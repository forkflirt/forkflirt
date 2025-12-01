# Identity Verification

**Status:** Draft 1.3

We rely on **DNS** and **Keybase** to verify user identity without a backend server.

## 1. Domain Verification (DNS TXT)

For users who own a domain (writers, bloggers, server hosts).

### 1.1 The Protocol

The user must create a **TXT Record** on their domain:
`forkflirt-verify=<github_username>`

### 1.2 Client Implementation

The client uses **Google Public DNS (JSON API)** to verify ownership. This avoids CORS and Header issues common with other providers.

1.  **Fetch:** `https://dns.google/resolve?name={domain}&type=TXT`
2.  **Parse:** The response contains an `Answer` array.
3.  **Check:** Iterate through the `data` fields. Look for `forkflirt-verify={current_github_user}`.
4.  **Result:** If found, display a "Domain Verified" badge.

## 2. Social Verification (via Keybase)

We utilize Keybase to verify external social accounts (Twitter, Reddit, Mastodon).

### 2.1 The Protocol

The user must have a Keybase account that has **proven ownership** of their GitHub account. The user adds their Keybase username to `profile.json` (or we infer it from `content.links`).

### 2.2 Client Implementation

**Step 1: The Bridge Verification**
We must first prove the Keybase User is the same person as the GitHub User.

1.  Query: `https://keybase.io/_/api/1.0/user/lookup.json?usernames={keybase_user}`.
2.  Search `proofs_summary.all` for an entry where `proof_type === "github"`.
3.  **Validation:** Assert that `nametag` (the GitHub username Keybase verified) **matches** the `repo_owner` (the GitHub username hosting the ForkFlirt profile).

**Step 2: Display Proofs**
If (and only if) Step 1 passes:

1.  Iterate through `proofs_summary.all`.
2.  Filter out the "github" proof (since we already checked it).
3.  Render all other proofs (Twitter, Reddit, DNS, Mastodon) as "Verified Identity" links on the profile card.
