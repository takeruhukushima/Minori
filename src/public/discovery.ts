import { fetchProfile, type RawRecord } from "./cvModel";
import { PublicRepo } from "./publicClient";

const ACTOR_SEARCH = "https://public.api.bsky.app/xrpc/app.bsky.actor.searchActors";

interface ActorSearchResult {
  actors?: {
    did: string;
    handle: string;
    displayName?: string;
    description?: string;
    avatar?: string;
  }[];
}

export interface MinoriUser {
  did: string;
  handle: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  profile: RawRecord;
}

// Bluesky supplies candidate identities; checking id.career.profile on each
// user's PDS ensures the results are actual Minori public CVs.
export async function searchMinoriUsers(query: string, limit = 12): Promise<MinoriUser[]> {
  const q = query.trim();
  if (!q) return [];
  const url = new URL(ACTOR_SEARCH);
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(limit));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Account search failed (${response.status})`);
  const data = await response.json() as ActorSearchResult;

  const checked = await Promise.all((data.actors ?? []).map(async (actor): Promise<MinoriUser | null> => {
    try {
      const repo = await PublicRepo.fromHandle(actor.did);
      const profile = await fetchProfile(repo);
      return profile ? { ...actor, profile } : null;
    } catch {
      return null;
    }
  }));
  return checked.filter((user): user is MinoriUser => user !== null);
}
