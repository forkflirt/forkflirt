# Contributing to ForkFlirt

First off, thank you for considering contributing to ForkFlirt. We are building a protocol that emphasizes **Consent**, **Privacy**, and **Ownership**.

## 🤝 Code of Conduct

ForkFlirt is a dating protocol. Safety is paramount.

- **Zero Tolerance:** Harassment logic, "stalker-features," or bypassing blocklists in PRs will result in an immediate ban.
- **Privacy First:** All new features must default to "Private" or "Encrypted."

## 🛠 Development Workflow

1.  **Fork** the repo to your own account.
2.  **Clone** it locally.
3.  **Branch** for your feature: `git checkout -b feature/better-matching`.
4.  **Test** your changes against the Schema Validator.
5.  **Pull Request** to the `main` branch.

## 📝 RFC Process

Major changes to the Protocol (e.g., changing how encryption works or modifying the JSON schema) require an RFC (Request for Comments).

1.  Create a Markdown file in `/docs/rfc/`.
2.  Follow the template in `/docs/rfc/TEMPLATE.md`.
3.  Submit a PR with the label `status: rigorous-debate`.

## 🐛 Reporting Bugs

If you find a security vulnerability (e.g., a way to decrypt messages without a key), **DO NOT OPEN A GITHUB ISSUE.**
Email `security@plugpuppy.com` (or the contact listed in the repo) with your PGP key.
