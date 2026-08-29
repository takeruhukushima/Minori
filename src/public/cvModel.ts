// Framework-agnostic fetch + normalization for the public CV. Both the SPA
// (via useCvData) and the Astro static build call these pure functions, so the
// two renderings are guaranteed to agree. Reuses listAllRecords (pagination)
// and rkeyFromUri from the existing repo/atproto layer.

import { rkeyFromUri } from "../atproto";
import { listAllRecords, type Repo } from "../repo";
import { NSID } from "../lexicons";
import { PublicRepo } from "./publicClient";
import { GENERIC_CV_NSIDS } from "./collections";

export interface RawRecord {
  uri: string;
  cid: string;
  value: any;
}

export type CollectionStatus = "loading" | "ok" | "error";

export interface CollectionResult {
  status: CollectionStatus;
  records: RawRecord[];
  error?: string;
}

// One authorship claim joined to its bibliographic reference (may be null if
// the reference record could not be loaded).
export interface PublicationEntry {
  authorship: RawRecord;
  reference: RawRecord | null;
}

// A project (pub.paper.collection) with its member references, ordered.
export interface ProjectEntry {
  collection: RawRecord;
  items: { item: RawRecord; reference: RawRecord | null }[];
}

// --- profile & avatar -------------------------------------------------------

export async function fetchProfile(repo: Repo): Promise<RawRecord | null> {
  try {
    return await repo.getRecord(NSID.profile, "self");
  } catch {
    return null; // no profile record = not a Minori participant; caller decides
  }
}

// The CV lexicon has no photo field; the avatar comes from the account's
// app.bsky.actor.profile blob, served by the PDS sync endpoint.
export async function fetchAvatarUrl(repo: Repo, pds: string): Promise<string | null> {
  try {
    const rec = await repo.getRecord("app.bsky.actor.profile", "self");
    const cid = rec.value?.avatar?.ref?.$link ?? rec.value?.avatar?.ref?.toString?.();
    if (!cid) return null;
    return `${pds.replace(/\/+$/, "")}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(repo.did)}&cid=${encodeURIComponent(cid)}`;
  } catch {
    return null;
  }
}

// --- generic collection fetch ----------------------------------------------

export async function fetchCollection(repo: Repo, nsid: string): Promise<CollectionResult> {
  try {
    const records = await listAllRecords(repo, nsid);
    return { status: "ok", records };
  } catch (e) {
    return { status: "error", records: [], error: (e as Error).message };
  }
}

// --- publications (authorship -> reference) --------------------------------

export async function buildPublications(
  repo: Repo,
  authorshipRecords: RawRecord[],
): Promise<PublicationEntry[]> {
  return Promise.all(
    authorshipRecords.map(async (authorship) => {
      const uri = authorship.value?.reference?.uri;
      if (!uri) return { authorship, reference: null };
      try {
        const reference = await repo.getRecord(NSID.reference, rkeyFromUri(uri));
        return { authorship, reference };
      } catch {
        return { authorship, reference: null };
      }
    }),
  );
}

// Publication sort: featured first, then by issued year descending.
export function sortPublications(entries: PublicationEntry[]): PublicationEntry[] {
  return [...entries].sort((a, b) => {
    const fa = a.authorship.value?.isFeatured ? 1 : 0;
    const fb = b.authorship.value?.isFeatured ? 1 : 0;
    if (fa !== fb) return fb - fa;
    return issuedYear(b.reference) - issuedYear(a.reference);
  });
}

function issuedYear(reference: RawRecord | null): number {
  const y = reference?.value?.issued?.year;
  return typeof y === "number" ? y : 0;
}

// --- projects (collection + collectionItem + reference) --------------------

export function buildProjects(
  collections: RawRecord[],
  items: RawRecord[],
  references: RawRecord[],
): ProjectEntry[] {
  const refByUri = new Map(references.map((r) => [r.uri, r]));
  return collections.map((collection) => {
    const members = items
      .filter((it) => it.value?.collection?.uri === collection.uri)
      .sort(compareBySortKey);
    return {
      collection,
      items: members.map((item) => ({
        item,
        reference: item.value?.reference?.uri ? refByUri.get(item.value.reference.uri) ?? null : null,
      })),
    };
  });
}

// Respect the collectionItem fractional-index sortKey when present; otherwise
// fall back to reference issued-year descending is applied by the caller.
function compareBySortKey(a: RawRecord, b: RawRecord): number {
  const sa = a.value?.sortKey;
  const sb = b.value?.sortKey;
  if (sa && sb) return sa < sb ? -1 : sa > sb ? 1 : 0;
  if (sa) return -1;
  if (sb) return 1;
  return 0;
}

// --- one-shot loader for the Astro static build ----------------------------

export interface LoadedCv {
  did: string;
  handle: string;
  profile: RawRecord | null;
  avatar: string | null;
  collections: Record<string, CollectionResult>;
  publications: PublicationEntry[];
  publicationsStatus: CollectionStatus;
  projects: ProjectEntry[];
}

// Fetch the entire CV model up front. Used at Astro build time; identity
// failures propagate so a broken build fails rather than deploying an empty CV
// (requirement 10, self-host build). Per-collection read errors are captured in
// each CollectionResult rather than thrown, matching the SPA's partial-failure
// tolerance.
export async function loadCvModel(handleOrDid: string): Promise<LoadedCv> {
  const repo = await PublicRepo.fromHandle(handleOrDid);
  const [profile, avatar] = await Promise.all([
    fetchProfile(repo),
    fetchAvatarUrl(repo, repo.pds),
  ]);

  const collectionEntries = await Promise.all(
    GENERIC_CV_NSIDS.map(async (nsid) => [nsid, await fetchCollection(repo, nsid)] as const),
  );
  const collections = Object.fromEntries(collectionEntries) as Record<string, CollectionResult>;

  const claims = await fetchCollection(repo, NSID.authorship);
  const publications =
    claims.status === "ok" ? sortPublications(await buildPublications(repo, claims.records)) : [];

  const [cols, items, refs] = await Promise.all([
    fetchCollection(repo, NSID.collection),
    fetchCollection(repo, NSID.collectionItem),
    fetchCollection(repo, NSID.reference),
  ]);
  const projects =
    cols.status === "ok" ? buildProjects(cols.records, items.records, refs.records) : [];

  return {
    did: repo.did,
    handle: handleOrDid,
    profile,
    avatar,
    collections,
    publications,
    publicationsStatus: claims.status,
    projects,
  };
}
