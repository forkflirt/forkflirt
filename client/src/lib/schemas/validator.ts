import Ajv from "ajv";
import addFormats from "ajv-formats";
import profileSchema from "../../../../protocol/schemas/profile.schema.json";

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
});
addFormats(ajv);

const _validate = ajv.compile(profileSchema);

export function validateProfile(data: any) {
  const valid = _validate(data);
  return {
    valid,
    errors: _validate.errors,
  };
}

export const SchemaDefinition = profileSchema;
