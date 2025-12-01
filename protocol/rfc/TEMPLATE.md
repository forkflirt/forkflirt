# RFC-000: [Title of Proposal]

- **Status:** Draft / Review / Accepted / Rejected
- **Author:** [Your GitHub Username]
- **Created:** [YYYY-MM-DD]
- **Updated:** [YYYY-MM-DD]

## 1. Abstract

A short summary (2-3 sentences) of what this proposal changes or adds to the ForkFlirt protocol.

## 2. Motivation

Why do we need this?

- Is the current schema lacking a specific field?
- Is there a security vulnerability?
- Is this a feature requested by the community (e.g., "Voice Notes")?

## 3. Specification

Describe the technical changes in detail.

### 3.1 Schema Changes

If modifying `profile.json`, provide the diff:

```diff
  "preferences": {
+   "allow_pings": boolean,
    "looking_for": [...]
  }
```

### 3.2 Protocol Logic

If changing how the client behaves (e.g., matching logic or encryption):

1.  Step 1...
2.  Step 2...

## 4. Backwards Compatibility

- Does this break existing profiles?
- Does this break old clients (v1.0)?
- How will we handle the migration? (e.g., "Old clients will simply ignore the new field.")

## 5. Security Implications

- Does this expose more user data?
- Does this introduce new attack vectors (e.g., XSS in a new text field)?
- How is this mitigated?

## 6. Drawbacks / Alternatives

- Why might we _not_ want to do this?
- What other solutions were considered?
