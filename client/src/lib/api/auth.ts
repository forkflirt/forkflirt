import { get, set, del } from "idb-keyval";
import { initializeOctokit } from "./github";

const TOKEN_DB_KEY = "forkflirt_pat";
const USER_CACHE_KEY = "forkflirt_user_cache";
const TOKEN_CREATED_KEY = "forkflirt_pat_created";

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

// CAPTCHA Implementation
interface CaptchaChallenge {
  question: string;
  answer: number;
  timestamp: number;
}

const CAPTCHA_KEY = 'forkflirt_captcha_challenge';
const CAPTCHA_ATTEMPTS_KEY = 'forkflirt_captcha_attempts';
const MAX_CAPTCHA_ATTEMPTS = 3;
const CAPTCHA_WINDOW = 5 * 60 * 1000; // 5 minutes

export async function shouldShowCaptcha(): Promise<boolean> {
  // Show CAPTCHA after 2 failed attempts
  const data = await getRateLimitData();
  return data.attempts >= 2;
}

export function generateCaptcha(): CaptchaChallenge {
  const operations = ['+', '-', '*'];
  const op = operations[Math.floor(Math.random() * operations.length)];
  const a = Math.floor(Math.random() * 20) + 1;
  const b = Math.floor(Math.random() * 20) + 1;

  let answer: number;
  let question: string;

  switch (op) {
    case '+':
      answer = a + b;
      question = `What is ${a} + ${b}?`;
      break;
    case '-':
      answer = a - b;
      question = `What is ${a} - ${b}?`;
      break;
    case '*':
      answer = a * b;
      question = `What is ${a} × ${b}?`;
      break;
    default:
      answer = a + b;
      question = `What is ${a} + ${b}?`;
  }

  return {
    question,
    answer,
    timestamp: Date.now()
  };
}

export function storeCaptchaChallenge(challenge: CaptchaChallenge): void {
  sessionStorage.setItem(CAPTCHA_KEY, JSON.stringify(challenge));
}

export function getCaptchaChallenge(): CaptchaChallenge | null {
  const stored = sessionStorage.getItem(CAPTCHA_KEY);
  if (!stored) return null;

  const challenge = JSON.parse(stored) as CaptchaChallenge;

  // Challenges expire after 5 minutes
  if (Date.now() - challenge.timestamp > 5 * 60 * 1000) {
    sessionStorage.removeItem(CAPTCHA_KEY);
    return null;
  }

  return challenge;
}

export function verifyCaptcha(userAnswer: string): boolean {
  const challenge = getCaptchaChallenge();
  if (!challenge) return false;

  // Check CAPTCHA attempt rate limiting
  const attemptData = getCaptchaAttemptData();
  if (attemptData.attempts >= MAX_CAPTCHA_ATTEMPTS &&
      Date.now() - attemptData.windowStart < CAPTCHA_WINDOW) {
    return false; // Rate limited
  }

  const isValid = parseInt(userAnswer) === challenge.answer;

  if (isValid) {
    sessionStorage.removeItem(CAPTCHA_KEY);
    clearCaptchaAttempts(); // Reset on success
  } else {
    incrementCaptchaAttempts(); // Count failed attempts
  }

  return isValid;
}

interface CaptchaAttemptData {
  attempts: number;
  windowStart: number;
}

export function getCaptchaAttemptData(): CaptchaAttemptData {
  const stored = sessionStorage.getItem(CAPTCHA_ATTEMPTS_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  return { attempts: 0, windowStart: Date.now() };
}

function setCaptchaAttemptData(data: CaptchaAttemptData): void {
  sessionStorage.setItem(CAPTCHA_ATTEMPTS_KEY, JSON.stringify(data));
}

function incrementCaptchaAttempts(): void {
  const data = getCaptchaAttemptData();
  const now = Date.now();

  // Reset window if expired
  if (now - data.windowStart > CAPTCHA_WINDOW) {
    data.attempts = 0;
    data.windowStart = now;
  }

  data.attempts++;
  setCaptchaAttemptData(data);
}

function clearCaptchaAttempts(): void {
  sessionStorage.removeItem(CAPTCHA_ATTEMPTS_KEY);
}

export function clearCaptcha(): void {
  sessionStorage.removeItem(CAPTCHA_KEY);
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
  captchaAnswer?: string,
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
    if (!captchaAnswer || !verifyCaptcha(captchaAnswer)) {
      throw new Error("CAPTCHA verification required. Please refresh and complete the CAPTCHA challenge.");
    }
  }

  // Increment rate limit counter
  await incrementRateLimit();

  initializeOctokit(token);

  try {
    // Validate token and get user info
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!userResponse.ok) {
      if (userResponse.status === 401) {
        throw new Error("Invalid token. Please check your GitHub Personal Access Token.");
      } else if (userResponse.status === 403) {
        throw new Error("Token lacks required permissions. Ensure it has 'public_repo' and 'user:read' scopes.");
      } else {
        throw new Error("GitHub API error. Please try again later.");
      }
    }

    const userData = await userResponse.json();

    // Validate token has required scopes by testing repository access
    const repoTestResponse = await fetch("https://api.github.com/user/repos", {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!repoTestResponse.ok) {
      throw new Error("Token missing required 'public_repo' scope. Please recreate your token with the correct permissions.");
    }

    const user: AuthUser = {
      login: userData.login,
      avatar_url: userData.avatar_url,
      html_url: userData.html_url,
      name: userData.name,
    };

    await set(TOKEN_DB_KEY, token);
    await set(TOKEN_CREATED_KEY, Date.now().toString());
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
  await del(TOKEN_CREATED_KEY);
  localStorage.removeItem(USER_CACHE_KEY);
  initializeOctokit();
  window.location.reload();
}

export async function getToken(): Promise<string | undefined> {
  const token = await get<string>(TOKEN_DB_KEY);
  if (!token) return undefined;

  // Validate token is still valid
  try {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      // Token is invalid, clear it
      await logout();
      return undefined;
    }

    return token;
  } catch (error) {
    // Network error or token invalid, clear to be safe
    await logout();
    return undefined;
  }
}

export function isOwner(repoOwner: string): boolean {
  const userStr = localStorage.getItem(USER_CACHE_KEY);
  if (!userStr) return false;
  const user = JSON.parse(userStr) as AuthUser;
  return user.login.toLowerCase() === repoOwner.toLowerCase();
}

// --- Token Security Management ---

/**
 * Check if token should be rotated based on age
 */
export async function shouldRotateToken(): Promise<boolean> {
  const tokenCreated = await get<string>(TOKEN_CREATED_KEY);
  if (!tokenCreated) return false;

  const createdTime = parseInt(tokenCreated);
  const tokenAge = Date.now() - createdTime;
  const ninetyDays = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds

  return tokenAge > ninetyDays;
}

/**
 * Get token age in days
 */
export async function getTokenAge(): Promise<number> {
  const tokenCreated = await get<string>(TOKEN_CREATED_KEY);
  if (!tokenCreated) return 0;

  const createdTime = parseInt(tokenCreated);
  const tokenAge = Date.now() - createdTime;
  return Math.floor(tokenAge / (24 * 60 * 60 * 1000)); // days
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
