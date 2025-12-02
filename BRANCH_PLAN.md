# ForkFlirt Security Improvements - Implementation Plan

## Executive Summary

Based on analysis of the existing codebase and Sonnet's complete security review, this plan implements **16 major security improvements** organized into 3 phases, with special attention to automated warrant canary implementation and inclusive security language. **Web3 verification has been removed per requirements.**

## Current Security Implementation Status

### ✅ Already Implemented (Excellent Foundation)
1. **Enhanced Rate Limiting**: Robust rate limiting with exponential backoff (`client/src/lib/api/auth.ts`)
2. **CAPTCHA System**: Math-based CAPTCHA with attempt tracking
3. **CSRF Protection**: Token-based CSRF protection for sensitive operations
4. **Enhanced Key Management**: Passphrase-protected keys with PBKDF2 (600k iterations)
5. **Token Security**: Format validation, source detection, and rotation tracking
6. **Secure Error Handling**: Security-focused error handling preventing information leakage
7. **Moderation System**: User-controlled blocklist with keyword/tag filtering
8. **Secure Cipher Implementation**: Rate-limited decryption with proper error handling

### 🔄 Partially Implemented (Needs Enhancement)
1. **Passphrase Memory Management**: Needs memory clearing and timing attack protection
2. **Session Management**: Needs comprehensive session clearing
3. **Location Privacy**: Needs privacy documentation

### ❌ Missing Critical Features
1. **Automated Warrant Canary System** (NEW ADDITION)
2. **Enhanced Visual CAPTCHA**: Replace simple math with visual version
3. **Profile Signature Verification**: Cryptographic binding of profile data
4. **Behavioral Blocking**: Enhanced blocklist with fuzzy matching
5. **Panic Button**: Emergency data deletion
6. **Comprehensive Security Documentation**
7. **Content Security Policy Hardening**
8. **Profile Caching with Privacy Hints**
9. **Enhanced Metadata Protection**: Padding to prevent traffic analysis

## Detailed Implementation Plan

### Phase 1: Critical User Safety Features (Priority: CRITICAL)

#### 1.1 Enhanced Passphrase Memory Management & Timing Attack Protection
**Files to Modify**: `client/src/routes/wizard/+page.svelte`, `client/src/lib/crypto/keys.ts`
- Clear passphrases from memory immediately after use
- Add garbage collection hints with `window.gc()` check
- Implement constant-time operations for passphrase verification to prevent timing attacks
- Ensure passphrases are cleared even on error scenarios
- Add minimum processing delays to normalize operation timing

#### 1.2 Panic Button Implementation
**Files to Create**: `client/src/lib/api/panic.ts`
```typescript
export async function triggerPanicMode(): Promise<void> {
  // 1. Delete all cryptographic keys using existing deleteIdentity()
  // 2. Clear all browser storage (localStorage, sessionStorage, IndexedDB)
  // 3. Clear all cookies including domain-specific
  // 4. Clear all IndexedDB databases completely
  // 5. Redirect to innocuous site (Wikipedia.org)
}
```

**Files to Modify**: `client/src/routes/+layout.svelte`
- Add panic button to settings menu with confirmation dialog
- Style as emergency button with clear labeling

#### 1.3 Enhanced Session Fixation Protection
**Files to Modify**: `client/src/lib/api/auth.ts`
- Improve `logout()` function to clear all session data comprehensively
- Add hard reload `window.location.href = '/'` to clear in-memory state
- Clear rate limiting data, CSRF tokens, and captcha data on logout
- Ensure complete session invalidation across all storage mechanisms

### Phase 2: Enhanced Security & Verification Features (Priority: HIGH)

#### 2.1 Visual CAPTCHA System
**Files to Modify**: `client/src/lib/components/ui/CaptchaModal.svelte`
- Replace simple math CAPTCHA with canvas-based visual CAPTCHA
- Implement:
  - Random background colors and noise lines
  - Character rotation and distortion
  - Multiple fonts with random selection
  - Character spacing variations
- Maintain accessibility with refresh option and keyboard input

#### 2.2 Profile Signature Verification
**Files to Create**: `client/src/lib/crypto/profile-signature.ts`
```typescript
export interface ProfileSignature {
  profile_signature: string; // base64-encoded RSA-PSS signature
  signature_timestamp: string; // ISO timestamp for replay protection
  signature_nonce: string; // random nonce for uniqueness
}

export async function signProfile(profile: Profile, privateKey: CryptoKey): Promise<ProfileSignature>
export async function verifyProfileSignature(profile: Profile, publicKey: CryptoKey): Promise<boolean>
```

**Files to Modify**: `protocol/schemas/profile.schema.json`
- Add signature fields to security section
- Make signature optional during transition but mark as required in v2.0

#### 2.3 Behavioral Blocking with Fuzzy Matching
**Files to Create**: `client/src/lib/logic/behavioral-blocking.ts`
```typescript
// Fuzzy matching to prevent keyword obfuscation bypass
function fuzzyKeywordMatch(text: string, keyword: string): boolean {
  // Remove common obfuscation: l33t speak, extra spaces, etc.
  const normalize = (s: string) => s
    .toLowerCase()
    .replace(/[^\w]/g, '')
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e')
    .replace(/4/g, 'a').replace(/5/g, 's').replace(/7/g, 't');

  return normalize(text).includes(normalize(keyword));
}

// Behavioral pattern detection
export class BehavioralBlockList {
  async addBehavioralBlock(userId: string, reason: string, durationMs: number): Promise<void>
  async isBlocked(userId: string): Promise<boolean>
}
```

**Files to Modify**: `client/src/lib/logic/moderation.ts`
- Integrate fuzzy matching with existing keyword filtering
- Add behavioral blocking that persists across sessions

#### 2.4 Enhanced Metadata Protection
**Files to Modify**: `client/src/lib/crypto/cipher.ts`
- Add random padding to encrypted metadata to normalize sizes
- Implement metadata versioning for future compatibility
- Add metadata integrity checks

### Phase 3: Infrastructure & Documentation Features (Priority: MEDIUM)

#### 3.1 Automated Warrant Canary System (NEW ADDITION)
**Files to Create**: `.github/workflows/warrant-canary.yml`
```yaml
name: Update Warrant Canary

on:
  schedule:
    # Run on the 1st of every month at 00:00 UTC
    - cron: '0 0 1 * *'
  workflow_dispatch:  # Allow manual updates

jobs:
  update-canary:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Update canary timestamp
        run: |
          # Update timestamp in README.md
          sed -i "s/Last updated: [0-9-]*/Last updated: $(date +'%Y-%m-%d')/" README.md

      - name: Commit and push changes
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "chore: Update warrant canary - $(date +'%Y-%m-%d')"
          file_pattern: 'README.md'
```

**Files to Modify**: `README.md`
```markdown
## Transparency & Safety

### Warrant Canary

As of **December 1, 2025**:
- Plug Puppy LLC has not received any National Security Letters
- Plug Puppy LLC has not received any gag orders
- Plug Puppy LLC has not been compelled to modify the ForkFlirt codebase
- Plug Puppy LLC has not been required to hand over user data

This canary is automatically updated monthly. If this section is removed or not updated for 60 days, assume compromise.

**Last updated**: December 1, 2025
**Update method**: Automated GitHub Actions (`.github/workflows/warrant-canary.yml`)

*Administrators: Disable this workflow in GitHub repository settings if compelled by legal process.*
```

#### 3.2 Profile Caching with Privacy Hints
**Files to Modify**: `client/src/lib/api/github.ts`
- Implement comprehensive profile caching system
- Add TTL management (default 24 hours, configurable per profile)
- Implement cache size limits (500 profiles max)
- Respect user privacy preferences for caching behavior

**Files to Modify**: `protocol/schemas/profile.schema.json`
```json
{
  "preferences": {
    "discovery": {
      "allow_caching": {
        "type": "boolean",
        "default": true,
        "description": "Hint: request clients not cache this profile long-term"
      },
      "max_cache_duration": {
        "type": "integer",
        "description": "Suggested cache TTL in seconds (default 86400 = 24h)"
      }
    }
  }
}
```

#### 3.3 Security Documentation Creation
**Files to Create**: `SECURITY.md`
```markdown
# Security Policy

## For Privacy-Conscious Users

### Emergency Data Deletion
1. **Use the Panic Button**: Settings → Emergency Exit (instantly deletes all local data)
2. **Anonymous Browsing**: Consider using Tor Browser for additional anonymity
3. **Location Privacy**: Use nearby cities instead of exact location
4. **Separate Identity**: Create a dedicated GitHub account for ForkFlirt
5. **Report Issues**: security@plugpuppy.com (PGP key available)

### Location Privacy Guidelines
While ForkFlirt requires a city for matching, privacy-conscious users may consider:
- Using a nearby city (within 30-50km) instead of exact location
- Using larger cities in metro area
- Remembering that all location-based services involve privacy tradeoffs

## For Security Researchers

### Responsible Disclosure
1. Email security@plugpuppy.com with vulnerability details
2. Do NOT publicly disclose before we've patched
3. Do NOT access user data without permission
4. Do NOT perform denial-of-service attacks

### Scope
In scope: XSS, CSRF, injection attacks, authentication bypasses, cryptographic vulnerabilities, privacy leaks
Out of scope: Social engineering, physical attacks, third-party service vulnerabilities

## Security Architecture

### Protections
- End-to-end encryption (RSA-OAEP + AES-GCM)
- Passphrase-protected private keys
- Replay attack prevention
- Rate limiting with exponential backoff
- Input sanitization with DOMPurify
- CSRF protection
- Content Security Policy

### Known Limitations
1. **Metadata Leakage**: GitHub Issues are public, revealing interaction graph
2. **No Forward Secrecy**: Compromised keys expose historical messages
3. **Client-Side Security**: Security depends on browser integrity
4. **Social Graph Analysis**: Connections are visible on GitHub

## Threat Model

### We Protect Against
- Mass scraping
- Profile impersonation
- Message interception
- Replay attacks
- CSRF attacks
- XSS attacks
- Location tracking
- Behavioral profiling

### We Cannot Fully Protect Against
- Targeted state-level surveillance
- Compromised browser/OS
- Rubber-hose cryptanalysis
- Social engineering
```

#### 3.4 Enhanced Content Security Policy
**Files to Modify**: `client/src/routes/+layout.svelte`
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'none';
  script-src 'self';
  style-src 'self';
  img-src 'self' data: https://raw.githubusercontent.com https://placehold.co;
  connect-src 'self' https://api.github.com https://raw.githubusercontent.com https://keybase.io https://dns.google;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
  block-all-mixed-content;
">
```

#### 3.5 Profile View Rate Limiting
**Files to Create**: `client/src/lib/stores/view-tracking.ts`
```typescript
interface ProfileView {
  profileId: string;
  timestamp: number;
}

const MAX_VIEWS_PER_HOUR = 50;

export async function canViewProfile(profileId: string): Promise<boolean> {
  // Track views and prevent excessive profile viewing
  // Clean old views and enforce rate limits
}
```

#### 3.6 README Privacy Section Updates
**Files to Modify**: `README.md`
```markdown
## Privacy & Security

ForkFlirt is built on public GitHub repositories, which provides decentralization and data ownership but comes with inherent tradeoffs:

### What's Private
- ✅ Message content (end-to-end encrypted)
- ✅ Private keys (never leave your device)
- ✅ Passphrase (never stored, only used for key derivation)

### What's Public
- ⚠️ Profile data (stored in public GitHub repo)
- ⚠️ Profile existence (discoverable via GitHub search)
- ⚠️ Interaction metadata (who creates Issues on whose repo)
- ⚠️ GitHub contribution graph

### Privacy Best Practices
- Use a dedicated GitHub account for ForkFlirt
- Consider using approximate locations instead of exact city
- Keep profile information minimal and non-specific
- Use blocklists to control interactions
- Regularly review who can see your profile
- Enable the panic button in settings for emergency data deletion

For detailed security information, see [SECURITY.md](./SECURITY.md)
```

## Implementation Strategy & Technical Details

### Security Principles
1. **Defense in Depth**: Multiple overlapping security controls
2. **Fail Safe**: Error conditions default to secure behavior
3. **Least Privilege**: Minimal access and data exposure
4. **Privacy by Design**: User privacy controls built-in, not bolted on
5. **Inclusive Security**: Generic language applying to all users equally

### Canary System Design
- **Monthly Updates**: Automated GitHub Actions run on 1st of each month
- **Manual Override**: Workflow can be manually triggered or disabled in repo settings
- **Clear Instructions**: README includes explicit instructions for administrators
- **Failure Detection**: 60-day failure threshold indicates potential compromise

### Architecture Tradeoffs (Transparent Communication)
- **Public Nature**: GitHub repositories mean profile discoverability is inherent
- **Focus on Protectable Data**: Emphasize protecting messages, keys, and private data
- **Honest Limitations**: Clear communication about what cannot be fully protected
- **Cache Hints**: "Good citizen" suggestions, not enforceable restrictions

### Testing Strategy
1. **Security Testing**: Verify timing attacks mitigated, memory properly cleared
2. **Usability Testing**: Ensure panic button accessible but not accidentally triggerable
3. **Performance Testing**: CAPTCHA and signatures don't impact user experience
4. **Privacy Testing**: Verify data deletion is comprehensive and irreversible
5. **Canary Testing**: Verify automated updates work correctly

### Deployment Plan
1. **Branch Strategy**: All changes in `security-improvements` branch
2. **Code Review**: Security-focused review for all changes
3. **Testing**: Comprehensive testing including attack scenarios
4. **Documentation**: Update all relevant docs before merge
5. **Canary Setup**: Configure automated canary workflow before merge

---

## Execution Status: IN PROGRESS

This plan includes **all 16 security recommendations** from Sonnet's original review (minus Web3 verification), plus the automated warrant canary system. The plan maintains ForkFlirt's decentralized architecture while providing comprehensive security improvements with inclusive, generic language that protects all users without creating targeted identifiers.