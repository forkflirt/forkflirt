import { Octokit } from "@octokit/rest";
import { validateProfile } from "../schemas/validator";
import type { Profile } from "../schemas/validator"; // Inferred type from JSON schema if you setup types generation, else 'any'
import { get, set, del } from "idb-keyval";

// --- Types ---

export interface SearchResult {
  username: string;
  repo: string;
  avatar_url: string;
  description: string;
  pushed_at: string;
}

export interface CommitFileParams {
  path: string;
  content: string; // Base64 for images, String for text
  message: string;
  encoding?: "utf-8" | "base64";
}

// --- State ---

let octokit: Octokit | null = null;

// --- Profile Cache Management ---

const PROFILE_CACHE_KEY = 'forkflirt_profile_cache_v1';
const MAX_CACHE_SIZE = 500;

interface CachedProfile {
  profile: Profile;
  username: string;
  repo: string;
  cachedAt: number;
  expiresAt: number;
}

export async function getCachedProfile(
  username: string,
  repo: string
): Promise<Profile | null> {
  const cache: CachedProfile[] = await get(PROFILE_CACHE_KEY) || [];

  const cached = cache.find(c =>
    c.username === username &&
    c.repo === repo &&
    Date.now() < c.expiresAt
  );

  if (cached) {
    console.debug(`Using cached profile for ${username}`);
    return cached.profile;
  }

  return null;
}

export async function cacheProfile(
  profile: Profile,
  username: string,
  repo: string
): Promise<void> {
  // Respect cache hints (but don't enforce - it's public data anyway)
  const allowCaching = (profile.preferences as any)?.discovery?.allow_caching ?? true;

  if (!allowCaching) {
    console.debug(`Profile ${username} requests no caching - using short TTL`);
  }

  const ttl = allowCaching
    ? (((profile.preferences as any)?.discovery?.max_cache_duration ?? 86400) * 1000)
    : (5 * 60 * 1000); // 5 minutes minimum for requested no-cache

  const cache: CachedProfile[] = await get(PROFILE_CACHE_KEY) || [];

  // Remove old entry if exists
  const filtered = cache.filter(c => !(c.username === username && c.repo === repo));

  // Add new entry
  filtered.push({
    profile,
    username,
    repo,
    cachedAt: Date.now(),
    expiresAt: Date.now() + ttl
  });

  // Keep only last MAX_CACHE_SIZE profiles (memory management)
  const sorted = filtered.sort((a, b) => b.cachedAt - a.cachedAt);
  const limited = sorted.slice(0, MAX_CACHE_SIZE);

  await set(PROFILE_CACHE_KEY, limited);
}

export async function cleanExpiredProfiles(): Promise<void> {
  const cache: CachedProfile[] = await get(PROFILE_CACHE_KEY) || [];
  const now = Date.now();
  const valid = cache.filter(c => c.expiresAt > now);
  await set(PROFILE_CACHE_KEY, valid);
}

export async function clearProfileCache(): Promise<void> {
  await del(PROFILE_CACHE_KEY);
  console.log('Profile cache cleared');
}

// --- Initialization ---

/**
 * Initialize Octokit with a token (Owner Mode) or anonymous (Rate Limited/Guest Mode).
 */
export function initializeOctokit(token?: string) {
  if (token) {
    octokit = new Octokit({ auth: token });
  } else {
    octokit = new Octokit(); // Anonymous (60 req/hr)
  }
}

/**
 * Helper to ensure we have an instance
 */
function getKit(): Octokit {
  if (!octokit) initializeOctokit();
  return octokit!;
}

// --- Discovery ---

/**
 * Searches for repositories with the topic 'forkflirt-profile'.
 * Returns raw repo metadata. The Logic layer will fetch the JSONs.
 */
export async function searchProfiles(): Promise<SearchResult[]> {
  try {
    const response = await getKit().rest.search.repos({
      q: "topic:forkflirt-profile",
      sort: "updated",
      order: "desc",
      per_page: 50, // Fetch 50 at a time
    });

    return response.data.items.map((repo: any) => ({
      username: repo.owner.login,
      repo: repo.name,
      avatar_url: repo.owner.avatar_url,
      description: repo.description,
      pushed_at: repo.pushed_at,
    }));
  } catch (error: any) {
    if (error.status === 403) {
      throw new Error("RATE_LIMIT_EXCEEDED");
    }
    throw error;
  }
}

// --- Data Fetching (Raw Optimization) ---

/**
 * Fetches profile.json via raw.githubusercontent.com to save API quota.
 * Validates the JSON against the schema.
 */
export async function fetchRawProfile(
  username: string,
  repo: string,
  useCache: boolean = true
): Promise<Profile | null> {
  // Check cache first
  if (useCache) {
    const cached = await getCachedProfile(username, repo);
    if (cached) {
      console.debug(`Using cached profile for ${username}`);
      return cached;
    }
  }

  const url = `https://raw.githubusercontent.com/${username}/${repo}/main/profile/profile.json`;

  try {
    const res = await fetch(url, { cache: "no-store" }); // Ensure fresh data
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Fetch failed: ${res.status}`);
    }

    const json = await res.json();
    const { valid, errors, sanitizedData } = validateProfile(json);

    if (!valid) {
      console.warn(`[Schema Violation] ${username}/${repo}:`, errors);
      // We return null so the feed logic knows to skip this malformed profile
      return null;
    }

    // Cache the profile
    await cacheProfile(sanitizedData, username, repo);

    return sanitizedData;
  } catch (err) {
    console.error(`[Profile Fetch Error] ${username}:`, err);
    return null;
  }
}

/**
 * Fetches the user's .forkflirtignore file from the Repo Root.
 */
export async function fetchIgnoreFile(
  username: string,
  repo: string
): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${username}/${repo}/main/.forkflirtignore`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// --- Writes (Owner Only) ---

/**
 * Commits a file to the repository. Handles "Create" vs "Update" via SHA check.
 */
export async function commitFile(
  owner: string,
  repo: string,
  file: CommitFileParams
) {
  const kit = getKit();

  // 1. Check if file exists to get SHA (needed for updates)
  let sha: string | undefined;
  try {
    const { data } = await kit.rest.repos.getContent({
      owner,
      repo,
      path: file.path,
    });
    // @ts-ignore - Octokit types are vague here, data is object if file found
    if (data && data.sha) sha = data.sha;
  } catch (e: any) {
    // 404 means file doesn't exist, which is fine for creation
    if (e.status !== 404) throw e;
  }

  // 2. Commit
  await kit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: file.path,
    message: file.message,
    content: file.content, // Must be Base64 encoded if binary
    sha, // undefined = create, string = update
    committer: {
      name: "ForkFlirt Client",
      email: "bot@forkflirt.org", // GitHub uses the Auth User for attribution anyway
    },
  });
}

// --- Messaging (Issues) ---

export async function createHandshakeIssue(
  targetOwner: string,
  targetRepo: string,
  title: string,
  body: string
) {
  await getKit().rest.issues.create({
    owner: targetOwner,
    repo: targetRepo,
    title,
    body,
    labels: ["forkflirt-handshake"],
  });
}

export async function getIncomingHandshakes(owner: string, repo: string) {
  const { data } = await getKit().rest.issues.listForRepo({
    owner,
    repo,
    labels: "forkflirt-handshake",
    state: "open",
  });
  return data;
}
