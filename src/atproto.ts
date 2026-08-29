// Minimal AT Protocol XRPC client over fetch. No SDK dependency.
// Talks directly to a PDS (or the bsky.social entryway, which proxies repo.*).

export interface Session {
  service: string; // PDS / entryway base URL, e.g. https://bsky.social
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
}

export interface StrongRef {
  uri: string;
  cid: string;
}

const SESSION_KEY = "minori.session.v1";

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function saveSession(s: Session | null) {
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
}

export class XrpcError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function normalizeService(service: string): string {
  let s = service.trim();
  if (!/^https?:\/\//.test(s)) s = "https://" + s;
  return s.replace(/\/+$/, "");
}

// Exported so the unauthenticated public-CV read client can reuse the exact
// same XRPC transport (token is optional, so GETs work without auth).
export async function rawCall(
  service: string,
  method: "GET" | "POST",
  nsid: string,
  opts: { params?: Record<string, string | number | undefined>; body?: unknown; token?: string },
): Promise<any> {
  const base = normalizeService(service);
  let url = `${base}/xrpc/${nsid}`;
  if (opts.params) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.params)) {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    }
    const s = qs.toString();
    if (s) url += `?${s}`;
  }
  const headers: Record<string, string> = {};
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
  if (method === "POST") headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method,
    headers,
    body: method === "POST" ? JSON.stringify(opts.body ?? {}) : undefined,
  });

  const text = await res.text();
  let data: any = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || res.statusText;
    throw new XrpcError(res.status, msg, data);
  }
  return data;
}

export async function createSession(
  service: string,
  identifier: string,
  password: string,
): Promise<Session> {
  const data = await rawCall(service, "POST", "com.atproto.server.createSession", {
    body: { identifier: identifier.trim(), password: password.trim() },
  });
  return {
    service: normalizeService(service),
    did: data.did,
    handle: data.handle,
    accessJwt: data.accessJwt,
    refreshJwt: data.refreshJwt,
  };
}

async function refreshSession(s: Session): Promise<Session> {
  const data = await rawCall(s.service, "POST", "com.atproto.server.refreshSession", {
    token: s.refreshJwt,
  });
  return { ...s, accessJwt: data.accessJwt, refreshJwt: data.refreshJwt };
}

// Authenticated call with one automatic refresh on expired token.
export class Client {
  session: Session;
  onSession?: (s: Session) => void;

  constructor(session: Session, onSession?: (s: Session) => void) {
    this.session = session;
    this.onSession = onSession;
  }

  private persist() {
    saveSession(this.session);
    this.onSession?.(this.session);
  }

  private async call(
    method: "GET" | "POST",
    nsid: string,
    opts: { params?: Record<string, string | number | undefined>; body?: unknown },
  ): Promise<any> {
    try {
      return await rawCall(this.session.service, method, nsid, {
        ...opts,
        token: this.session.accessJwt,
      });
    } catch (e) {
      if (
        e instanceof XrpcError &&
        (e.status === 400 || e.status === 401) &&
        typeof e.data === "object" &&
        e.data &&
        ((e.data as any).error === "ExpiredToken" ||
          (e.data as any).error === "InvalidToken")
      ) {
        this.session = await refreshSession(this.session);
        this.persist();
        return await rawCall(this.session.service, method, nsid, {
          ...opts,
          token: this.session.accessJwt,
        });
      }
      throw e;
    }
  }

  get did() {
    return this.session.did;
  }

  async listRecords(collection: string, limit = 100, cursor?: string) {
    return this.call("GET", "com.atproto.repo.listRecords", {
      params: { repo: this.session.did, collection, limit, cursor },
    }) as Promise<{ records: { uri: string; cid: string; value: any }[]; cursor?: string }>;
  }

  async getRecord(collection: string, rkey: string) {
    return this.call("GET", "com.atproto.repo.getRecord", {
      params: { repo: this.session.did, collection, rkey },
    }) as Promise<{ uri: string; cid: string; value: any }>;
  }

  async createRecord(collection: string, record: Record<string, unknown>, rkey?: string): Promise<StrongRef> {
    const body: any = { repo: this.session.did, collection, record };
    if (rkey) body.rkey = rkey;
    const data = await this.call("POST", "com.atproto.repo.createRecord", { body });
    return { uri: data.uri, cid: data.cid };
  }

  async putRecord(collection: string, rkey: string, record: Record<string, unknown>, swapRecord?: string): Promise<StrongRef> {
    const data = await this.call("POST", "com.atproto.repo.putRecord", {
      body: { repo: this.session.did, collection, rkey, record, ...(swapRecord ? { swapRecord } : {}) },
    });
    return { uri: data.uri, cid: data.cid };
  }

  async deleteRecord(collection: string, rkey: string): Promise<void> {
    await this.call("POST", "com.atproto.repo.deleteRecord", {
      body: { repo: this.session.did, collection, rkey },
    });
  }
}

// rkey helper: extract the rkey from an at:// uri.
export function rkeyFromUri(uri: string): string {
  return uri.split("/").pop() as string;
}
