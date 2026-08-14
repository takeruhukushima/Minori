import { rkeyFromUri } from "./atproto";
import { NSID } from "./lexicons";
import { listAllRecords, Repo } from "./repo";

interface RepoRecord {
  uri: string;
  cid: string;
  collection: string;
  value: Record<string, unknown>;
}

export interface StrongRefRepairResult {
  repaired: number;
  unresolvedReferences: number;
}

const LINKED_COLLECTIONS = [
  NSID.profile,
  NSID.education,
  NSID.authorship,
  NSID.presentation,
  NSID.grant,
  NSID.award,
  NSID.service,
  NSID.membership,
  NSID.teaching,
  NSID.supervision,
  NSID.patent,
  NSID.outreach,
  NSID.work,
  NSID.openSourceContribution,
  NSID.reference,
  NSID.collection,
  NSID.collectionItem,
  NSID.readingStatus,
] as const;

export async function repairCurrentStrongRefs(repo: Repo): Promise<StrongRefRepairResult> {
  const records: RepoRecord[] = [];
  for (const collection of LINKED_COLLECTIONS) {
    let listed;
    try {
      listed = await listAllRecords(repo, collection);
    } catch (error) {
      throw new Error(`Could not scan ${collection}: ${error instanceof Error ? error.message : String(error)}`);
    }
    records.push(...listed.map((record) => ({ ...record, collection, value: record.value as Record<string, unknown> })));
  }

  const cidByUri = new Map(records.map((record) => [record.uri, record.cid]));
  let repaired = 0;
  for (let pass = 0; pass < 5; pass += 1) {
    let changedThisPass = 0;
    for (const record of records) {
      const replacement = replaceStrongRefs(record.value, cidByUri);
      if (!replacement.changed) continue;
      const expectedCid = cidByUri.get(record.uri) ?? record.cid;
      const written = await repo.putRecord(record.collection, rkeyFromUri(record.uri), replacement.value, expectedCid);
      const verified = await repo.getRecord(record.collection, rkeyFromUri(record.uri));
      if (verified.cid && verified.cid !== written.cid) throw new Error(`StrongRef read-after-write verification failed for ${record.uri}`);
      record.value = replacement.value;
      cidByUri.set(record.uri, written.cid);
      repaired += 1;
      changedThisPass += 1;
    }
    if (!changedThisPass) break;
  }

  const unresolved = records.reduce((count, record) => count + countStaleStrongRefs(record.value, cidByUri), 0);
  if (unresolved) console.warn(`${unresolved} StrongRefs remain stale after repair`);
  return { repaired, unresolvedReferences: unresolved };
}

function replaceStrongRefs(value: unknown, cidByUri: Map<string, string>): { value: any; changed: boolean } {
  if (Array.isArray(value)) {
    let changed = false;
    const array = value.map((item) => {
      const replaced = replaceStrongRefs(item, cidByUri);
      changed ||= replaced.changed;
      return replaced.value;
    });
    return { value: array, changed };
  }
  if (!value || typeof value !== "object") return { value, changed: false };
  const record = value as Record<string, unknown>;
  if (typeof record.uri === "string" && typeof record.cid === "string") {
    const cid = cidByUri.get(record.uri);
    if (cid && cid !== record.cid) return { value: { ...record, cid }, changed: true };
  }
  let changed = false;
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(record)) {
    const replaced = replaceStrongRefs(child, cidByUri);
    output[key] = replaced.value;
    changed ||= replaced.changed;
  }
  return { value: output, changed };
}

function countStaleStrongRefs(value: unknown, cidByUri: Map<string, string>): number {
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + countStaleStrongRefs(item, cidByUri), 0);
  if (!value || typeof value !== "object") return 0;
  const record = value as Record<string, unknown>;
  const own = typeof record.uri === "string" && typeof record.cid === "string"
    && cidByUri.has(record.uri) && cidByUri.get(record.uri) !== record.cid ? 1 : 0;
  return own + Object.values(record).reduce<number>((sum, item) => sum + countStaleStrongRefs(item, cidByUri), 0);
}
