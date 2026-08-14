import { Agent } from "@atproto/api";
import { readFile, writeFile } from "node:fs/promises";
import { applyMigration, buildMigratedRecords, scanLegacyRecords } from "../src/migration.ts";
import { AgentRepo } from "../src/repo.ts";

const args = new Set(process.argv.slice(2));
const valueOf = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const identifier = process.env.MINORI_IDENTIFIER;
const password = process.env.MINORI_APP_PASSWORD;
const service = process.env.MINORI_PDS ?? "https://bsky.social";
const language = valueOf("--language");
const planPath = valueOf("--plan");
const output = valueOf("--output") ?? `minori-language-migration-${Date.now()}.json`;
const shouldApply = args.has("--apply");

if (!identifier || !password) {
  throw new Error("Set MINORI_IDENTIFIER and MINORI_APP_PASSWORD. Do not pass credentials as command arguments.");
}

const agent = new Agent({ service });
await agent.login({ identifier, password });
const repo = new AgentRepo(agent);
const scan = await scanLegacyRecords(repo);

if (!scan.candidates.length && !scan.staleReferences) {
  console.log("No legacy fields remain. Migration is complete.");
  process.exit(0);
}
const reviewedPlan = planPath ? JSON.parse(await readFile(planPath, "utf8")) : null;
const languages: Record<string, string> = reviewedPlan?.languages
  ?? Object.fromEntries(scan.candidates.map((candidate) => [candidate.id, language ?? ""]));
const allAssigned = scan.candidates.every((candidate) => languages[candidate.id]?.trim());
const preview = allAssigned ? buildMigratedRecords(scan, languages) : [];
await writeFile(output, JSON.stringify({
  exportedAt: new Date().toISOString(),
  did: repo.did,
  languages,
  sourceRecords: scan.records,
  candidates: scan.candidates,
  preview,
}, null, 2));
console.log(`Wrote backup and migration preview to ${output}.`);

if (!shouldApply) {
  console.log("Dry run only. Review and edit the languages map, then rerun with --apply --plan <file>.");
  process.exit(0);
}

if (!allAssigned) throw new Error("Every candidate must have an explicit BCP-47 tag in the reviewed plan before --apply.");

const result = await applyMigration(repo, scan, languages);
console.log(`Migrated ${result.migrated} records; repaired ${result.repaired} StrongRefs.`);
if (result.unresolvedReferences) {
  throw new Error(`${result.unresolvedReferences} StrongRefs remain unresolved. Rerun the scan after reviewing the backup.`);
}
