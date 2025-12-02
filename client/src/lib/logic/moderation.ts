import type { Profile } from "../schemas/validator";
import { fuzzyKeywordMatch, detectObfuscationPatterns, behavioralBlockList } from "./behavioral-blocking";

// --- Types ---

export interface BlockRules {
  blockedUsers: Set<string>; // block:username
  filteredTags: Set<string>; // filter:tag:crypto
  filteredKeywords: string[]; // filter:keyword:nft
  imports: string[]; // import:url
}

// --- Parsing Logic ---

/**
 * Parses a raw .forkflirtignore string into a structured Rules object.
 */
export function parseIgnoreFile(text: string): BlockRules {
  const rules: BlockRules = {
    blockedUsers: new Set(),
    filteredTags: new Set(),
    filteredKeywords: [],
    imports: [],
  };

  const lines = text.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (trimmed.startsWith("block:")) {
      const user = trimmed.replace("block:", "").trim().toLowerCase();
      if (user) rules.blockedUsers.add(user);
    } else if (trimmed.startsWith("filter:tag:")) {
      const tag = trimmed.replace("filter:tag:", "").trim().toLowerCase();
      if (tag) rules.filteredTags.add(tag);
    } else if (trimmed.startsWith("filter:keyword:")) {
      const kw = trimmed.replace("filter:keyword:", "").trim().toLowerCase();
      // Remove quotes if present
      const cleanKw = kw.replace(/^"|"$/g, "");
      if (cleanKw) rules.filteredKeywords.push(cleanKw);
    } else if (trimmed.startsWith("import:")) {
      const url = trimmed.replace("import:", "").trim();
      if (url.startsWith("http")) rules.imports.push(url);
    }
  }

  return rules;
}

// --- Resolution (Imports) ---

/**
 * Recursively fetches imported blocklists.
 * Max depth = 2 to prevent infinite loops/hanging.
 */
export async function resolveRules(initialText: string): Promise<BlockRules> {
  // 1. Parse local file
  const rootRules = parseIgnoreFile(initialText);

  // 2. Resolve imports
  // We combine everything into the root ruleset
  await processImports(rootRules, 0);

  return rootRules;
}

async function processImports(rules: BlockRules, depth: number) {
  if (depth > 2 || rules.imports.length === 0) return;

  const currentImports = [...rules.imports];
  rules.imports = []; // Clear queue to avoid re-processing

  const fetchPromises = currentImports.map(async (url) => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.text();
    } catch (e) {
      console.warn(`Failed to import blocklist: ${url}`, e);
      return null;
    }
  });

  const results = await Promise.all(fetchPromises);

  for (const text of results) {
    if (!text) continue;
    const importedRules = parseIgnoreFile(text);

    // Merge
    importedRules.blockedUsers.forEach((u) => rules.blockedUsers.add(u));
    importedRules.filteredTags.forEach((t) => rules.filteredTags.add(t));
    rules.filteredKeywords.push(...importedRules.filteredKeywords);

    // Recurse (if new imports found)
    if (importedRules.imports.length > 0) {
      // Add to queue for next depth pass, technically we could recurse here but
      // flattening the logic in one object is easier
      await processImports(importedRules, depth + 1);

      // Merge grandchildren
      importedRules.blockedUsers.forEach((u) => rules.blockedUsers.add(u));
      importedRules.filteredTags.forEach((t) => rules.filteredTags.add(t));
      rules.filteredKeywords.push(...importedRules.filteredKeywords);
    }
  }
}

// --- Enforcement ---

/**
 * Checks if a profile should be hidden based on the rules.
 */
export async function isBlocked(
  candidateProfile: Profile,
  candidateUsername: string,
  rules: BlockRules
): Promise<boolean> {
  // 1. User Block
  if (rules.blockedUsers.has(candidateUsername.toLowerCase())) {
    return true;
  }

  // 2. Tag Filter
  if (candidateProfile.content.tags) {
    for (const tag of candidateProfile.content.tags) {
      if (rules.filteredTags.has(tag.toLowerCase())) {
        return true;
      }
    }
  }

  // 3. Enhanced Keyword Filter (Bio check with fuzzy matching)
  if (candidateProfile.content.bio) {
    const bio = candidateProfile.content.bio;

    // Check for obfuscation patterns first
    if (detectObfuscationPatterns(bio)) {
      // Flag for potential blocklist bypass attempt
      console.warn(`Obfuscation detected in bio for ${candidateUsername}`);
      // Don't block immediately, but could be used for behavioral analysis
    }

    // Use fuzzy matching to detect obfuscated keywords
    for (const kw of rules.filteredKeywords) {
      if (fuzzyKeywordMatch(bio, kw)) {
        console.log(`Blocked keyword detected via fuzzy matching: "${kw}" in ${candidateUsername}'s bio`);
        return true;
      }
    }

    // Fallback to exact match for backward compatibility
    const bioLower = bio.toLowerCase();
    for (const kw of rules.filteredKeywords) {
      if (bioLower.includes(kw)) {
        return true;
      }
    }
  }

  // 4. Behavioral Blocking Check
  if (await behavioralBlockList.isBlocked(candidateUsername)) {
    console.log(`User ${candidateUsername} is behaviorally blocked`);
    return true;
  }

  return false;
}
