// URL/text safety for the public CV view. Record values come from a PDS and
// are public but externally authored, so any URL rendered as a link must be
// checked (requirement 14: reject javascript: and other dangerous schemes).

const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

// Returns a safe href, or null if the URL uses a disallowed scheme / is junk.
export function safeUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return SAFE_SCHEMES.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

// Normalize a DOI (bare or URL) into a canonical https://doi.org/ link.
export function doiUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const doi = input
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "");
  if (!doi || !doi.startsWith("10.")) return null;
  return `https://doi.org/${encodeURI(doi)}`;
}

// Canonical ORCID URL from a bare iD or URL.
export function orcidUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const id = input.trim().replace(/^https?:\/\/orcid\.org\//i, "");
  if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(id)) return null;
  return `https://orcid.org/${id.toUpperCase()}`;
}

// The rel attribute for every external link (requirement 14).
export const EXTERNAL_LINK_REL = "noopener noreferrer nofollow";
