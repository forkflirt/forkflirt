import { writable, get } from "svelte/store";
import {
  type AuthUser,
  restoreSession,
  loginWithToken,
  logout as authLogout,
} from "../api/auth";
import { fetchRawProfile } from "../api/github";
import { hasIdentity } from "../crypto/keys";
import type { Profile } from "../schemas/validator";

// --- Types ---

export interface UserState {
  auth: AuthUser | null; // GitHub User (Login, Avatar)
  profile: Profile | null; // ForkFlirt Profile (Bio, Survey)
  hasKeys: boolean; // True if Private Key exists in IDB
  loading: boolean;
  error: string | null;
}

const initialState: UserState = {
  auth: null,
  profile: null,
  hasKeys: false,
  loading: true,
  error: null,
};

// --- Store ---

export const userStore = writable<UserState>(initialState);

// --- Actions ---

/**
 * Initialize the app. Checks IndexedDB for session and keys.
 * If logged in, fetches the user's own profile to populate state.
 */
export async function initApp() {
  userStore.update((s) => ({ ...s, loading: true }));

  try {
    // 1. Restore GitHub Session
    const auth = await restoreSession();

    // 2. Check for Cryptographic Identity
    const keysExist = await hasIdentity();

    let profile: Profile | null = null;

    // 3. If logged in, try to fetch OUR OWN profile
    if (auth) {
      profile = await fetchRawProfile(auth.login, "forkflirt");
      // Note: We assume repo name is 'forkflirt' or user needs to configure it.
      // In v1.4, we default to searching 'forkflirt' or the current repo context.
    }

    userStore.set({
      auth,
      profile,
      hasKeys: keysExist,
      loading: false,
      error: null,
    });
  } catch (err: any) {
    console.error("App Init Error:", err);
    userStore.update((s) => ({
      ...s,
      loading: false,
      error: "Failed to initialize application.",
    }));
  }
}

/**
 * Login Action.
 * 1. Validates Token
 * 2. Updates Store
 * 3. Fetches Profile & Key Status
 */
export async function login(token: string) {
  userStore.update((s) => ({ ...s, loading: true, error: null }));

  try {
    const auth = await loginWithToken(token);
    const keysExist = await hasIdentity();
    const profile = await fetchRawProfile(auth.login, "forkflirt");

    userStore.set({
      auth,
      profile,
      hasKeys: keysExist,
      loading: false,
      error: null,
    });

    // Hard reload to ensure Octokit singleton is fresh across app
    window.location.reload();
  } catch (err: any) {
    userStore.update((s) => ({
      ...s,
      loading: false,
      error: err.message || "Login failed",
    }));
    throw err;
  }
}

/**
 * Logout Action.
 */
export async function logout() {
  await authLogout();
  userStore.set(initialState);
}

/**
 * Call this after the Wizard completes to update local state without reloading.
 */
export function profileUpdated(newProfile: Profile) {
  userStore.update((s) => ({
    ...s,
    profile: newProfile,
    hasKeys: true, // Wizard implies keys were generated
  }));
}
