import { get, set, del } from "idb-keyval";
import { initializeOctokit } from "./github";

const TOKEN_DB_KEY = "forkflirt_pat";
const USER_CACHE_KEY = "forkflirt_user_cache";

export interface AuthUser {
  login: string;
  avatar_url: string;
  html_url: string;
  name?: string;
}

/**
 * Restores session from IndexedDB.
 */
export async function restoreSession(): Promise<AuthUser | null> {
  if (typeof window === "undefined") return null;

  try {
    const token = await get<string>(TOKEN_DB_KEY);
    const cachedUser = localStorage.getItem(USER_CACHE_KEY);

    if (token) {
      initializeOctokit(token);
      return cachedUser ? JSON.parse(cachedUser) : null;
    }
  } catch (err) {
    console.error("Auth restoration failed:", err);
  }

  initializeOctokit();
  return null;
}

/**
 * Validates a PAT and establishes a session.
 */
export async function loginWithToken(token: string): Promise<AuthUser> {
  initializeOctokit(token);

  try {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) throw new Error("Invalid Token");

    const data = await response.json();
    const user: AuthUser = {
      login: data.login,
      avatar_url: data.avatar_url,
      html_url: data.html_url,
      name: data.name,
    };

    await set(TOKEN_DB_KEY, token);
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));

    return user;
  } catch (error) {
    initializeOctokit();
    throw error;
  }
}

export async function logout() {
  await del(TOKEN_DB_KEY);
  localStorage.removeItem(USER_CACHE_KEY);
  initializeOctokit();
  window.location.reload();
}

export async function getToken(): Promise<string | undefined> {
  return await get<string>(TOKEN_DB_KEY);
}

export function isOwner(repoOwner: string): boolean {
  const userStr = localStorage.getItem(USER_CACHE_KEY);
  if (!userStr) return false;
  const user = JSON.parse(userStr) as AuthUser;
  return user.login.toLowerCase() === repoOwner.toLowerCase();
}

// --- The Magic Link Generator ---

/**
 * Returns the URL to pre-fill the GitHub Token generation page.
 */
export function getGitHubTokenUrl(): string {
  const description = "ForkFlirt Client (Browser)";
  // Scopes needed:
  // public_repo: Read/Write profile.json
  // user:read: Verify identity and getting avatar
  const scopes = "public_repo,user:read";

  return `https://github.com/settings/tokens/new?description=${encodeURIComponent(
    description
  )}&scopes=${scopes}`;
}
