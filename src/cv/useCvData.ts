// SPA-only orchestration hook for the public CV. Resolves identity, fetches
// profile + current position first (priority), then every other collection in
// parallel, updating per-collection status so the view can render
// progressively and tolerate partial failures (requirements 10, 12, 15).
// Astro does not use this hook; it calls the pure cvModel functions at build.

import { useEffect, useState } from "react";
import { PublicRepo } from "../public/publicClient";
import { IdentityError } from "../public/identity";
import { NSID } from "../lexicons";
import {
  buildProjects,
  buildPublications,
  fetchAvatarUrl,
  fetchCollection,
  fetchProfile,
  sortPublications,
  type CollectionResult,
  type ProjectEntry,
  type PublicationEntry,
  type RawRecord,
} from "../public/cvModel";

// Collections rendered as generic CV sections, in public display order.
// The canonical list lives in the framework-agnostic collections module so the
// Astro static build can share it; re-exported here for the SPA.
export { GENERIC_CV_NSIDS as GENERIC_SECTION_NSIDS } from "../public/collections";
import { GENERIC_CV_NSIDS as GENERIC_SECTION_NSIDS } from "../public/collections";

export type OverallStatus = "resolving" | "loading" | "ready" | "notFound" | "error";

export interface CvData {
  status: OverallStatus;
  error: string | null;
  did: string | null;
  profile: RawRecord | null;
  avatar: string | null;
  collections: Record<string, CollectionResult>;
  publications: PublicationEntry[];
  publicationsStatus: CollectionResult["status"];
  projects: ProjectEntry[];
  projectsStatus: CollectionResult["status"];
  retry: () => void;
}

const loadingResult: CollectionResult = { status: "loading", records: [] };

export function useCvData(handleOrDid: string): CvData {
  const [status, setStatus] = useState<OverallStatus>("resolving");
  const [error, setError] = useState<string | null>(null);
  const [did, setDid] = useState<string | null>(null);
  const [profile, setProfile] = useState<RawRecord | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [collections, setCollections] = useState<Record<string, CollectionResult>>({});
  const [publications, setPublications] = useState<PublicationEntry[]>([]);
  const [publicationsStatus, setPublicationsStatus] = useState<CollectionResult["status"]>("loading");
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [projectsStatus, setProjectsStatus] = useState<CollectionResult["status"]>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const set = (fn: () => void) => {
      if (!cancelled) fn();
    };

    (async () => {
      setStatus("resolving");
      setError(null);
      setCollections(
        Object.fromEntries(GENERIC_SECTION_NSIDS.map((n) => [n, loadingResult])),
      );
      setPublicationsStatus("loading");
      setProjectsStatus("loading");

      let repo: PublicRepo;
      try {
        repo = await PublicRepo.fromHandle(handleOrDid);
      } catch (e) {
        set(() => {
          setStatus("error");
          setError(
            e instanceof IdentityError
              ? e.message
              : `Could not resolve identity: ${(e as Error).message}`,
          );
        });
        return;
      }
      if (cancelled) return;
      set(() => setDid(repo.did));

      // Priority: profile + current position for a fast first paint.
      const [prof, avatarUrl] = await Promise.all([
        fetchProfile(repo),
        fetchAvatarUrl(repo, repo.pds),
      ]);
      set(() => {
        setProfile(prof);
        setAvatar(avatarUrl);
        setStatus(prof ? "ready" : "notFound");
      });

      // Everything else in parallel; each updates independently.
      for (const nsid of GENERIC_SECTION_NSIDS) {
        fetchCollection(repo, nsid).then((result) =>
          set(() => setCollections((prev) => ({ ...prev, [nsid]: result }))),
        );
      }

      // Publications: authorship -> reference.
      fetchCollection(repo, NSID.authorship).then(async (claims) => {
        if (claims.status === "error") {
          set(() => setPublicationsStatus("error"));
          return;
        }
        const entries = await buildPublications(repo, claims.records);
        set(() => {
          setPublications(sortPublications(entries));
          setPublicationsStatus("ok");
        });
      });

      // Projects: collection + collectionItem + reference.
      Promise.all([
        fetchCollection(repo, NSID.collection),
        fetchCollection(repo, NSID.collectionItem),
        fetchCollection(repo, NSID.reference),
      ]).then(([cols, items, refs]) => {
        if (cols.status === "ok") {
          set(() => {
            setProjects(buildProjects(cols.records, items.records, refs.records));
            setProjectsStatus("ok");
          });
        } else {
          set(() => setProjectsStatus("error"));
        }
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [handleOrDid, attempt]);

  return {
    status,
    error,
    did,
    profile,
    avatar,
    collections,
    publications,
    publicationsStatus,
    projects,
    projectsStatus,
    retry: () => setAttempt((a) => a + 1),
  };
}
