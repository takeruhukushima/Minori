// Minimal hash router for the public CV view. Deliberately dependency-free to
// match the hand-rolled style of the rest of the app. Grammar (requirement 8.2):
//   #/               -> editor / login (the existing app)
//   #/discover       -> public CV search
//   #/<handle>       -> that researcher's public CV root
//   #/<handle>/<anchor> -> the CV, scrolled to a section
//   #/<handle>/collections/<rkey> -> one literature collection
// Query-style ?handle= URLs are intentionally NOT supported (requirement 22).

import { useEffect, useState } from "react";

export type Route =
  | { kind: "app" }
  | { kind: "discover" }
  | { kind: "cv"; handle: string; anchor: string | null }
  | { kind: "collection"; handle: string; rkey: string };

export function parseHash(hash: string): Route {
  // OAuth responses may use the fragment (for example #state=...&code=...).
  // Only the explicit #/ prefix belongs to the public CV router.
  if (!hash.startsWith("#/")) return { kind: "app" };
  const path = hash.slice(2).replace(/^\/+/, "");
  if (!path) return { kind: "app" };
  const segments = path.split("/").filter(Boolean).map((s) => decodeURIComponent(s));
  const [handle, anchor, rkey] = segments;
  if (!handle) return { kind: "app" };
  if (handle === "discover" && !anchor) return { kind: "discover" };
  if (anchor === "collections" && rkey) return { kind: "collection", handle, rkey };
  return { kind: "cv", handle, anchor: anchor ?? null };
}

export function useHashRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

// Build a public CV hash URL, honoring the Vite base path so it works on
// GitHub Pages (/{base}/#/<handle>) and at the root alike.
export function cvHref(handle: string, anchor?: string): string {
  return hashHref(handle, ...(anchor ? [anchor] : []));
}

export function collectionHref(handle: string, rkey: string): string {
  return hashHref(handle, "collections", rkey);
}

export function discoverHref(): string {
  return hashHref("discover");
}

function hashHref(...segments: string[]): string {
  return buildHashHref(import.meta.env.BASE_URL || "/", ...segments);
}

export function buildHashHref(baseUrl: string, ...segments: string[]): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}/#/${segments.map(encodeURIComponent).join("/")}`;
}
