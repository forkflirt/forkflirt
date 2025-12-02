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
- Passphrase-protected private keys with PBKDF2 (600k iterations)
- Replay attack prevention with secure storage
- Rate limiting with exponential backoff
- Input sanitization with DOMPurify
- CSRF protection with token-based validation
- Content Security Policy
- Profile signature verification with RSA-PSS
- Behavioral blocking with fuzzy keyword matching
- Metadata padding to prevent traffic analysis
- Panic button for emergency data deletion

### Known Limitations
1. **Metadata Leakage**: GitHub Issues are public, revealing interaction graph
2. **No Forward Secrecy**: Compromised keys expose historical messages
3. **Client-Side Security**: Security depends on browser integrity
4. **Social Graph Analysis**: Connections are visible on GitHub
5. **Profile Discovery**: Public repositories can be found via GitHub search

## Threat Model

### We Protect Against
- Mass scraping and automated data collection
- Profile impersonation and cloning attacks
- Message interception and tampering
- Replay attacks on messages
- CSRF attacks on state-changing operations
- XSS attacks through input sanitization
- Location tracking through approximate location requirements
- Behavioral profiling through rate limiting and monitoring
- Blocklist bypass through fuzzy matching
- Traffic analysis through metadata padding

### We Cannot Fully Protect Against
- Targeted state-level surveillance
- Compromised browser/operating system
- Rubber-hose cryptanalysis (coercion)
- Social engineering attacks
- GitHub infrastructure outages or compromises
- Legal compelled disclosure (see warrant canary)

## Security Features Detail

### Cryptography
- **Key Generation**: RSA-OAEP-2048 with PBKDF2 key derivation (600,000 iterations)
- **Message Encryption**: AES-GCM with RSA-OAEP key wrapping
- **Profile Signatures**: RSA-PSS with 32-byte salt for integrity
- **Replay Protection**: Secure storage with integrity checking

### Authentication & Session Security
- **Rate Limiting**: Exponential backoff for failed attempts
- **CAPTCHA**: Visual canvas-based challenges with noise generation
- **Session Management**: Complete session invalidation on logout
- **Timing Attack Protection**: Constant-time operations for sensitive comparisons

### Privacy & Anonymity
- **Memory Management**: Immediate clearing of sensitive data from memory
- **Traffic Analysis Prevention**: Metadata padding and size normalization
- **Profile Caching**: Respects user privacy hints and TTL preferences
- **Emergency Controls**: Panic button for instant data deletion

### Content Security
- **Input Validation**: Comprehensive schema validation with AJV
- **Output Sanitization**: DOMPurify for all user-generated content
- **Content Security Policy**: Restrictive headers prevent XSS and data exfiltration

## Security Updates

Security updates are published:
- **Critical**: Within 24 hours
- **High**: Within 7 days
- **Medium/Low**: Next release cycle

Subscribe to security announcements: GitHub Watch → Custom → Security alerts

## Contact

For security-related inquiries:
- Email: security@plugpuppy.com
- PGP Key: Available upon request
- Security Issues: Please use the responsible disclosure process above

---

*This document is part of ForkFlirt's commitment to transparency and user security.*