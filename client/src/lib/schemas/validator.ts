import Ajv from "ajv";
import addFormats from "ajv-formats";
import DOMPurify from 'dompurify';
import profileSchema from "../../../../protocol/schemas/profile.schema.json";

// --- Input Sanitization ---

const SANITIZATION_CONFIG = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u'],
  ALLOWED_ATTR: ['class'],
  ALLOW_DATA_ATTR: false
};

function sanitizeUserInput(input: string): string {
  if (typeof input !== 'string') return input;
  const sanitized = DOMPurify.sanitize(input, SANITIZATION_CONFIG);
  return sanitizeUrls(sanitized);
}

function sanitizeUrls(text: string): string {
  const urlRegex = /https?:\/\/[^\s]+/g;
  return text.replace(urlRegex, (url) => {
    try {
      const parsed = new URL(url);
      // Only allow safe domains
      const allowed = ['github.com', 'twitter.com', 'linkedin.com', 'mastodon.social', 'bluesky.app'];
      if (allowed.some(domain => parsed.hostname === domain || parsed.hostname.endsWith('.' + domain))) {
        return sanitizeQueryParams(url);
      }
      return '[blocked URL]';
    } catch {
      return '[invalid URL]';
    }
  });
}

function sanitizeQueryParams(url: string): string {
  const parsed = new URL(url);
  // Remove dangerous query parameters
  const dangerousParams = ['redirect', 'callback', 'return', 'url', 'token', 'key', 'auth'];
  dangerousParams.forEach(param => parsed.searchParams.delete(param));
  return parsed.toString();
}

function sanitizeProfile(data: any): any {
  if (!data) return data;

  // Sanitize text fields
  if (data.content?.bio) {
    data.content.bio = sanitizeUserInput(data.content.bio);
  }

  if (data.content?.essays) {
    data.content.essays.forEach((essay: { prompt: string; answer: string }) => {
      if (essay.answer) {
        essay.answer = sanitizeUserInput(essay.answer);
      }
    });
  }

  if (data.identity?.display_name) {
    data.identity.display_name = sanitizeUserInput(data.identity.display_name);
  }

  if (data.identity?.pronouns) {
    data.identity.pronouns = sanitizeUserInput(data.identity.pronouns);
  }

  if (data.identity?.gender) {
    data.identity.gender = sanitizeUserInput(data.identity.gender);
  }

  if (data.identity?.orientation) {
    data.identity.orientation = sanitizeUserInput(data.identity.orientation);
  }

  // Sanitize social media handles
  if (data.identity?.social) {
    if (data.identity.social.keybase) {
      data.identity.social.keybase = sanitizeUserInput(data.identity.social.keybase);
    }
    if (data.identity.social.mastodon) {
      data.identity.social.mastodon = sanitizeUserInput(data.identity.social.mastodon);
    }
    if (data.identity.social.bluesky) {
      data.identity.social.bluesky = sanitizeUserInput(data.identity.social.bluesky);
    }
    if (data.identity.social.twitter) {
      data.identity.social.twitter = sanitizeUserInput(data.identity.social.twitter);
    }
    if (data.identity.social.instagram) {
      data.identity.social.instagram = sanitizeUserInput(data.identity.social.instagram);
    }
    if (data.identity.social.discord) {
      data.identity.social.discord = sanitizeUserInput(data.identity.social.discord);
    }
    if (data.identity.social.tiktok) {
      data.identity.social.tiktok = sanitizeUserInput(data.identity.social.tiktok);
    }
    if (data.identity.social.linkedin) {
      data.identity.social.linkedin = sanitizeUserInput(data.identity.social.linkedin);
    }
  }

  // Sanitize location fields
  if (data.identity?.location?.city) {
    data.identity.location.city = sanitizeUserInput(data.identity.location.city);
  }

  // Sanitize details
  if (data.details?.job_title) {
    data.details.job_title = sanitizeUserInput(data.details.job_title);
  }

  if (data.details?.education) {
    data.details.education = sanitizeUserInput(data.details.education);
  }

  return data;
}

// --- Type Definitions ---

export interface Profile {
  meta?: {
    generated_by?: string;
    updated_at?: string;
    version?: string;
  };
  identity: {
    display_name: string;
    pronouns?: string;
    age: number;
    gender?: string;
    orientation?: string;
    location: {
      city: string;
      country_code: string;
      geo_hash?: string;
    };
    social?: {
      keybase?: string;
      mastodon?: string;
      bluesky?: string;
      twitter?: string;
      instagram?: string;
      discord?: string;
      tiktok?: string;
      linkedin?: string;
    };
  };
  details?: {
    height_cm?: number;
    body_type?: string;
    job_title?: string;
    education?: string;
    vices?: {
      smoking?: string;
      drinking?: string;
      drugs?: string;
    };
    lifestyle?: {
      diet?: string;
      kids?: string;
      pets?: string[];
    };
  };
  content: {
    bio?: string;
    essays?: Array<{ prompt: string; answer: string }>;
    images?: Array<{ src: string; alt?: string; caption?: string }>;
    tags?: string[];
    links?: Array<{ label?: string; url: string }>;
  };
  survey?: Array<{
    question_id: string;
    answer_choice: string;
    importance: string;
    acceptable_answers: string[];
  }>;
  security: {
    public_key: string;
    fingerprint?: string;
    key_type?: string;
    signature?: string;
    profile_signature?: string;
    signature_timestamp?: string;
    signature_nonce?: string;
    key_rotation?: {
      current_key: string;
      previous_keys: Array<{
        public_key: string;
        timestamp: string;
        deactivated: string;
        version: number;
      }>;
      rotation_timestamp: string;
      next_rotation?: string;
      rotation_version: number;
    };
  };
  preferences?: {
    looking_for?: string[];
    age_range?: number[];
    distance_km?: number;
    match_filter?: {
      include_tags?: string[];
      exclude_tags?: string[];
    };
  };
}

// --- Validation Logic ---

const ajv = new Ajv({
  allErrors: true,
  coerceTypes: false,
  strict: true,
  strictSchema: true,
  removeAdditional: true,
  useDefaults: false,
});

addFormats(ajv);

const _validate = ajv.compile(profileSchema);

export function validateProfile(data: any) {
  // First sanitize the data
  const sanitizedData = sanitizeProfile(data);

  const valid = _validate(sanitizedData);
  return {
    valid,
    errors: _validate.errors,
    sanitizedData
  };
}

export const SchemaDefinition = profileSchema;
