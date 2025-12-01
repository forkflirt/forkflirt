# Identity Verification

**Status:** Draft 1.4

ForkFlirt relies on **Cross-Platform Verification** to establish trust. Since we do not use a backend server, all verification protocols must be executable by a static browser client.

## Verification Hierarchy

Clients should attempt to verify identity in the following order of preference, based on ease of use and cryptographic strength:

1.  **Keybase** (Strongest, Aggregated)
2.  **Mastodon / Fediverse** (Social Back-link)
3.  **DNS TXT Record** (Domain Ownership)
4.  **Well-Known Resource** (File Upload)

---

## 1. Keybase (Aggregated Identity)

Keybase is the preferred method because it provides a cryptographic chain of trust for multiple identities (Twitter, Reddit, Admin status) simultaneously.

### 1.1 The Protocol

The user must have a Keybase account that has **proven ownership** of their GitHub account via a signed Gist.

### 1.2 Client Implementation

1.  **Fetch:** `GET https://keybase.io/_/api/1.0/user/lookup.json?usernames={keybase_username}`
2.  **Bridge Verification:** Find the object in `proofs_summary.all` where `proof_type === "github"`.
    - **Check:** Does `nametag` (GitHub user verified by Keybase) match `repo_owner` (Current ForkFlirt Profile)?
3.  **Display:** If matched, the Client should display **all** other valid proofs returned in the summary (e.g., "Verified on Twitter via Keybase").

---

## 2. Mastodon (Social Back-Link)

For users on the Fediverse. This relies on the "rel=me" concept but implemented via API inspection.

### 2.1 The Protocol

1.  The user adds their ForkFlirt Repository URL (e.g., `https://github.com/alice/forkflirt`) to their Mastodon **Bio** or **Metadata Fields**.
2.  The user adds their Mastodon handle (e.g., `@alice@hachyderm.io`) to `profile.json`.

### 2.2 Client Implementation

1.  **Parse Handle:** Split `@user@instance.social` to extract domain and username.
2.  **Fetch:** `GET https://{instance.social}/api/v1/accounts/lookup?acct={user}`
3.  **Scan:** Check the `note` (Bio HTML) and `fields` array.
4.  **Validate:** Look for the **exact string** of the ForkFlirt repository URL.
5.  **Result:** If found, display "Verified Mastodon".

---

## 3. Domain Verification (DNS TXT)

For users who own a domain but do not have a web server configured for CORS.

### 3.1 The Protocol

The user creates a **TXT Record** on their domain:
`forkflirt-verify=<github_username>`

### 3.2 Client Implementation

Use **Google Public DNS (JSON API)** to avoid CORS issues.

1.  **Fetch:** `GET https://dns.google/resolve?name={domain}&type=TXT`
2.  **Iterate:** Scan **ALL** items in the `Answer` array.
3.  **Check:** Look for the string `forkflirt-verify={current_github_user}`.
4.  **Result:** If found, display "Domain Verified".

---

## 4. Well-Known Resource (File Upload)

For users who prefer uploading a file to their server.

### 4.1 The Protocol

The user hosts a JSON file at:
`https://{domain}/.well-known/forkflirt.json`

**File Content:**

```json
{
  "forkflirt_verify": "github_username",
  "comment": "Optional: Verified via ForkFlirt Protocol"
}
```

### 4.2 CORS Requirement (CRITICAL)

Because verification happens in the user's browser, the web server hosting this file **MUST** send the following HTTP Header:

`Access-Control-Allow-Origin: *`

### 4.3 Client Implementation

1.  **Fetch:** `GET https://{domain}/.well-known/forkflirt.json`
2.  **Error Handling:** If the fetch fails with a Network Error, assume CORS is blocking it and display a specific warning to the user.
3.  **Validate:** Parse JSON and check if `forkflirt_verify` matches the repo owner.
