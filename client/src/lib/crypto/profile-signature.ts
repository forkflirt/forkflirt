import type { Profile } from '$lib/schemas/validator';

export interface ProfileSignature {
  profile_signature: string; // base64-encoded RSA-PSS signature
  signature_timestamp: string; // ISO timestamp for replay protection
  signature_nonce: string; // random nonce for uniqueness
}

/**
 * Signs a profile using RSA-PSS to prevent tampering and cloning attacks.
 * This creates a cryptographic binding between the profile data and the user's private key.
 */
export async function signProfile(profile: Profile, privateKey: CryptoKey): Promise<ProfileSignature> {
  try {
    // Create canonical profile string (excluding signature fields)
    const { security, ...profileWithoutSignature } = profile;
    const { profile_signature, signature_timestamp, signature_nonce, ...securityWithoutSignature } = security;

    const canonicalProfile = JSON.stringify({
      ...profileWithoutSignature,
      security: securityWithoutSignature
    }, Object.keys(profileWithoutSignature).sort());

    // Generate nonce for uniqueness
    const nonce = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Create data to sign
    const dataToSign = canonicalProfile + timestamp + nonce;
    const encoder = new TextEncoder();
    const data = encoder.encode(dataToSign);

    // Sign using RSA-PSS for enhanced security
    const signature = await window.crypto.subtle.sign(
      {
        name: "RSA-PSS",
        saltLength: 32, // Use 32-byte salt for security
      },
      privateKey,
      data
    );

    // Convert signature to base64
    const signatureBase64 = arrayBufferToBase64(signature);

    return {
      profile_signature: signatureBase64,
      signature_timestamp: timestamp,
      signature_nonce: nonce
    };
  } catch (error) {
    console.error('Profile signing failed:', error);
    throw new Error('Failed to sign profile');
  }
}

/**
 * Verifies a profile signature using RSA-PSS.
 * Returns true if the signature is valid and the profile hasn't been tampered with.
 */
export async function verifyProfileSignature(profile: Profile, publicKey: CryptoKey): Promise<boolean> {
  try {
    // Check if profile has signature fields
    const { profile_signature, signature_timestamp, signature_nonce } = profile.security;

    if (!profile_signature || !signature_timestamp || !signature_nonce) {
      console.warn('Profile missing required signature fields');
      return false;
    }

    // Verify timestamp is not too old (prevent replay attacks)
    const signatureTime = new Date(signature_timestamp).getTime();
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (now - signatureTime > maxAge) {
      console.warn('Profile signature too old, possible replay attack');
      return false;
    }

    // Create canonical profile string (same as in signing)
    const { security, ...profileWithoutSignature } = profile;
    const { profile_signature: _, signature_timestamp: __, signature_nonce: ___, ...securityWithoutSignature } = security;

    const canonicalProfile = JSON.stringify({
      ...profileWithoutSignature,
      security: securityWithoutSignature
    }, Object.keys(profileWithoutSignature).sort());

    // Recreate data that was signed
    const dataToVerify = canonicalProfile + signature_timestamp + signature_nonce;
    const encoder = new TextEncoder();
    const data = encoder.encode(dataToVerify);

    // Convert base64 signature back to ArrayBuffer
    const signatureBuffer = base64ToArrayBuffer(profile_signature);

    // Verify using RSA-PSS
    const isValid = await window.crypto.subtle.verify(
      {
        name: "RSA-PSS",
        saltLength: 32,
      },
      publicKey,
      signatureBuffer,
      data
    );

    if (!isValid) {
      console.warn('Invalid profile signature detected');
    }

    return isValid;
  } catch (error) {
    console.error('Profile signature verification failed:', error);
    return false;
  }
}

/**
 * Checks if a profile needs a signature based on its current state.
 * Profiles should be re-signed when content changes.
 */
export function needsSignature(profile: Profile): boolean {
  const { profile_signature, signature_timestamp, signature_nonce } = profile.security;

  // If any signature field is missing, profile needs signing
  if (!profile_signature || !signature_timestamp || !signature_nonce) {
    return true;
  }

  // Check if signature is old (profiles should be re-signed periodically)
  const signatureTime = new Date(signature_timestamp).getTime();
  const now = Date.now();
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

  return now - signatureTime > maxAge;
}

/**
 * Adds signature fields to a profile if they don't exist.
 * This is useful for migrating existing profiles.
 */
export function addSignatureFields(profile: Profile): Profile {
  const security = profile.security || {};

  return {
    ...profile,
    security: {
      ...profile.security,
      ...(security.profile_signature && { profile_signature: security.profile_signature }),
      ...(security.signature_timestamp && { signature_timestamp: security.signature_timestamp }),
      ...(security.signature_nonce && { signature_nonce: security.signature_nonce })
    }
  };
}

// Utility functions for base64 conversion

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}