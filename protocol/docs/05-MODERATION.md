# Moderation & Safety Standards

**Status:** Draft 1.0

Since ForkFlirt is peer-to-peer, there is no central admin to ban users. Moderation relies on **Client-Side Filtering** and **Reputation Signal Files**.

## 1. The Ignore File (`.forkflirtignore`)

Every user can publish a `.forkflirtignore` file in the root of their repository. This file acts as a firewall rule set for their ForkFlirt client.

### 1.1 File Location

`https://github.com/<username>/<repo>/blob/main/.forkflirtignore`

### 1.2 Syntax Specification

The parser must support the following directives. Lines starting with `#` are comments.

```text
# --------------------------------------------------------
# 1. USER BLOCKING
# --------------------------------------------------------
# Syntax: block: <github_username>
# Behavior:
# - Remove user from Discovery Feed.
# - Auto-close any Issues they open on your repo.
# - Do not render their profile if visited directly.

block: creep_user_01
block: spam_bot_x99

# --------------------------------------------------------
# 2. CONTENT FILTERING
# --------------------------------------------------------
# Syntax: filter: <scope>:<value>
# Behavior:
# - Calculate if a profile matches these rules.
# - If match, hide from Feed (Silent Filter).

# Filter by Tag (Exact Match)
filter: tag:crypto
filter: tag:hookup

# Filter by Bio Keyword (Case Insensitive Partial Match)
filter: keyword:nft
filter: keyword:"alpha male"

# --------------------------------------------------------
# 3. IMPORTS (Shared Blocklists)
# --------------------------------------------------------
# Syntax: import: <url_to_raw_text_file>
# Behavior:
# - Fetch the external file.
# - Merge its rules into the local rules.
# - This allows communities to maintain shared ban lists.

import: https://raw.githubusercontent.com/forkflirt/community-safety/main/known-bad-actors.txt
```

## 2. Client Enforcement Logic

### 2.1 Discovery Phase

When the client fetches the list of `topic:forkflirt-profile` candidates:

1.  **Load Rules:** Fetch and parse the local user's `.forkflirtignore`.
2.  **Resolve Imports:** Recursively fetch any `import:` URLs (Max depth: 2, to prevent loops).
3.  **Apply Blocks:** Check candidate usernames against the `block:` list. Drop matches.
4.  **Apply Filters:** Check candidate `profile.json` content against `filter:` rules. Drop matches.

### 2.2 Interaction Phase (Incoming Messages)

When the client scans GitHub Issues for "Handshakes":

1.  Extract the username of the Issue creator.
2.  Check against `block:` list.
3.  **If Blocked:**
    - Do **not** attempt decryption.
    - (Optional) Use GitHub API to "Close" and "Lock" the issue automatically.

## 3. GitHub Native Integration

ForkFlirt clients should respect the host platform's native blocking tools.

- **API Check:** Before rendering a profile, the client should check `GET /users/{username}/blocking` (requires OAuth scope `user:blocking`).
- **Behavior:** If `github.com` says the user is blocked, the ForkFlirt client must enforce the block in the UI.

````

---

And here is **`docs/06-VERIFICATION.md`**.

This covers the "Green Squares" logic and the "Identity Proofs" (Keybase, etc.) that we discussed in the very beginning but haven't documented yet.

```markdown
# Identity Verification & Trust Signals

**Status:** Draft 1.0

In a decentralized system, "Real Human" verification is difficult. We utilize **Proof of Work** (GitHub Activity) and **Proof of Identity** (Cross-linking) to establish trust.

## 1. The "Green Squares" (Activity Proof)

To filter out bots and empty shell accounts, clients should calculate an **Activity Score**.

### 1.1 Data Source
Fetch the user's contribution graph or public event history:
`GET /users/{username}/events/public`

### 1.2 Scoring Logic (Client-Side)
Clients should display a badge or indicator based on the following heuristics:

*   **Ghost 👻:** Account created < 30 days ago OR 0 commits in last year. (High Risk)
*   **Lurker 👤:** Account > 1 year old, but low activity. (Medium Risk)
*   **Builder 🛠️:** Consistent commit history over 6+ months. (Low Risk)
*   **Veteran 🔥:** Account > 5 years old, high contribution density. (Verified Nerd)

*Note: This is not a moral judgment, but a "Catfish Filter." A distinct lack of code history on a code-based dating platform is a red flag.*

## 2. Cross-Verification (Identity Proofs)

Users can prove they own other online identities by adding links in their `profile.json` (`content.links`).

### 2.1 Keybase / GPG
If a user lists a Keybase profile or GPG key:
1.  **Client Action:** Fetch the external proof.
2.  **Validation:** Verify the GPG key in the repo matches the GPG key on the external profile.
3.  **UI:** Display a "Cryptographically Verified" checkmark.

### 2.2 Domain Ownership (DNS)
If a user links a personal website (`https://alice.com`):
1.  **Client Action:** Fetch `https://alice.com`.
2.  **Validation:** Search for a backlink to the GitHub profile or a `<meta name="forkflirt-owner" content="github_username" />` tag.
3.  **UI:** Display "Domain Verified".

## 3. The "Verified Organization" Badge

If a profile repository resides within a GitHub Organization (e.g., `github.com/microsoft/dating-profile` - unlikely, but possible), the client inherits the "Verified" status of the Organization from GitHub's native verification system.
````
