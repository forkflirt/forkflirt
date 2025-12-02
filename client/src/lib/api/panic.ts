import { deleteIdentity } from '$lib/crypto/keys.js';
import { del, keys } from 'idb-keyval';

/**
 * Emergency data deletion function for user safety.
 * This is critical for privacy-conscious users who need immediate data removal.
 */
export async function triggerPanicMode(): Promise<void> {
  try {
    console.log('🚨 TRIGGERING PANIC MODE - Emergency Data Deletion');

    // 1. Delete all cryptographic identity using existing function
    await deleteIdentity();

    // 2. Clear all session storage
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }

    // 3. Clear all localStorage data
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    // 4. Clear all cookies including domain-specific
    if (typeof document !== 'undefined') {
      document.cookie.split(";").forEach((c) => {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/,
          "=;expires=" + new Date().toUTCString() + ";path=/;domain=" + location.hostname);

        // Also try with parent domain
        const domainParts = location.hostname.split('.');
        if (domainParts.length > 1) {
          const parentDomain = domainParts.slice(1).join('.');
          document.cookie = c.replace(/^ +/, "").replace(/=.*/,
            "=;expires=" + new Date().toUTCString() + ";path=/;domain=" + parentDomain);
        }
      });
    }

    // 5. Clear all IndexedDB databases completely
    try {
      if (typeof indexedDB !== 'undefined') {
        const databases = await indexedDB.databases();
        for (const db of databases) {
          if (db.name) {
            await indexedDB.deleteDatabase(db.name);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to clear IndexedDB databases:', error);
    }

    // 6. Additional cleanup using idb-keyval
    try {
      const allKeys = await keys();
      for (const key of allKeys) {
        await del(key);
      }
    } catch (error) {
      console.warn('Failed to clear idb-keyval storage:', error);
    }

    console.log('✅ Panic mode completed - all data cleared');

    // 7. Force hard redirect to innocuous site
    // Using a small delay to ensure all operations complete
    setTimeout(() => {
      window.location.replace('https://www.wikipedia.org');
    }, 100);

  } catch (error) {
    console.error('❌ Error during panic mode:', error);
    // Still attempt redirect even if some operations fail
    window.location.replace('https://www.wikipedia.org');
  }
}

/**
 * Check if any user data remains in browser storage.
 * Useful for verifying panic mode was effective.
 */
export async function hasAnyRemainingData(): Promise<boolean> {
  try {
    // Check localStorage
    if (typeof localStorage !== 'undefined' && localStorage.length > 0) {
      return true;
    }

    // Check sessionStorage
    if (typeof sessionStorage !== 'undefined' && sessionStorage.length > 0) {
      return true;
    }

    // Check IndexedDB
    if (typeof indexedDB !== 'undefined') {
      const databases = await indexedDB.databases();
      if (databases.length > 0) {
        return true;
      }
    }

    // Check cookies
    if (typeof document !== 'undefined' && document.cookie.length > 0) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}