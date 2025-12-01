Here is the updated **`protocol/docs/02-SCHEMA.md`** with the expanded `social` object to include common platforms (Bluesky, Discord, Instagram, etc.).

````markdown
# Schema Definition: profile.json

**Version:** 1.3.0
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
    "signature": "Optional: PGP Signature"
  },
  "preferences": {
    "looking_for": ["relationship", "collaboration"],
    "age_range": [25, 35],
    "distance_km": 50
  }
}
```
````

## 3. The Ignore File (`.forkflirtignore`)

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

## 4. Validation Rules

1.  **Image Paths:** Must be relative paths pointing to files within the repository (e.g., `./assets/`). External URLs should be blocked by the client to prevent tracking pixels.
2.  **Bio Markdown:** Clients must sanitize HTML to prevent script injection (XSS).
3.  **Survey Logic:**
    - `importance` must be one of: `mandatory`, `very_important`, `somewhat_important`, `little_importance`, `irrelevant`.
    - Clients calculate match percentages based on the intersection of `answer_choice` and `acceptable_answers` weighted by `importance`.
4.  **Age:** Strictly 18+.
5.  **Signatures:** If `security.signature` is present, clients MUST fetch the user's Keybase PGP key and verify the signature against `security.public_key`. If verification fails, the profile should be flagged as compromised.
6.  **Social Verification:**
    - If `identity.social.keybase` is present, the client SHOULD attempt Keybase verification.
    - If `identity.social.mastodon` is present, the client SHOULD attempt Back-link verification.
    - For domains in `content.links`, the client SHOULD attempt DNS and Well-Known file verification.
