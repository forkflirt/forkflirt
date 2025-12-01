// --- Configuration ---

const GITHUB_RAW_BASE = "https://raw.githubusercontent.com";

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

  // 1. If it's already a full URL, return it
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  // 2. Clean the path
  // Remove leading './' or '/'
  const cleanPath = path.replace(/^(\.\/|\/)/, "");

  // 3. Construct Raw URL
  // Structure: https://raw.githubusercontent.com/{user}/{repo}/main/profile/{path}
  // Note: We assume 'main' branch. v1.5 might need branch detection if we get fancy.
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
