// Handle -> DID -> PDS endpoint resolution for the unauthenticated public CV
// view. This is the one capability the editing app never needed (OAuth does it
// internally), so it is hand-rolled here with no SDK dependency, mirroring the
// raw-fetch style of src/atproto.ts.

const DEFAULT_HANDLE_RESOLVER = "https://bsky.social";
const PLC_DIRECTORY = "https://plc.directory";

export class IdentityError extends Error {
  constructor(
    message: string,
    readonly kind: "handle" | "did" | "pds",
  ) {
    super(message);
    this.name = "IdentityError";
  }
}

export interface ResolvedIdentity {
  did: string;
  pds: string;
}

function isDid(value: string): boolean {
  return value.startsWith("did:");
}

// Normalize a user-typed handle: strip a leading '@', lowercase, trim.
export function normalizeHandle(input: string): string {
  return input.trim().replace(/^@+/, "").toLowerCase();
}

// handle -> DID via com.atproto.identity.resolveHandle on a public resolver.
// A DID input is returned unchanged.
export async function resolveHandleToDid(
  handleOrDid: string,
  resolver = DEFAULT_HANDLE_RESOLVER,
): Promise<string> {
  const value = handleOrDid.trim();
  if (isDid(value)) return value;
  const handle = normalizeHandle(value);
  if (!handle) throw new IdentityError("Empty handle", "handle");
  const url = `${resolver.replace(/\/+$/, "")}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new IdentityError(`Could not reach handle resolver: ${(e as Error).message}`, "handle");
  }
  if (!res.ok) {
    throw new IdentityError(`Handle not found: ${handle}`, "handle");
  }
  const data = (await res.json()) as { did?: string };
  if (!data.did) throw new IdentityError(`Handle did not resolve to a DID: ${handle}`, "handle");
  return data.did;
}

interface DidDocument {
  alsoKnownAs?: string[];
  service?: { id: string; type: string; serviceEndpoint: string }[];
}

// Fetch the DID document: PLC directory for did:plc, .well-known for did:web.
async function fetchDidDocument(did: string): Promise<DidDocument> {
  let url: string;
  if (did.startsWith("did:plc:")) {
    url = `${PLC_DIRECTORY}/${encodeURIComponent(did)}`;
  } else if (did.startsWith("did:web:")) {
    // did:web:example.com[:path...] -> https://example.com[/path...]/.well-known/did.json
    const rest = did.slice("did:web:".length);
    const parts = rest.split(":").map((p) => decodeURIComponent(p));
    const host = parts.shift();
    if (!host) throw new IdentityError(`Malformed did:web: ${did}`, "did");
    const path = parts.length ? `/${parts.join("/")}/did.json` : "/.well-known/did.json";
    url = `https://${host}${path}`;
  } else {
    throw new IdentityError(`Unsupported DID method: ${did}`, "did");
  }
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new IdentityError(`Could not fetch DID document: ${(e as Error).message}`, "did");
  }
  if (!res.ok) throw new IdentityError(`DID document not found: ${did}`, "did");
  return (await res.json()) as DidDocument;
}

// Extract the atproto PDS serviceEndpoint from a DID document.
export function pdsFromDidDocument(doc: DidDocument): string {
  const svc = doc.service?.find(
    (s) => s.id === "#atproto_pds" || s.type === "AtprotoPersonalDataServer",
  );
  if (!svc?.serviceEndpoint) throw new IdentityError("No PDS endpoint in DID document", "pds");
  return svc.serviceEndpoint.replace(/\/+$/, "");
}

// Resolve the canonical handle advertised by a DID document and verify that
// the handle still resolves back to the same DID.
export async function resolveDidToHandle(
  did: string,
  resolver = DEFAULT_HANDLE_RESOLVER,
): Promise<string> {
  const doc = await fetchDidDocument(did);
  for (const alias of doc.alsoKnownAs ?? []) {
    if (!alias.startsWith("at://")) continue;
    const handle = normalizeHandle(alias.slice("at://".length).split("/")[0]);
    if (!handle) continue;
    try {
      if (await resolveHandleToDid(handle, resolver) === did) return handle;
    } catch {
      // Try another alias if the DID document contains one.
    }
  }
  throw new IdentityError(`No verified handle in DID document: ${did}`, "handle");
}

// Full resolution: handle/DID -> { did, pds }.
export async function resolveIdentity(
  handleOrDid: string,
  resolver = DEFAULT_HANDLE_RESOLVER,
): Promise<ResolvedIdentity> {
  const did = await resolveHandleToDid(handleOrDid, resolver);
  const doc = await fetchDidDocument(did);
  const pds = pdsFromDidDocument(doc);
  return { did, pds };
}
