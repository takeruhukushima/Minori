import { describe, expect, it } from "vitest";
import { applyMigration, buildMigratedRecords, MigrationScan, scanLegacyRecords } from "./migration";
import { Repo } from "./repo";

describe("language variant migration", () => {
  it("converts strings without assigning a preferred language", () => {
    const scan: MigrationScan = {
      records: [{
        uri: "at://did:plc:test/id.career.grant/1",
        cid: "old",
        collection: "id.career.grant",
        value: { title: "研究課題", funder: { name: "日本学術振興会" }, createdAt: "2026-01-01T00:00:00Z" },
      }],
      candidates: [
        { id: "title", uri: "at://did:plc:test/id.career.grant/1", collection: "id.career.grant", path: "title", sourcePath: "title", value: "研究課題", mode: "text" },
        { id: "funder", uri: "at://did:plc:test/id.career.grant/1", collection: "id.career.grant", path: "funder.name", sourcePath: "funder.name", value: "日本学術振興会", mode: "text" },
      ],
      staleReferences: 0,
    };

    const [record] = buildMigratedRecords(scan, { title: "ja", funder: "ja" });
    expect(record.value).toEqual({
      title: [{ language: "ja", value: "研究課題" }],
      funder: { name: [{ language: "ja", value: "日本学術振興会" }] },
      createdAt: "2026-01-01T00:00:00Z",
    });
  });

  it("merges the former original title as an equal title variant", () => {
    const uri = "at://did:plc:test/pub.paper.reference/1";
    const scan: MigrationScan = {
      records: [{ uri, cid: "old", collection: "pub.paper.reference", value: { title: "English", originalTitle: "日本語" } }],
      candidates: [
        { id: "title", uri, collection: "pub.paper.reference", path: "title", sourcePath: "title", value: "English", mode: "text" },
        { id: "original", uri, collection: "pub.paper.reference", path: "title", sourcePath: "originalTitle", value: "日本語", mode: "text" },
      ],
      staleReferences: 0,
    };
    const [record] = buildMigratedRecords(scan, { title: "en", original: "ja" });
    expect(record.value).toEqual({ title: [{ language: "en", value: "English" }, { language: "ja", value: "日本語" }] });
  });

  it("repairs inbound StrongRefs without restoring legacy target values", async () => {
    const referenceUri = "at://did:plc:test/pub.paper.reference/ref";
    const authorshipUri = "at://did:plc:test/id.career.authorship/claim";
    const repo = new MemoryRepo([
      { uri: referenceUri, cid: "cid-1", collection: "pub.paper.reference", value: { title: "Paper" } },
      { uri: authorshipUri, cid: "cid-2", collection: "id.career.authorship", value: { reference: { uri: referenceUri, cid: "cid-1" } } },
    ]);
    const scan: MigrationScan = {
      records: repo.records.map((record) => ({ ...record, value: structuredClone(record.value) })),
      candidates: [{ id: "title", uri: referenceUri, collection: "pub.paper.reference", path: "title", sourcePath: "title", value: "Paper", mode: "text" }],
      staleReferences: 0,
    };

    const result = await applyMigration(repo, scan, { title: "en" });

    expect(result.unresolvedReferences).toBe(0);
    expect(repo.records.find((record) => record.uri === referenceUri)?.value.title).toEqual([{ language: "en", value: "Paper" }]);
    expect(repo.records.find((record) => record.uri === authorshipUri)?.value.reference.cid).toBe(repo.records.find((record) => record.uri === referenceUri)?.cid);
  });

  it("resumes StrongRef repair after all legacy strings were already migrated", async () => {
    const referenceUri = "at://did:plc:test/pub.paper.reference/ref";
    const authorshipUri = "at://did:plc:test/id.career.authorship/claim";
    const repo = new MemoryRepo([
      { uri: referenceUri, cid: "cid-new", collection: "pub.paper.reference", value: { title: [{ language: "en", value: "Paper" }] } },
      { uri: authorshipUri, cid: "cid-claim", collection: "id.career.authorship", value: { reference: { uri: referenceUri, cid: "cid-old" } } },
    ]);
    const scan: MigrationScan = { records: repo.records.map((record) => ({ ...record, value: structuredClone(record.value) })), candidates: [], staleReferences: 1 };

    const result = await applyMigration(repo, scan, {});

    expect(result).toMatchObject({ migrated: 0, repaired: 1, unresolvedReferences: 0 });
    expect(repo.records.find((record) => record.uri === authorshipUri)?.value.reference.cid).toBe("cid-new");
  });

  it("detects and relabels und variants without changing their values", async () => {
    const uri = "at://did:plc:test/id.career.profile/self";
    const repo = new MemoryRepo([{
      uri,
      cid: "cid-profile",
      collection: "id.career.profile",
      value: {
        displayName: [{ language: "und-Latn", value: "Fukushima Takeru" }],
        keywords: [{ variants: [{ language: "und", value: "分散SNS" }] }],
      },
    }]);

    const scan = await scanLegacyRecords(repo);
    expect(scan.candidates.map((candidate) => [candidate.sourcePath, candidate.value, candidate.mode])).toEqual([
      ["displayName.0.language", "Fukushima Takeru", "relabel"],
      ["keywords.0.variants.0.language", "分散SNS", "relabel"],
    ]);

    const languages = Object.fromEntries(scan.candidates.map((candidate) => [candidate.id, "ja"]));
    const [record] = buildMigratedRecords(scan, languages);
    expect(record.value).toMatchObject({
      displayName: [{ language: "ja", value: "Fukushima Takeru" }],
      keywords: [{ variants: [{ language: "ja", value: "分散SNS" }] }],
    });
  });

  it("rejects relabeling und to a language already present in the field", () => {
    const uri = "at://did:plc:test/pub.paper.reference/ref";
    const scan: MigrationScan = {
      records: [{ uri, cid: "cid", collection: "pub.paper.reference", value: { title: [{ language: "und", value: "Paper" }, { language: "en", value: "Existing" }] } }],
      candidates: [{ id: "und", uri, collection: "pub.paper.reference", path: "title.0.language", sourcePath: "title.0.language", value: "Paper", mode: "relabel" }],
      staleReferences: 0,
    };
    expect(() => buildMigratedRecords(scan, { und: "en" })).toThrow("already has a en variant");
  });
});

class MemoryRepo implements Repo {
  readonly did = "did:plc:test";
  writes = 2;

  constructor(public records: { uri: string; cid: string; collection: string; value: any }[]) {}

  async listRecords(collection: string) {
    return { records: this.records.filter((record) => record.collection === collection) };
  }

  async getRecord(collection: string, rkey: string) {
    const record = this.records.find((item) => item.collection === collection && item.uri.endsWith(`/${rkey}`));
    if (!record) throw new Error("not found");
    return record;
  }

  async createRecord(): Promise<never> {
    throw new Error("not implemented");
  }

  async putRecord(collection: string, rkey: string, value: Record<string, unknown>, swapRecord?: string) {
    const record = this.records.find((item) => item.collection === collection && item.uri.endsWith(`/${rkey}`));
    if (!record) throw new Error("not found");
    if (swapRecord && swapRecord !== record.cid) throw new Error("swapRecord mismatch");
    record.value = structuredClone(value);
    record.cid = `cid-${++this.writes}`;
    return { uri: record.uri, cid: record.cid };
  }

  async deleteRecord(): Promise<void> {}
}
