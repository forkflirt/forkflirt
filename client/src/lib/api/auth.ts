import { get, set, del } from "idb-keyval";
import { initializeOctokit } from "./github";

const TOKEN_DB_KEY = "forkflirt_pat";
const USER_CACHE_KEY = "forkflirt_user_cache";
const CSRF_TOKEN_KEY = "forkflirt_csrf_token";
const RATE_LIMIT_KEY = "forkflirt_login_attempts";
const RATE_LIMIT_TIME_KEY = "forkflirt_login_attempts_time";

// Rate limiting configuration
const MAX_ATTEMPTS = 3;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export interface AuthUser {
  login: string;
  avatar_url: string;
  html_url: string;
  name?: string;
}

// --- CSRF Protection ---

export async function generateCSRFToken(): Promise<string> {
  const token = crypto.randomUUID();
  sessionStorage.setItem(CSRF_TOKEN_KEY, token);
  return token;
}

export async function validateCSRFToken(providedToken: string): Promise<boolean> {
  const storedToken = sessionStorage.getItem(CSRF_TOKEN_KEY);
  return storedToken === providedToken;
}

// --- Rate Limiting ---

async function isRateLimited(): Promise<boolean> {
  const attempts = await get<number>(RATE_LIMIT_KEY) || 0;
  const lastAttempt = await get<number>(RATE_LIMIT_TIME_KEY) || 0;
  
  if (Date.now() - lastAttempt > WINDOW_MS) {
    await del(RATE_LIMIT_KEY);
    await del(RATE_LIMIT_TIME_KEY);
    return false;
  }
  
  return attempts >= MAX_ATTEMPTS;
}

async function incrementRateLimit(): Promise<void> {
  const attempts = await get<number>(RATE_LIMIT_KEY) || 0;
  await set(RATE_LIMIT_KEY, attempts + 1);
  await set(RATE_LIMIT_TIME_KEY, Date.now());
}

// --- Token Validation ---

function isValidGitHubTokenFormat(token: string): boolean {
  // GitHub PATs are 40+ hex characters
  return /^[a-f0-9]{40,}$/.test(token);
}

// --- Token Source Detection ---

interface TokenSource {
  method: 'manual' | 'url' | 'storage';
  timestamp: number;
  sessionId: string;
}

function detectTokenSource(): TokenSource {
  const urlParams = new URLSearchParams(window.location.search);
  const hasUrlToken = urlParams.has('token');
  
  return {
    method: hasUrlToken ? 'url' : 'manual',
    timestamp: Date.now(),
    sessionId: crypto.randomUUID()
  };
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
 * Validates a PAT and establishes a session with CSRF protection.
 */
export async function loginWithToken(
  token: string, 
  csrfToken?: string,
  source?: TokenSource
): Promise<AuthUser> {
  // Detect token source if not provided
  const tokenSource = source || detectTokenSource();
  
  // Reject URL-based tokens for security
  if (tokenSource.method === 'url') {
    throw new Error("For security, please paste your token manually instead of using URL parameters");
  }
  
  // Validate CSRF token for manual input
  if (tokenSource.method === 'manual') {
    if (!csrfToken || !(await validateCSRFToken(csrfToken))) {
      throw new Error("Invalid CSRF token. Please refresh the page and try again.");
    }
  }
  
  // Validate token format
  if (!isValidGitHubTokenFormat(token)) {
    throw new Error("Invalid token format. GitHub PATs should be 40+ hexadecimal characters.");
  }
  
  // Rate limiting check
  if (await isRateLimited()) {
    throw new Error("Too many login attempts. Please wait 10 minutes before trying again.");
  }
  
  // Increment rate limit counter
  await incrementRateLimit();

  initializeOctokit(token);

  try {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Invalid token. Please check your GitHub Personal Access Token.");
      } else if (response.status === 403) {
        throw new Error("Token lacks required permissions. Ensure it has 'public_repo' and 'user:read' scopes.");
      } else {
        throw new Error("GitHub API error. Please try again later.");
      }
    }

    const data = await response.json();
    const user: AuthUser = {
      login: data.login,
      avatar_url: data.avatar_url,
      html_url: data.html_url,
      name: data.name,
    };

    await set(TOKEN_DB_KEY, token);
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    
    // Clear CSRF token after successful login
    sessionStorage.removeItem(CSRF_TOKEN_KEY);
    
    // Reset rate limit on successful login
    await del(RATE_LIMIT_KEY);
    await del(RATE_LIMIT_TIME_KEY);

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
 * Returns the URL to pre-fill the GitHub Token generation page with state parameter.
 */
export function getGitHubTokenUrl(): string {
  const state = crypto.randomUUID();
  sessionStorage.setItem('oauth_state', state);
  
  const description = "ForkFlirt Client (Browser)";
  // Scopes needed:
  // public_repo: Read/Write profile.json
  // user:read: Verify identity and getting avatar
  const scopes = "public_repo,user:read";

  const params = new URLSearchParams({
    description,
    scopes,
    state
  });

  return `https://github.com/settings/tokens/new?${params.toString()}`;
}
