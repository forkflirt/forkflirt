import { get, set, del } from "idb-keyval";
import { initializeOctokit } from "./github";

const TOKEN_DB_KEY = "forkflirt_pat";
const USER_CACHE_KEY = "forkflirt_user_cache";

// --- Enhanced Rate Limiting ---

interface RateLimitData {
  attempts: number;
  windowStart: number;
  lockoutUntil?: number;
}

const RATE_LIMIT_DATA = "forkflirt_rate_limit_v2";
const MAX_ATTEMPTS = 3;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const LOCKOUT_MS = 30 * 60 * 1000; // 30 minutes for repeated failures

async function getRateLimitData(): Promise<RateLimitData> {
  const stored = localStorage.getItem(RATE_LIMIT_DATA);
  if (stored) {
    return JSON.parse(stored);
  }
  return { attempts: 0, windowStart: Date.now() };
}

async function setRateLimitData(data: RateLimitData): Promise<void> {
  localStorage.setItem(RATE_LIMIT_DATA, JSON.stringify(data));
}

async function isRateLimited(): Promise<boolean> {
  const data = await getRateLimitData();
  const now = Date.now();

  // Check if currently locked out
  if (data.lockoutUntil && now < data.lockoutUntil) {
    const remainingMinutes = Math.ceil((data.lockoutUntil - now) / 60000);
    throw new Error(`Too many failed attempts. Please try again in ${remainingMinutes} minutes.`);
  }

  // Reset window if expired
  if (now - data.windowStart > WINDOW_MS) {
    data.attempts = 0;
    data.windowStart = now;
  }

  return data.attempts >= MAX_ATTEMPTS;
}

async function incrementRateLimit(): Promise<void> {
  const data = await getRateLimitData();
  const now = Date.now();

  data.attempts++;

  // Implement exponential backoff for repeated failures
  if (data.attempts >= MAX_ATTEMPTS) {
    data.lockoutUntil = now + LOCKOUT_MS;
  }

  await setRateLimitData(data);
}

// Add CAPTCHA integration placeholder
export async function shouldShowCaptcha(): Promise<boolean> {
  // Show CAPTCHA after 2 failed attempts
  const data = await getRateLimitData();
  return data.attempts >= 2;
}

// --- Enhanced CSRF Protection ---

const CSRF_TOKEN_PREFIX = "forkflirt_csrf_";

export async function generateCSRFToken(operation: string = 'default'): Promise<string> {
  const token = crypto.randomUUID();
  const key = `${CSRF_TOKEN_PREFIX}${operation}`;
  sessionStorage.setItem(key, token);
  return token;
}

export async function validateCSRFToken(
  providedToken: string,
  operation: string = 'default'
): Promise<boolean> {
  const key = `${CSRF_TOKEN_PREFIX}${operation}`;
  const storedToken = sessionStorage.getItem(key);

  if (!storedToken || storedToken !== providedToken) {
    // Clear all CSRF tokens on failure
    clearCSRFTokens();
    return false;
  }

  return true;
}

export function clearCSRFTokens(): void {
  const keys = Object.keys(sessionStorage);
  keys.forEach(key => {
    if (key.startsWith(CSRF_TOKEN_PREFIX)) {
      sessionStorage.removeItem(key);
    }
  });
}

export interface AuthUser {
  login: string;
  avatar_url: string;
  html_url: string;
  name?: string;
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
    if (!csrfToken || !(await validateCSRFToken(csrfToken, 'login'))) {
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

  // Check if CAPTCHA should be shown
  if (await shouldShowCaptcha()) {
    // TODO: Implement actual CAPTCHA verification
    console.warn("CAPTCHA would be shown here - implement CAPTCHA integration");
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
    clearCSRFTokens();

    // Reset rate limit on successful login
    localStorage.removeItem(RATE_LIMIT_DATA);

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
