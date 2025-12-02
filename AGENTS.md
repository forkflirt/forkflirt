# ForkFlirt Development Guide

## Commands

### Client (SvelteKit)

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run check` - Run Svelte type checking
- `npm run check:watch` - Run type checking in watch mode

### Protocol

- `npm run test:schema` - Validate JSON schemas
- `npm run lint` - Run ESLint

## Code Style

### General

- TypeScript throughout with strict type checking
- Use ES6+ imports/exports, no CommonJS
- Follow existing naming conventions (camelCase for variables, PascalCase for types/components)

### Svelte Specific

- Use `<script lang="ts">` for TypeScript
- Export props with `export let`
- Use Svelte stores (`writable`, `derived`) for state management
- Prefer event dispatchers over direct callbacks

### Imports

- Group imports: external libs first, then internal modules
- Use absolute imports from `src/lib/` where possible
- Import types with `type` keyword when only using types

### Error Handling

- Use try/catch for async operations
- Update stores with error states
- Log errors with context but don't expose internals to users

### Security

- Never commit secrets or API keys
- Use Web Crypto API for encryption operations
- Validate all external data with schemas

### NO SHORTCUTS POLICY

- NEVER use shortcuts to make tests pass or errors go away
- Fix root causes properly, not symptoms
- Implement correct TypeScript types, not type assertions
- Fix actual logic issues, not remove unused code
- Build working foundation, not hack around problems
