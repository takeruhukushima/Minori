// Unauthenticated, read-only client for the public CV view. Implements the
// read subset of the Repo interface (src/repo.ts) against a resolved PDS
// endpoint, reusing the same raw-fetch XRPC transport as the app-password
// path. No token is ever sent; only public com.atproto.repo.* GETs are used.

import { rawCall } from "../atproto";
import type { Repo } from "../repo";
import { resolveIdentity } from "./identity";

// The write half of Repo is intentionally unsupported here.
function readOnly(): never {
  throw new Error("PublicRepo is read-only");
}

export class PublicRepo implements Repo {
  constructor(
    readonly did: string,
    readonly pds: string,
  ) {}

  static async fromHandle(handleOrDid: string): Promise<PublicRepo> {
    const { did, pds } = await resolveIdentity(handleOrDid);
    return new PublicRepo(did, pds);
  }

  async listRecords(collection: string, limit = 100, cursor?: string) {
    const data = await rawCall(this.pds, "GET", "com.atproto.repo.listRecords", {
      params: { repo: this.did, collection, limit, cursor },
    });
    return {
      records: (data.records ?? []) as { uri: string; cid: string; value: any }[],
      cursor: data.cursor as string | undefined,
    };
  }

  async getRecord(collection: string, rkey: string) {
    const data = await rawCall(this.pds, "GET", "com.atproto.repo.getRecord", {
      params: { repo: this.did, collection, rkey },
    });
    return { uri: data.uri as string, cid: (data.cid ?? "") as string, value: data.value };
  }

  createRecord = readOnly;
  putRecord = readOnly;
  deleteRecord = readOnly;
}
