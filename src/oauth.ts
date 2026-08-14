import { Agent } from "@atproto/api";
import {
  BrowserOAuthClient,
  buildLoopbackClientId,
  type OAuthClientMetadataInput,
} from "@atproto/oauth-client-browser";
import { AgentRepo, Repo } from "./repo";

// OAuth is the primary, secure auth path for the public/multi-user goal:
// the user authenticates on their own PDS, this app never sees a password,
// and tokens are DPoP-bound and revocable. Fully client-side, so it deploys
// to a static host (Cloudflare Pages) with only client-metadata.json served.

// Request only the collections this UI can mutate. This keeps the production
// consent screen honest and avoids the account-wide transition:generic grant.
const WRITE_COLLECTIONS = [
  "id.sifa.profile.position",
  "pub.paper.reference",
  "pub.paper.collection",
  "pub.paper.collectionItem",
  "pub.paper.readingStatus",
  "id.career.profile",
  "id.career.dossier",
  "id.career.attestation",
  "id.career.education",
  "id.career.authorship",
  "id.career.presentation",
  "id.career.grant",
  "id.career.award",
  "id.career.service",
  "id.career.membership",
  "id.career.teaching",
  "id.career.supervision",
  "id.career.patent",
  "id.career.outreach",
  "id.career.work",
  "id.career.openSourceContribution",
] as const;

const SCOPE = ["atproto", ...WRITE_COLLECTIONS.map((nsid) => `repo:${nsid}`)].join(" ");

function isLoopback(): boolean {
  const h = location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

// In production the client_id is the public URL of the hosted metadata file.
// On localhost the atproto spec allows a synthesized "loopback" client that
// needs no hosted file — perfect for dev.
export function clientId(): string {
  if (isLoopback()) {
    const id = new URL(buildLoopbackClientId(location));
    id.searchParams.set("scope", SCOPE);
    return id.href;
  }
  const configured = import.meta.env.VITE_PUBLIC_URL?.replace(/\/+$/, "");
  return `${configured || location.origin}/client-metadata.json`;
}

// The metadata object served at /client-metadata.json in production.
// Keep in sync with the generated metadata in vite.config.ts.
export function productionMetadata(origin: string): OAuthClientMetadataInput {
  return {
    client_id: `${origin}/client-metadata.json`,
    client_name: "Minori",
    client_uri: origin,
    redirect_uris: [`${origin}/`],
    scope: SCOPE,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    application_type: "web",
    token_endpoint_auth_method: "none",
    dpop_bound_access_tokens: true,
  };
}

let clientPromise: Promise<BrowserOAuthClient> | null = null;
let initializationPromise: Promise<OAuthInitResult | null> | null = null;

export function getOAuthClient(): Promise<BrowserOAuthClient> {
  if (clientPromise) return clientPromise;
  // BrowserOAuthClient.load expands a http://localhost loopback client_id into
  // the protocol-defined native metadata. Passing a hand-written metadata
  // object here makes OAuth servers validate it as a production web client.
  clientPromise = BrowserOAuthClient.load({
    clientId: clientId(),
    handleResolver: "https://bsky.social",
  });
  return clientPromise;
}

export interface OAuthInitResult {
  repo: Repo;
  handle: string;
  did: string;
}

// Restore an existing session or complete a redirect callback. Returns null
// if the user is not signed in.
export function initOAuth(): Promise<OAuthInitResult | null> {
  // React Strict Mode mounts effects twice in development. OAuth callback
  // processing is destructive: client.init() removes the callback parameters
  // from the URL before exchanging the code. Both mounts must therefore await
  // the exact same operation instead of racing two init() calls.
  if (!initializationPromise) initializationPromise = initializeOAuth();
  return initializationPromise;
}

async function initializeOAuth(): Promise<OAuthInitResult | null> {
  const client = await getOAuthClient();
  const result = await client.init();
  if (!result?.session) return null;
  const agent = new Agent(result.session);
  const did = result.session.did;
  let handle = did;
  try {
    const prof = await agent.com.atproto.repo.getRecord({
      repo: did,
      collection: "app.bsky.actor.profile",
      rkey: "self",
    });
    handle = (prof.data.value as any)?.displayName ?? did;
  } catch {
    // no bsky profile is fine
  }
  return { repo: new AgentRepo(agent), handle, did };
}

// Begin sign-in: resolves the handle and redirects to the user's PDS.
export async function startOAuthSignIn(handle: string): Promise<void> {
  const client = await getOAuthClient();
  await client.signIn(handle.trim(), { scope: SCOPE });
  // signIn redirects the browser; control does not return here.
}

export async function oauthSignOut(): Promise<void> {
  try {
    const client = await getOAuthClient();
    const r = await client.init();
    if (r?.session) await client.revoke(r.session.did);
  } catch {
    // ignore
  }
}
