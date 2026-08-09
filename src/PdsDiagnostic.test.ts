import { describe, expect, it, vi } from "vitest";
import { XrpcError } from "./atproto";
import { verifyPdsWrite } from "./PdsDiagnostic";
import { Repo } from "./repo";

function repo(overrides: Partial<Repo> = {}): Repo {
  const uri = "at://did:plc:test/pub.paper.collection/3test";
  const cid = "bafytest";
  let createdAt = "";
  let deleted = false;
  return {
    did: "did:plc:test",
    listRecords: vi.fn(),
    createRecord: vi.fn(async (_collection, record) => {
      createdAt = record.createdAt as string;
      return { uri, cid };
    }),
    getRecord: vi.fn(async () => {
      if (deleted) throw new XrpcError(400, "Could not find record", { error: "RecordNotFound" });
      return { uri, cid, value: { createdAt } };
    }),
    putRecord: vi.fn(),
    deleteRecord: vi.fn(async () => { deleted = true; }),
    ...overrides,
  };
}

describe("verifyPdsWrite", () => {
  it("creates, reads, deletes, and confirms deletion", async () => {
    const client = repo();
    await expect(verifyPdsWrite(client)).resolves.toBeUndefined();
    expect(client.createRecord).toHaveBeenCalledOnce();
    expect(client.getRecord).toHaveBeenCalledTimes(2);
    expect(client.deleteRecord).toHaveBeenCalledOnce();
  });

  it("rolls back when the read does not match", async () => {
    const client = repo({
      getRecord: vi.fn(async () => ({
        uri: "at://did:plc:test/pub.paper.collection/other",
        cid: "wrong",
        value: {},
      })),
    });
    await expect(verifyPdsWrite(client)).rejects.toThrow("一致しません");
    expect(client.deleteRecord).toHaveBeenCalledOnce();
  });
});
