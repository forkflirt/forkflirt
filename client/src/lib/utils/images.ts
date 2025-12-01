// --- Configuration ---

const GITHUB_RAW_BASE = "https://raw.githubusercontent.com";
const ALLOWED_HOSTS = [
  'raw.githubusercontent.com',
  'placehold.co',
  'cdn.jsdelivr.net'
];
const ALLOWED_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg)$/i;

// --- URL Validation ---

function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Check hostname
    if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
      return false;
    }

    // Check file extension
    if (!ALLOWED_EXTENSIONS.test(parsed.pathname)) {
      return false;
    }

    // Check for suspicious patterns
    if (parsed.pathname.includes('../') || parsed.pathname.includes('..\\')) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function sanitizePath(path: string): string {
  // Remove path traversal attempts
  return path.replace(/\.\./g, '').replace(/\\/g, '');
}

// --- Resolver ---

/**
 * Transforms a relative asset path into a fully qualified GitHub Raw URL.
 *
 * @param path The path from profile.json (e.g. "./assets/me.jpg")
 * @param username The repo owner (e.g. "travofoz")
 * @param repo The repo name (e.g. "forkflirt")
 */
export function resolveAssetUrl(
  path: string,
  username: string,
  repo: string
): string {
  if (!path) return "";

  // 1. If it's already a full URL, validate it
  if (path.startsWith("http://") || path.startsWith("https://")) {
    if (!isValidImageUrl(path)) {
      console.warn("Blocked invalid external URL:", path);
      return ""; // Return empty for invalid URLs
    }
    return path;
  }

  // 2. Clean and validate path
  const cleanPath = sanitizePath(path.replace(/^(\.\/|\/)/, ""));

  if (!cleanPath || cleanPath.includes('javascript:') || cleanPath.includes('data:')) {
    console.warn("Blocked malicious path:", path);
    return "";
  }

  // 3. Construct Raw URL
  return `${GITHUB_RAW_BASE}/${username}/${repo}/main/profile/${cleanPath}`;
}

// --- Fallback Handler ---

/**
 * Svelte Action to handle broken images.
 * Usage: <img use:fallback src="..." />
 */
export function fallback(node: HTMLImageElement) {
  const handleError = () => {
    // Replace with a generic "Missing" placeholder
    // We can use a data URI or a reliable public placeholder
    node.src = "https://placehold.co/400x600/1a1a1a/FFF?text=Image+Not+Found";
    node.alt = "Image failed to load";
  };

  node.addEventListener("error", handleError);

  return {
    destroy() {
      node.removeEventListener("error", handleError);
    },
  };
}
