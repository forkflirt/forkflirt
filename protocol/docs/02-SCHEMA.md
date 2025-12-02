# Schema Definition: profile.json

**Version:** 1.4.0
**Status:** Stable

## 1. File Location

To keep the repository clean and support the Monorepo structure, the profile data must reside in the `profile` directory.

- **Path:** `/profile/profile.json`
- **Assets:** `/profile/assets/`

## 2. JSON Data Model

```json
{
  "$schema": "https://forkflirt.org/schema/v1.3.json",
  "meta": {
    "generated_by": "forkflirt-client-web v1.4.0",
    "updated_at": "2025-12-01T14:00:00Z",
    "version": "1.3.0"
  },
  "identity": {
    "display_name": "String (Max 50 chars)",
    "pronouns": "String (e.g., 'they/them')",
    "age": "Integer (Must be 18+)",
    "gender": "String (Free text or Enum)",
    "orientation": "String",
    "location": {
      "city": "String",
      "country_code": "ISO-3166-1 alpha-2 (e.g., 'US')",
      "geo_hash": "String (Optional, 4-char precision)"
    },
    "social": {
      "keybase": "String (username only)",
      "mastodon": "String (e.g., @user@instance.social)",
      "bluesky": "String (e.g., @handle.bsky.social)",
      "twitter": "String (username only)",
      "instagram": "String (username only)",
      "discord": "String (username only)",
      "tiktok": "String  (username only)",
      "linkedin": "String (username or full URL)"
    }
  },
  "details": {
    "height_cm": "Integer (Optional)",
    "body_type": "String",
    "job_title": "String",
    "education": "String",
    "vices": {
      "smoking": "String (never, socially, regularly)",
      "drinking": "String (never, socially, regularly)",
      "drugs": "String (never, socially, regularly)"
    },
    "lifestyle": {
      "diet": "String (e.g., 'vegan', 'omnivore')",
      "kids": "String (e.g., 'wants_kids', 'childfree')",
      "pets": ["cat", "dog"]
    }
  },
  "content": {
    "bio": "String (Markdown supported, Max 2000 chars)",
    "essays": [
      {
        "prompt": "The most private thing I'm willing to admit",
        "answer": "I still use nano instead of vim."
      }
    ],
    "images": [
      {
        "src": "./assets/avatar.jpg",
        "alt": "A photo of me",
        "caption": "Hiking in the Alps"
      }
    ],
    "tags": ["scifi", "rust", "bouldering"],
    "links": [
      {
        "label": "My Blog",
        "url": "https://my-blog.com"
        // ^ The client will attempt DNS/Well-Known verification on these
      }
    ]
  },
  "survey": [
    {
      "question_id": "q_pol_1",
      "answer_choice": "A",
      "importance": "very_important",
      "acceptable_answers": ["A", "B"]
    }
  ],
  "security": {
    "public_key": "PEM Encoded RSA-OAEP Public Key",
    "fingerprint": "SHA-256 Hash of the Public Key",
    "key_type": "RSA-OAEP-2048",
    "signature": "Optional: PGP Signature",
    "profile_signature": "Base64-encoded RSA-PSS signature of the profile content",
    "signature_timestamp": "2025-12-01T14:00:00Z",
    "signature_nonce": "uuid-v4-format-string",
    "key_rotation": {
      "current_key": "PEM-encoded current public key",
      "previous_keys": [
        {
          "public_key": "PEM-encoded previous public key",
          "timestamp": "2025-11-01T14:00:00Z",
          "deactivated": "2025-12-01T14:00:00Z",
          "version": 1
        }
      ],
      "rotation_timestamp": "2025-12-01T14:00:00Z",
      "next_rotation": "2026-03-01T14:00:00Z",
      "rotation_version": 2
    }
  },
  "preferences": {
    "looking_for": ["relationship", "collaboration"],
    "age_range": [25, 35],
    "distance_km": 50,
    "discovery": {
      "allow_caching": true,
      "max_cache_duration": 86400,
      "require_authentication": false
    },
    "match_filter": {
      "include_tags": ["scifi", "rust"],
      "exclude_tags": ["crypto"]
    }
  }
}
```

## 3. Security & Cryptography

### 3.1 Profile Signatures

The `profile_signature` field provides cryptographic proof of profile integrity:

- **Algorithm**: RSA-PSS with SHA-256
- **Purpose**: Proves the profile was created by the private key owner
- **Timestamp**: When the profile was signed (ISO 8601 format)
- **Nonce**: UUID v4 to prevent signature reuse attacks

### 3.2 Key Rotation System

The `key_rotation` object enables forward secrecy and key migration:

#### 3.2.1 Current Key Management
- **current_key**: PEM-encoded public key currently in use
- **rotation_timestamp**: When the current key was activated
- **rotation_version**: Monotonically increasing version number
- **next_rotation**: Optional scheduled date for next rotation

#### 3.2.2 Historical Key Access
- **previous_keys**: Array of deprecated keys for decrypting old messages
- **timestamp**: Key creation timestamp
- **deactivated**: When the key was rotated out
- **version**: Key version for tracking

### 3.3 Input Sanitization

All clients must implement strict input sanitization:

- **HTML Sanitization**: Use DOMPurify with limited allowed tags (p, br, strong, em, u)
- **URL Filtering**: Only allow whitelisted domains (github.com, twitter.com, linkedin.com, mastodon.social, bluesky.app)
- **Query Parameter Removal**: Strip dangerous parameters (redirect, callback, token, key, auth)
- **Field-by-field**: Sanitize all text fields including social media handles

## 4. Discovery & Caching

### 4.1 Discovery Preferences

The `discovery` object provides hints to client behavior:

- **allow_caching**: Request clients not cache long-term (default: true)
- **max_cache_duration**: Suggested TTL in seconds (default: 86400 = 24h)
- **require_authentication**: Request clients only show to authenticated users

### 4.2 Match Filtering

The `match_filter` object enables user-controlled feed filtering:

- **include_tags**: Only show profiles with these tags
- **exclude_tags**: Never show profiles with these tags

## 5. The Ignore File (`.forkflirtignore`)

To facilitate decentralized moderation, a client may generate a `.forkflirtignore` file in the repository **root** (not in `/profile`).

### Syntax

```text
# Block specific users by GitHub username
block: creep_user_1
block: spam_bot_99

# Global Content Filters
filter: tag:crypto
filter: keyword:nft
```

## 6. Validation Rules

### 6.1 Schema Validation
1.  **Required Fields:** `identity`, `security`, and `content` are mandatory.
2.  **Survey Requirements:** Only `question_id` and `answer_choice` are required. `importance` and `acceptable_answers` are optional.
3.  **Age Validation:** Strictly 18+ (minimum: 18).
4.  **Country Codes:** Must be valid ISO-3166-1 alpha-2 format (e.g., "US", "CA").

### 6.2 Content Constraints
1.  **Image Paths:** Must be relative paths pointing to files within the repository (e.g., `./assets/`). External URLs should be blocked by the client to prevent tracking pixels.
2.  **Text Lengths:**
    - `display_name`: Maximum 50 characters
    - `bio`: Maximum 2000 characters
    - Essay answers: Maximum 5000 characters each
3.  **Essay Prompts:** Both `prompt` and `answer` required for each essay.

### 6.3 Input Sanitization Requirements
All clients MUST implement strict input sanitization:
1.  **HTML Sanitization:** Use DOMPurify with allowed tags: p, br, strong, em, u
2.  **URL Security:** Only allow whitelisted domains, strip dangerous query parameters
3.  **Field Sanitization:** Apply to ALL text fields including names, bios, social handles

### 6.4 Survey Logic
- **Importance Values:** `mandatory`, `very_important`, `somewhat_important`, `little_importance`, `irrelevant`
- **Match Calculation:** Based on intersection of `answer_choice` and `acceptable_answers` weighted by `importance`
- **Custom Questions:** Support for `q_custom_*` format

### 6.5 Vices Enumeration
- **Smoking:** `never`, `socially`, `regularly`, `trying_to_quit`
- **Drinking:** `never`, `socially`, `regularly`
- **Drugs:** `never`, `socially`, `regularly`

### 6.6 Cryptographic Validation
1.  **Profile Signatures:** If `profile_signature` is present, verify using RSA-PSS with SHA-256
2.  **Key Rotation:** Validate rotation timestamps are sequential and versions increment
3.  **PGP Signatures:** If `signature` is present, clients MUST fetch the user's Keybase PGP key and verify the signature against `security.public_key`. If verification fails, the profile should be flagged as compromised.

### 6.7 Social Verification
- If `identity.social.keybase` is present, the client SHOULD attempt Keybase verification.
- If `identity.social.mastodon` is present, the client SHOULD attempt Back-link verification.
- For domains in `content.links`, the client SHOULD attempt DNS and Well-Known file verification.
