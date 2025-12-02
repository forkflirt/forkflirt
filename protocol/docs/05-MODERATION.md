# Moderation & Safety Standards

**Status:** Draft 2.0

Since ForkFlirt is peer-to-peer, there is no central admin to ban users. Moderation relies on **Client-Side Filtering**, **Behavioral Analysis**, and **Reputation Signal Files**.

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
# Note: Enhanced with fuzzy matching to detect obfuscated keywords
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

## 2. Enhanced Content Filtering

### 2.1 Fuzzy Keyword Matching

To prevent bypass attempts through obfuscation, clients must implement **fuzzy keyword matching** for all `filter:keyword:` rules:

#### 2.1.1 Text Normalization
Clients must normalize both the filter keywords and user content using:
- Convert to lowercase
- Remove non-alphanumeric characters
- Replace common leet speak patterns (0→o, 1→i, 2→z, 3→e, 4→a, 5→s, 6→g, 7→t, 8→b, 9→p)
- Remove repeated characters (e.g., "llaaame" → "lame")

#### 2.1.2 Obfuscation Pattern Detection
Clients must detect sophisticated obfuscation techniques:
- Character insertion/removal patterns (e.g., "tr*nsf*r")
- Mixed case patterns (e.g., "AlPhAbEt")
- Excessive whitespace
- Random special character insertion
- Multiple suspicious patterns (require ≥2 patterns to avoid false positives)

### 2.2 Behavioral Analysis System

Clients must implement a **behavioral blocking system** that monitors user patterns for abuse detection:

#### 2.2.1 Behavioral Block Types
- **Spam**: Repetitive content, rapid interactions
- **Harassment**: Abusive language patterns, targeted messaging
- **Impersonation**: Identity spoofing attempts
- **Blocklist Bypass**: Attempts to circumvent filtering mechanisms

#### 2.2.2 Temporary Behavioral Blocks
- **Duration**: Configurable (default 7 days)
- **Severity Levels**: Low, Medium, High
- **Expiration**: Automatic cleanup of expired blocks
- **Storage**: Client-side IndexedDB with persistence

#### 2.2.3 Risk Assessment
Clients analyze user behavior using:
- **Content similarity** detection (80% similarity threshold)
- **Interaction frequency** monitoring (>10 interactions/minute = high risk)
- **Pattern analysis** using Levenshtein distance
- **Historical tracking** of last 100 interactions per user

## 3. Client Enforcement Logic

### 3.1 Discovery Phase

When the client fetches the list of `topic:forkflirt-profile` candidates:

1.  **Load Rules:** Fetch and parse the local user's `.forkflirtignore`.
2.  **Resolve Imports:** Recursively fetch any `import:` URLs (Max depth: 2, to prevent loops).
3.  **Apply Static Blocks:** Check candidate usernames against the `block:` list. Drop matches.
4.  **Apply Enhanced Filters:** Check candidate `profile.json` content against `filter:` rules:
    - Use exact matching for tags
    - Use fuzzy matching for keywords with obfuscation detection
    - Check for obfuscation patterns and flag suspicious content
5.  **Apply Behavioral Blocks:** Check if candidate is behaviorally blocked. Drop matches.

### 3.2 Interaction Phase (Incoming Messages)

When the client scans GitHub Issues for "Handshakes":

1.  Extract the username of the Issue creator.
2.  Check against `block:` list.
3.  Check behavioral block status.
4.  **If Blocked (any method):**
    - Do **not** attempt decryption.
    - Use GitHub API to "Close" and "Lock" the issue automatically.
    - Log the interaction for behavioral analysis.

### 3.3 Behavioral Monitoring

Clients must continuously monitor user interactions for abuse patterns:
- **Profile Content**: Analyze bio, tags, and links for obfuscation
- **Message Content**: Check for repetitive or suspicious patterns
- **Interaction Patterns**: Monitor frequency and timing
- **Auto-Block**: Automatically apply temporary blocks for high-risk behavior

## 4. GitHub Native Integration

ForkFlirt clients should respect the host platform's native blocking tools.

- **API Check:** Before rendering a profile, the client should check `GET /users/{username}/blocking` (requires OAuth scope `user:blocking`).
- **Behavior:** If `github.com` says the user is blocked, the ForkFlirt client must enforce the block in the UI.

## 5. Data Storage & Privacy

### 5.1 Behavioral Data Storage
Clients must store behavioral analysis data locally using:
- **IndexedDB**: For persistent client-side storage
- **Storage Keys**: Use namespaced keys like `forkflirt_behavioral_blocks` and `forkflirt_behavioral_analysis_{userId}`
- **Data Retention**: Keep only recent data (last 100 interactions per user)
- **Expiration**: Automatically clean expired behavioral blocks

### 5.2 Privacy Considerations
- **Local Only**: All behavioral data must remain client-side and never be transmitted
- **User Control**: Users should be able to view and clear their behavioral block data
- **Data Minimization**: Store only necessary behavioral patterns, not full content
- **Transparency**: Inform users about behavioral analysis and its purpose

