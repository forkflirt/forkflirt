import { Octokit } from "@octokit/rest";
import { createOAuthDeviceAuth } from "@octokit/auth-oauth-device";
import { validateProfile } from "../schemas/validator";
import type { Profile } from "../schemas/validator"; // Inferred type from JSON schema if you setup types generation, else 'any'

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
  repo: string
): Promise<Profile | null> {
  const url = `https://raw.githubusercontent.com/${username}/${repo}/main/profile/profile.json`;

  try {
    const res = await fetch(url, { cache: "no-store" }); // Ensure fresh data
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Fetch failed: ${res.status}`);
    }

    const json = await res.json();
    const { valid, errors } = validateProfile(json);

    if (!valid) {
      console.warn(`[Schema Violation] ${username}/${repo}:`, errors);
      // We return null so the feed logic knows to skip this malformed profile
      return null;
    }

    return json;
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
