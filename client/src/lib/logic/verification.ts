import type { Profile } from "../schemas/validator";

// --- Types ---

export type VerificationProvider =
  | "keybase"
  | "mastodon"
  | "dns"
  | "well-known";

export interface VerifiedIdentity {
  provider: VerificationProvider;
  handleOrDomain: string; // e.g., "travis", "@alice@social.co", "myblog.com"
  proofUrl?: string; // Link to the specific proof (tweet, gist, etc.)
  platform?: string; // For Keybase aggregation (e.g. "twitter", "reddit")
}

// --- Main Entry Point ---

/**
 * Runs all applicable verification checks in parallel.
 * Returns a list of identities that passed verification.
 */
export async function verifyProfile(
  profile: Profile,
  repoOwner: string
): Promise<VerifiedIdentity[]> {
  const promises: Promise<VerifiedIdentity[]>[] = [];

  // 1. Keybase
  if (profile.identity.social?.keybase) {
    promises.push(verifyKeybase(profile.identity.social.keybase, repoOwner));
  }

  // 2. Mastodon
  if (profile.identity.social?.mastodon) {
    promises.push(verifyMastodon(profile.identity.social.mastodon, repoOwner));
  }

  // 3. Domains (DNS & Well-Known)
  if (profile.content.links) {
    for (const link of profile.content.links) {
      if (!link.url) continue;
      try {
        const url = new URL(link.url);
        // Run both checks on the domain
        promises.push(verifyDNS(url.hostname, repoOwner));
        promises.push(verifyWellKnown(url.hostname, repoOwner));
      } catch {
        // Invalid URL in profile, skip
      }
    }
  }

  const results = await Promise.allSettled(promises);

  // Flatten results
  const verified: VerifiedIdentity[] = [];
  for (const res of results) {
    if (res.status === "fulfilled") {
      verified.push(...res.value);
    }
  }

  return verified;
}

// --- 1. Keybase Logic ---

async function verifyKeybase(
  kbUsername: string,
  repoOwner: string
): Promise<VerifiedIdentity[]> {
  try {
    const res = await fetch(
      `https://keybase.io/_/api/1.0/user/lookup.json?usernames=${kbUsername}`
    );
    if (!res.ok) return [];

    const data = await res.json();
    const user = data.them?.[0];
    if (!user || !user.proofs_summary) return [];

    const proofs = user.proofs_summary.all;

    // Step 1: The Bridge Check
    // Does this Keybase user own the current GitHub repo?
    const githubProof = proofs.find(
      (p: any) =>
        p.proof_type === "github" &&
        p.nametag.toLowerCase() === repoOwner.toLowerCase()
    );

    if (!githubProof) return []; // Bridge failed, trust nothing.

    // Step 2: Aggregate all other proofs
    // We trust Keybase, so we trust everything they say is verified.
    return proofs
      .filter((p: any) => p.proof_type !== "github") // Don't list GitHub (redundant)
      .map((p: any) => ({
        provider: "keybase",
        handleOrDomain: p.nametag,
        platform: p.proof_type, // twitter, reddit, dns, etc.
        proofUrl: p.service_url,
      }));
  } catch (e) {
    console.warn("Keybase check failed", e);
    return [];
  }
}

// --- 2. Mastodon Logic (Back-Link) ---

async function verifyMastodon(
  fullHandle: string,
  repoOwner: string
): Promise<VerifiedIdentity[]> {
  // Parse @user@instance.social
  // Remove leading @ if present
  const cleanHandle = fullHandle.startsWith("@")
    ? fullHandle.substring(1)
    : fullHandle;
  const parts = cleanHandle.split("@");

  if (parts.length !== 2) return []; // Invalid format

  const [username, instance] = parts;

  try {
    const res = await fetch(
      `https://${instance}/api/v1/accounts/lookup?acct=${username}`
    );
    if (!res.ok) return [];

    const data = await res.json();

    // Construct the expected strings to search for
    const targetA = `github.com/${repoOwner}/forkflirt`;
    const targetB = `github.com/${repoOwner}/${repoOwner}`; // Some might use personal repo

    const bio = (data.note || "").toLowerCase();

    // Check Bio
    let found = bio.includes(targetA) || bio.includes(targetB);

    // Check Metadata Fields
    if (!found && data.fields) {
      found = data.fields.some((f: any) => {
        const val = (f.value || "").toLowerCase();
        return val.includes(targetA) || val.includes(targetB);
      });
    }

    if (found) {
      return [
        {
          provider: "mastodon",
          handleOrDomain: fullHandle,
          proofUrl: data.url,
        },
      ];
    }
  } catch (e) {
    console.warn("Mastodon check failed", e);
  }
  return [];
}

// --- 3. DNS Logic (TXT Record) ---

async function verifyDNS(
  domain: string,
  repoOwner: string
): Promise<VerifiedIdentity[]> {
  try {
    const res = await fetch(
      `https://dns.google/resolve?name=${domain}&type=TXT`
    );
    if (!res.ok) return [];

    const data = await res.json();
    if (!data.Answer) return [];

    const expected = `forkflirt-verify=${repoOwner.toLowerCase()}`;

    // Scan ALL records
    const found = data.Answer.some((record: any) => {
      // Google DNS returns data usually quoted like "data"
      const txtData = (record.data || "").replace(/"/g, "").toLowerCase();
      return txtData.includes(expected);
    });

    if (found) {
      return [
        {
          provider: "dns",
          handleOrDomain: domain,
        },
      ];
    }
  } catch (e) {
    console.warn("DNS check failed", e);
  }
  return [];
}

// --- 4. Well-Known Logic (File Upload) ---

async function verifyWellKnown(
  domain: string,
  repoOwner: string
): Promise<VerifiedIdentity[]> {
  try {
    // Note: This relies on the server having CORS enabled.
    const res = await fetch(`https://${domain}/.well-known/forkflirt.json`);
    if (!res.ok) return [];

    const json = await res.json();

    if (
      json.forkflirt_verify &&
      json.forkflirt_verify.toLowerCase() === repoOwner.toLowerCase()
    ) {
      return [
        {
          provider: "well-known",
          handleOrDomain: domain,
          proofUrl: `https://${domain}/.well-known/forkflirt.json`,
        },
      ];
    }
  } catch (e) {
    // Expected to fail often due to CORS
    // console.debug('Well-Known check failed (likely CORS)', e);
  }
  return [];
}
