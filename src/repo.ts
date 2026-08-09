import { Agent } from "@atproto/api";
import { StrongRef } from "./atproto";

// Storage-agnostic repo interface. Both the OAuth (Agent) path and the
// app-password (raw fetch) path implement this, so the UI never knows which
// auth mechanism is in use.
export interface Repo {
  readonly did: string;
  listRecords(
    collection: string,
    limit?: number,
    cursor?: string,
  ): Promise<{ records: { uri: string; cid: string; value: any }[]; cursor?: string }>;
  getRecord(collection: string, rkey: string): Promise<{ uri: string; cid: string; value: any }>;
  createRecord(collection: string, record: Record<string, unknown>, rkey?: string): Promise<StrongRef>;
  putRecord(collection: string, rkey: string, record: Record<string, unknown>): Promise<StrongRef>;
  deleteRecord(collection: string, rkey: string): Promise<void>;
}

export async function listAllRecords(client: Repo, collection: string) {
  const records: { uri: string; cid: string; value: any }[] = [];
  let cursor: string | undefined;
  do {
    const page = await client.listRecords(collection, 100, cursor);
    records.push(...page.records);
    cursor = page.cursor;
  } while (cursor);
  return records;
}

// OAuth-backed repo: wraps an @atproto/api Agent built from an OAuthSession.
// The Agent signs every request with DPoP; no password is ever handled.
export class AgentRepo implements Repo {
  constructor(private agent: Agent) {}

  get did(): string {
    return this.agent.assertDid;
  }

  async listRecords(collection: string, limit = 100, cursor?: string) {
    const r = await this.agent.com.atproto.repo.listRecords({
      repo: this.did,
      collection,
      limit,
      cursor,
    });
    return {
      records: r.data.records as { uri: string; cid: string; value: any }[],
      cursor: r.data.cursor,
    };
  }

  async getRecord(collection: string, rkey: string) {
    const r = await this.agent.com.atproto.repo.getRecord({ repo: this.did, collection, rkey });
    return { uri: r.data.uri, cid: r.data.cid ?? "", value: r.data.value };
  }

  async createRecord(collection: string, record: Record<string, unknown>, rkey?: string): Promise<StrongRef> {
    const r = await this.agent.com.atproto.repo.createRecord({
      repo: this.did,
      collection,
      record,
      ...(rkey ? { rkey } : {}),
    });
    return { uri: r.data.uri, cid: r.data.cid };
  }

  async putRecord(collection: string, rkey: string, record: Record<string, unknown>): Promise<StrongRef> {
    const r = await this.agent.com.atproto.repo.putRecord({
      repo: this.did,
      collection,
      rkey,
      record,
    });
    return { uri: r.data.uri, cid: r.data.cid };
  }

  async deleteRecord(collection: string, rkey: string): Promise<void> {
    await this.agent.com.atproto.repo.deleteRecord({ repo: this.did, collection, rkey });
  }
}
