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
