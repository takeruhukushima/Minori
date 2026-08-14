import { rkeyFromUri } from "./atproto";
import { NSID } from "./lexicons";
import { listAllRecords, Repo } from "./repo";
import { specificLanguageTag } from "./languageText";

export interface MigrationCandidate {
  id: string;
  uri: string;
  collection: string;
  path: string;
  sourcePath: string;
  value: string;
  mode: "text" | "keyword" | "relabel";
}

export interface MigrationRecord {
  uri: string;
  cid: string;
  collection: string;
  value: Record<string, unknown>;
}

export interface MigrationScan {
  records: MigrationRecord[];
  candidates: MigrationCandidate[];
  staleReferences: number;
}

export interface MigrationResult {
  migrated: number;
  repaired: number;
  unresolvedReferences: number;
}

interface FieldRule {
  path: string;
  mode?: "text" | "keyword";
  targetPath?: string;
}

export const MIGRATION_COLLECTIONS = [
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
  NSID.dossier,
  NSID.attestation,
] as const;

const ORG = ["name", "department"];
const PERSON = ["name", ...ORG.map((field) => `affiliation.${field}`)];

const RULES: Record<string, FieldRule[]> = {
  [NSID.profile]: rules(
    ["displayName", "nativeName", "namePreferredCitation", "pronouns", "headline", "bio"],
    ORG.map((field) => `primaryAffiliation.${field}`),
    ["researchFields[].label", "websites[].label", "degrees[].name"],
    ORG.map((field) => `degrees[].institution.${field}`),
    [{ path: "keywords[]", mode: "keyword" }],
  ),
  [NSID.education]: rules(
    ["degreeName", "fieldOfStudy", "thesisTitle", "honors"],
    ORG.map((field) => `institution.${field}`),
    PERSON.map((field) => `advisors[].${field}`),
  ),
  [NSID.authorship]: rules(["authorNameUsed", "note"]),
  [NSID.presentation]: rules(
    ["title", "eventName", "eventSeries", "eventEdition", "place", "abstractText"],
    ORG.map((field) => `host.${field}`),
    PERSON.map((field) => `coPresenters[].${field}`),
  ),
  [NSID.grant]: rules(
    ["title", "programName"],
    ORG.flatMap((field) => [`funder.${field}`, `hostInstitution.${field}`, `partnerOrganizations[].${field}`]),
    PERSON.map((field) => `collaborators[].${field}`),
    ["fieldCodes[].label"],
  ),
  [NSID.award]: rules(
    ["name", "category", "selectionPool", "description"],
    ORG.map((field) => `conferredBy.${field}`),
    PERSON.map((field) => `coRecipients[].${field}`),
  ),
  [NSID.service]: rules(["venue", "roleTitle", "note"], ORG.map((field) => `venueOrg.${field}`)),
  [NSID.membership]: rules(ORG.map((field) => `organization.${field}`)),
  [NSID.teaching]: rules(["courseName", "term", "description"], ORG.map((field) => `institution.${field}`)),
  [NSID.supervision]: rules(
    ["thesisTitle"],
    ORG.map((field) => `institution.${field}`),
    PERSON.flatMap((field) => [`student.${field}`, `coSupervisors[].${field}`]),
  ),
  [NSID.patent]: rules(
    ["title"],
    PERSON.map((field) => `inventors[].${field}`),
    ORG.map((field) => `applicants[].${field}`),
  ),
  [NSID.outreach]: rules(
    ["title", "mediaOutlet", "place", "description"],
    ORG.map((field) => `organizer.${field}`),
  ),
  [NSID.work]: rules(
    ["title", "role", "place", "description"],
    ORG.map((field) => `organization.${field}`),
    PERSON.map((field) => `coCreators[].${field}`),
  ),
  [NSID.openSourceContribution]: rules(
    ["name", "description"],
    [{ path: "highlights[]", mode: "keyword" }],
  ),
  [NSID.reference]: rules(
    [
      "title", "shortTitle", "containerTitle", "containerTitleShort", "collectionTitle", "publisher",
      "publisherPlace", "edition", "genre", "event", "eventPlace", "abstract", "note",
    ],
    ["contributors[].family", "contributors[].given", "contributors[].suffix", "contributors[].droppingParticle", "contributors[].nonDroppingParticle", "contributors[].literal", "contributors[].latinized"],
    [{ path: "originalTitle", targetPath: "title" }, { path: "keywords[]", mode: "keyword" }],
  ),
  [NSID.collection]: rules(["name", "description", "targetVenue"]),
  [NSID.collectionItem]: rules(["note"]),
  [NSID.readingStatus]: rules(["note"]),
  [NSID.dossier]: rules(["name", "headerNote", "sections[].title"]),
  [NSID.attestation]: rules(["attesterRole", "statement"]),
};

function rules(...groups: (string[] | FieldRule[])[]): FieldRule[] {
  return groups.flat().map((rule) => typeof rule === "string" ? { path: rule } : rule);
}

export async function scanLegacyRecords(repo: Repo): Promise<MigrationScan> {
  const records: MigrationRecord[] = [];
  const candidates: MigrationCandidate[] = [];
  for (const collection of MIGRATION_COLLECTIONS) {
    let listed;
    try {
      listed = await listAllRecords(repo, collection);
    } catch (error) {
      throw new Error(`Could not scan ${collection}: ${error instanceof Error ? error.message : String(error)}`);
    }
    for (const record of listed) {
      const migrationRecord = { ...record, collection, value: record.value as Record<string, unknown> };
      records.push(migrationRecord);
      for (const rule of RULES[collection] ?? []) {
        for (const match of findStrings(record.value, rule.path)) {
          candidates.push({
            id: `${record.uri}#${match.path}`,
            uri: record.uri,
            collection,
            path: concreteTargetPath(match.path, rule.path, rule.targetPath),
            sourcePath: match.path,
            value: match.value,
            mode: rule.mode ?? "text",
          });
        }
        if (rule.path !== "originalTitle") {
          for (const match of findUndVariants(record.value, rule)) {
            candidates.push({
              id: `${record.uri}#${match.path}`,
              uri: record.uri,
              collection,
              path: match.path,
              sourcePath: match.path,
              value: match.value,
              mode: "relabel",
            });
          }
        }
      }
    }
  }
  const cidByUri = new Map(records.map((record) => [record.uri, record.cid]));
  const staleReferences = records.reduce((count, record) => (
    count + (record.collection === NSID.attestation ? 0 : countStaleStrongRefs(record.value, cidByUri))
  ), 0);
  return { records, candidates, staleReferences };
}

export function buildMigratedRecords(
  scan: MigrationScan,
  languages: Record<string, string>,
): MigrationRecord[] {
  const byUri = new Map<string, MigrationRecord>();
  for (const candidate of scan.candidates) {
    const language = specificLanguageTag(languages[candidate.id] ?? "");
    if (!language) throw new Error(`Language is required for ${candidate.id}`);
    const source = scan.records.find((record) => record.uri === candidate.uri);
    if (!source) throw new Error(`Record not found for ${candidate.uri}`);
    let target = byUri.get(candidate.uri);
    if (!target) {
      target = { ...source, value: structuredClone(source.value) };
      byUri.set(candidate.uri, target);
    }
    const variant = { language, value: candidate.value };
    if (candidate.mode === "relabel") {
      const arrayPath = candidate.path.split(".").slice(0, -2).join(".");
      const variants = getPath(target.value, arrayPath);
      if (Array.isArray(variants) && variants.some((item) => {
        if (typeof item?.language !== "string") return false;
        try { return specificLanguageTag(item.language) === language; } catch { return false; }
      })) {
        throw new Error(`${arrayPath} already has a ${language} variant`);
      }
      setPath(target.value, candidate.path, language);
    } else if (candidate.mode === "keyword") {
      setPath(target.value, candidate.path, { variants: [variant] });
    } else if (candidate.sourcePath !== candidate.path) {
      const existing = getPath(target.value, candidate.path);
      const variants = Array.isArray(existing) ? existing : typeof existing === "string" ? [] : [];
      setPath(target.value, candidate.path, [...variants, variant]);
      deletePath(target.value, candidate.sourcePath);
    } else {
      setPath(target.value, candidate.path, [variant]);
    }
  }
  return [...byUri.values()];
}

export async function applyMigration(
  repo: Repo,
  scan: MigrationScan,
  languages: Record<string, string>,
): Promise<MigrationResult> {
  const migratedRecords = buildMigratedRecords(scan, languages);
  const cidByUri = new Map(scan.records.map((record) => [record.uri, record.cid]));
  for (const record of migratedRecords) {
    const written = await repo.putRecord(record.collection, rkeyFromUri(record.uri), record.value, record.cid);
    const verified = await repo.getRecord(record.collection, rkeyFromUri(record.uri));
    if (verified.cid && verified.cid !== written.cid) throw new Error(`Read-after-write verification failed for ${record.uri}`);
    cidByUri.set(record.uri, written.cid);
  }

  const migratedByUri = new Map(migratedRecords.map((record) => [record.uri, record.value]));
  const pending = scan.records.map((record) => ({
    ...record,
    value: structuredClone(migratedByUri.get(record.uri) ?? record.value),
  }));
  const repairedResult = await repairStrongRefs(repo, pending, cidByUri);
  return { migrated: migratedRecords.length, ...repairedResult };
}

export async function repairCurrentStrongRefs(repo: Repo): Promise<Pick<MigrationResult, "repaired" | "unresolvedReferences">> {
  const scan = await scanLegacyRecords(repo);
  return repairStrongRefs(repo, scan.records.map((record) => ({ ...record, value: structuredClone(record.value) })), new Map(scan.records.map((record) => [record.uri, record.cid])));
}

async function repairStrongRefs(
  repo: Repo,
  pending: MigrationRecord[],
  cidByUri: Map<string, string>,
): Promise<Pick<MigrationResult, "repaired" | "unresolvedReferences">> {
  let repaired = 0;
  for (let pass = 0; pass < 5; pass += 1) {
    let changedThisPass = 0;
    for (const record of pending) {
      if (record.collection === NSID.attestation) continue;
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

  const unresolvedReferences = pending.reduce((count, record) => (
    count + (record.collection === NSID.attestation ? 0 : countStaleStrongRefs(record.value, cidByUri))
  ), 0);
  return { repaired, unresolvedReferences };
}

function findStrings(value: unknown, pattern: string): { path: string; value: string }[] {
  const parts = pattern.split(".");
  const matches: { path: string; value: string }[] = [];
  function visit(current: unknown, index: number, path: string[]) {
    if (index === parts.length) {
      if (typeof current === "string" && current.trim()) matches.push({ path: path.join("."), value: current });
      return;
    }
    if (!current || typeof current !== "object") return;
    const part = parts[index];
    if (part.endsWith("[]")) {
      const key = part.slice(0, -2);
      const array = (current as Record<string, unknown>)[key];
      if (!Array.isArray(array)) return;
      array.forEach((item, itemIndex) => visit(item, index + 1, [...path, key, String(itemIndex)]));
    } else {
      visit((current as Record<string, unknown>)[part], index + 1, [...path, part]);
    }
  }
  visit(value, 0, []);
  return matches;
}

function findUndVariants(value: unknown, rule: FieldRule): { path: string; value: string }[] {
  const matches: { path: string; value: string }[] = [];
  for (const endpoint of findPatternValues(value, rule.path)) {
    const variants = rule.mode === "keyword"
      ? (endpoint.value as { variants?: unknown } | null)?.variants
      : endpoint.value;
    if (!Array.isArray(variants)) continue;
    variants.forEach((item, index) => {
      const itemLanguage = item && typeof item === "object" && typeof (item as any).language === "string"
        ? (item as any).language.toLowerCase().split("-")[0]
        : "";
      if (itemLanguage === "und" && typeof (item as any).value === "string") {
        const prefix = rule.mode === "keyword" ? `${endpoint.path}.variants` : endpoint.path;
        matches.push({ path: `${prefix}.${index}.language`, value: (item as any).value });
      }
    });
  }
  return matches;
}

function findPatternValues(value: unknown, pattern: string): { path: string; value: unknown }[] {
  const parts = pattern.split(".");
  const matches: { path: string; value: unknown }[] = [];
  function visit(current: unknown, index: number, path: string[]) {
    if (index === parts.length) {
      matches.push({ path: path.join("."), value: current });
      return;
    }
    if (!current || typeof current !== "object") return;
    const part = parts[index];
    if (part.endsWith("[]")) {
      const key = part.slice(0, -2);
      const array = (current as Record<string, unknown>)[key];
      if (!Array.isArray(array)) return;
      array.forEach((item, itemIndex) => visit(item, index + 1, [...path, key, String(itemIndex)]));
    } else {
      visit((current as Record<string, unknown>)[part], index + 1, [...path, part]);
    }
  }
  visit(value, 0, []);
  return matches;
}

function concreteTargetPath(concrete: string, sourcePattern: string, targetPattern?: string): string {
  if (!targetPattern) return concrete;
  const sourceRoot = sourcePattern.split(".")[0];
  const targetRoot = targetPattern.split(".")[0];
  return concrete === sourceRoot ? targetRoot : concrete.replace(`${sourceRoot}.`, `${targetRoot}.`);
}

function pathParts(path: string): (string | number)[] {
  return path.split(".").map((part) => /^\d+$/.test(part) ? Number(part) : part);
}

function getPath(root: unknown, path: string): unknown {
  return pathParts(path).reduce<unknown>((value, part) => (
    value && typeof value === "object" ? (value as Record<string | number, unknown>)[part] : undefined
  ), root);
}

function setPath(root: unknown, path: string, value: unknown): void {
  const parts = pathParts(path);
  const key = parts.pop();
  const parent = parts.reduce<any>((current, part) => current[part], root);
  parent[key as string | number] = value;
}

function deletePath(root: unknown, path: string): void {
  const parts = pathParts(path);
  const key = parts.pop();
  const parent = parts.reduce<any>((current, part) => current[part], root);
  if (Array.isArray(parent) && typeof key === "number") parent.splice(key, 1);
  else delete parent[key as string];
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
