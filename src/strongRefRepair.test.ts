import { describe, expect, it, vi } from "vitest";
import { Repo } from "./repo";
import { repairCurrentStrongRefs } from "./strongRefRepair";

describe("StrongRef repair", () => {
  it("updates an inbound reference to the target's current CID", async () => {
    const targetUri = "at://did:plc:test/pub.paper.reference/ref";
    const claimUri = "at://did:plc:test/id.career.authorship/claim";
    const repo = new MemoryRepo([
      { uri: targetUri, cid: "cid-current", collection: "pub.paper.reference", value: { title: [{ language: "en", value: "Paper" }] } },
      { uri: claimUri, cid: "cid-claim", collection: "id.career.authorship", value: { reference: { uri: targetUri, cid: "cid-old" } } },
    ]);

    expect(await repairCurrentStrongRefs(repo)).toEqual({ repaired: 1, unresolvedReferences: 0 });
    expect(repo.records.find((record) => record.uri === claimUri)?.value.reference.cid).toBe("cid-current");
    expect(repo.requestedCollections).not.toContain("id.career.attestation");
  });

  it("reports cyclic references that cannot converge without failing the completed write", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const firstUri = "at://did:plc:test/id.career.patent/first";
    const secondUri = "at://did:plc:test/id.career.patent/second";
    const repo = new MemoryRepo([
      { uri: firstUri, cid: "cid-first", collection: "id.career.patent", value: { familyMembers: [{ uri: secondUri, cid: "cid-old-second" }] } },
      { uri: secondUri, cid: "cid-second", collection: "id.career.patent", value: { familyMembers: [{ uri: firstUri, cid: "cid-old-first" }] } },
    ]);

    const result = await repairCurrentStrongRefs(repo);
    expect(result.repaired).toBeGreaterThan(0);
    expect(result.unresolvedReferences).toBeGreaterThan(0);
    expect(warning).toHaveBeenCalledOnce();
    warning.mockRestore();
  });
});

class MemoryRepo implements Repo {
  readonly did = "did:plc:test";
  writes = 0;
  requestedCollections: string[] = [];

  constructor(public records: { uri: string; cid: string; collection: string; value: any }[]) {}

  async listRecords(collection: string) {
    this.requestedCollections.push(collection);
    return { records: this.records.filter((record) => record.collection === collection) };
  }

  async getRecord(collection: string, rkey: string) {
    const record = this.records.find((item) => item.collection === collection && item.uri.endsWith(`/${rkey}`));
    if (!record) throw new Error("not found");
    return record;
  }

  async createRecord(): Promise<never> { throw new Error("not implemented"); }

  async putRecord(collection: string, rkey: string, value: Record<string, unknown>, swapRecord?: string) {
    const record = this.records.find((item) => item.collection === collection && item.uri.endsWith(`/${rkey}`));
    if (!record) throw new Error("not found");
    if (swapRecord && swapRecord !== record.cid) throw new Error("swapRecord mismatch");
    record.value = structuredClone(value);
    record.cid = `cid-write-${++this.writes}`;
    return { uri: record.uri, cid: record.cid };
  }

  async deleteRecord(): Promise<void> {}
}
