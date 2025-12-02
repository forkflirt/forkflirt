import type { Profile } from '$lib/schemas/validator';

export interface KeyRotationData {
  current_key: string;           // PEM of current public key
  previous_keys: KeyHistory[];   // Array of previous public keys
  rotation_timestamp: string;    // ISO timestamp when current key was created
  next_rotation?: string;        // ISO timestamp for scheduled next rotation
  rotation_version: number;      // Incremental version number
}

export interface KeyHistory {
  public_key: string;            // PEM of previous public key
  timestamp: string;             // When this key was created
  deactivated: string;           // When this key was deactivated
  version: number;               // Version number of this key
}

export interface KeyRotationConfig {
  rotation_interval_days: number;  // Default: 365 days
  transition_period_days: number;  // Default: 90 days
  max_previous_keys: number;       // Default: 3 keys
  auto_rotate: boolean;            // Default: false (user control)
}

export const DEFAULT_ROTATION_CONFIG: KeyRotationConfig = {
  rotation_interval_days: 365,
  transition_period_days: 90,
  max_previous_keys: 3,
  auto_rotate: false
};

export class KeyRotationManager {
  private static readonly STORAGE_KEY = 'forkflirt_key_rotation_config';

  /**
   * Initialize key rotation data for a profile that doesn't have it yet
   */
  static initializeKeyRotation(currentPublicKey: string): KeyRotationData {
    return {
      current_key: currentPublicKey,
      previous_keys: [],
      rotation_timestamp: new Date().toISOString(),
      rotation_version: 1
    };
  }

  /**
   * Check if a profile needs key rotation
   */
  static needsRotation(rotationData: KeyRotationData, config: KeyRotationConfig = DEFAULT_ROTATION_CONFIG): boolean {
    const now = new Date();
    const rotationDate = rotationData.next_rotation ?
      new Date(rotationData.next_rotation) :
      this.calculateNextRotation(rotationData.rotation_timestamp, config.rotation_interval_days);

    return now >= rotationDate;
  }

  /**
   * Calculate next rotation date
   */
  static calculateNextRotation(lastRotation: string, intervalDays: number): Date {
    const last = new Date(lastRotation);
    const next = new Date(last);
    next.setDate(next.getDate() + intervalDays);
    return next;
  }

  /**
   * Add previous key to history when rotating
   */
  static addKeyToHistory(
    rotationData: KeyRotationData,
    maxPreviousKeys: number = DEFAULT_ROTATION_CONFIG.max_previous_keys
  ): KeyRotationData {
    const now = new Date().toISOString();

    // Create history entry for current key
    const historyEntry: KeyHistory = {
      public_key: rotationData.current_key,
      timestamp: rotationData.rotation_timestamp,
      deactivated: now,
      version: rotationData.rotation_version
    };

    // Add to beginning of history array
    const updatedHistory = [historyEntry, ...rotationData.previous_keys];

    // Trim history to max keys
    if (updatedHistory.length > maxPreviousKeys) {
      updatedHistory.splice(maxPreviousKeys);
    }

    return {
      ...rotationData,
      previous_keys: updatedHistory
    };
  }

  /**
   * Perform key rotation - returns new rotation data with updated current key
   */
  static rotateKey(
    rotationData: KeyRotationData,
    newPublicKey: string,
    config: KeyRotationConfig = DEFAULT_ROTATION_CONFIG
  ): KeyRotationData {
    // Add current key to history
    const withHistory = this.addKeyToHistory(rotationData, config.max_previous_keys);

    // Create new rotation data
    const now = new Date().toISOString();
    const nextRotation = this.calculateNextRotation(now, config.rotation_interval_days).toISOString();

    return {
      current_key: newPublicKey,
      previous_keys: withHistory.previous_keys,
      rotation_timestamp: now,
      next_rotation: config.auto_rotate ? nextRotation : undefined,
      rotation_version: rotationData.rotation_version + 1
    };
  }

  /**
   * Check if a key is still valid for decryption
   */
  static isKeyValid(keyData: KeyRotationData | string, targetKey: string): boolean {
    // Handle legacy profiles without rotation data
    if (typeof keyData === 'string') {
      return keyData === targetKey;
    }

    // Check current key
    if (keyData.current_key === targetKey) {
      return true;
    }

    // Check previous keys
    return keyData.previous_keys.some(history => history.public_key === targetKey);
  }

  /**
   * Get all valid encryption targets for a profile
   */
  static getValidEncryptionTargets(keyData: KeyRotationData | string): string[] {
    // Handle legacy profiles
    if (typeof keyData === 'string') {
      return [keyData];
    }

    // Return current key + previous keys that are still in transition period
    const now = new Date();
    const validKeys = [keyData.current_key];

    for (const previousKey of keyData.previous_keys) {
      const deactivated = new Date(previousKey.deactivated);
      const transitionEnd = new Date(deactivated);
      transitionEnd.setDate(transitionEnd.getDate() + DEFAULT_ROTATION_CONFIG.transition_period_days);

      if (now <= transitionEnd) {
        validKeys.push(previousKey.public_key);
      }
    }

    return validKeys;
  }

  /**
   * Extract key rotation data from profile
   */
  static extractKeyRotationData(profile: Profile): KeyRotationData | null {
    const rotation = (profile.security as any)?.key_rotation;
    return rotation || null;
  }

  /**
   * Update profile with key rotation data
   */
  static updateProfileWithRotationData(profile: Profile, rotationData: KeyRotationData): Profile {
    return {
      ...profile,
      security: {
        ...profile.security,
        key_rotation: rotationData
      }
    };
  }

  /**
   * Get user's rotation configuration preferences
   */
  static async getRotationConfig(): Promise<KeyRotationConfig> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? { ...DEFAULT_ROTATION_CONFIG, ...JSON.parse(stored) } : DEFAULT_ROTATION_CONFIG;
    } catch {
      return DEFAULT_ROTATION_CONFIG;
    }
  }

  /**
   * Save user's rotation configuration preferences
   */
  static async saveRotationConfig(config: Partial<KeyRotationConfig>): Promise<void> {
    try {
      const current = await this.getRotationConfig();
      const updated = { ...current, ...config };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save rotation config:', error);
    }
  }
}