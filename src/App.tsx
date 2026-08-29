import React, { useEffect, useState } from "react";
import { Client, loadSession, saveSession, Session } from "./atproto";
import { Repo } from "./repo";
import { initOAuth, oauthSignOut } from "./oauth";
import { Login } from "./Login";
import { ProfileTab } from "./tabs/ProfileTab";
import { CvTab } from "./tabs/CvTab";
import { ProjectsTab } from "./tabs/ProjectsTab";
import { PdsDiagnostic } from "./PdsDiagnostic";
import { LocaleSwitcher, useI18n } from "./i18n";
import { useHashRoute, cvHref, discoverHref } from "./hashRoute";
import { PublicCv } from "./cv/PublicCv";
import { CollectionDetail } from "./cv/CollectionDetail";
import { Discover } from "./cv/Discover";

type Tab = "cv" | "projects";

interface SignedIn {
  repo: Repo;
  label: string;
  handle: string;
  did: string;
  logout: () => void | Promise<void>;
}

// Top-level router: an unauthenticated public CV route, or the editing app.
export function App() {
  const route = useHashRoute();
  if (route.kind === "discover") return <Discover />;
  if (route.kind === "collection") {
    return <CollectionDetail handle={route.handle} rkey={route.rkey} />;
  }
  if (route.kind === "cv") {
    return <PublicCv handle={route.handle} anchor={route.anchor} />;
  }
  return <EditorApp />;
}

function EditorApp() {
  const { text } = useI18n();
  const [state, setState] = useState<"loading" | SignedIn | null>("loading");
  const [tab, setTab] = useState<Tab>("cv");

  // On mount: complete any OAuth redirect / restore session, else fall back
  // to a stored app-password session.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await initOAuth();
        if (r && alive) {
          setState({
            repo: r.repo,
            label: `${r.handle}`,
            handle: r.handle,
            did: r.did,
            logout: async () => {
              await oauthSignOut();
              location.reload();
            },
          });
          return;
        }
      } catch (err) {
        // The browser OAuth client intentionally throws after changing
        // localhost to the RFC 8252 loopback IP. Navigation is already in
        // progress, so this is not an application error.
        if (!(err instanceof Error && err.message === "Redirecting to loopback IP...")) {
          console.error("OAuth init failed", err);
        }
      }
      const s = isLocalDevelopment() ? loadSession() : null;
      if (s && alive) {
        setState(makePasswordState(s, setState));
        return;
      }
      if (alive) setState(null);
    })();
    return () => {
      alive = false;
    };
  }, []);

  function onPasswordLogin(s: Session) {
    saveSession(s);
    setState(makePasswordState(s, setState));
  }

  if (state === "loading") {
    return (
      <div className="app">
        <div className="login-wrap">
          <div className="panel">{text("読み込み中…", "Loading...")}</div>
        </div>
      </div>
    );
  }

  if (state === null) return <Login onPasswordLogin={onPasswordLogin} />;

  const { repo, label, handle, logout } = state;

  return (
    <div className="app">
      <div className="topbar">
        <h1>Minori</h1>
        <div className="row">
          <span className="who">{label}</span>
          <a className="btn ghost small" href={discoverHref()}>{text("公開CVを探す", "Find public CVs")}</a>
          <a
            className="btn ghost small"
            href={cvHref(handle)}
            target="_blank"
            rel="noopener"
            title={text("公開CVはPDS上の公開情報から生成されます", "The public CV is generated from public records on your PDS")}
          >
            {text("公開CVを表示", "View public CV")}
          </a>
          <LocaleSwitcher />
          <button className="btn ghost small" onClick={() => logout()}>
            {text("ログアウト", "Log out")}
          </button>
        </div>
      </div>

      <div className="tabs">
        <button className={tab === "cv" ? "active" : ""} onClick={() => setTab("cv")}>
          CV
        </button>
        <button className={tab === "projects" ? "active" : ""} onClick={() => setTab("projects")}>
          {text("プロジェクト × 論文", "Projects × Papers")}
        </button>
      </div>

      <PdsDiagnostic client={repo} />

      {tab === "cv" && (
        <>
          <ProfileTab client={repo} />
          <CvTab client={repo} />
        </>
      )}
      {tab === "projects" && <ProjectsTab client={repo} />}
    </div>
  );
}

function isLocalDevelopment(): boolean {
  return ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
}

function makePasswordState(
  s: Session,
  setState: React.Dispatch<React.SetStateAction<"loading" | SignedIn | null>>,
): SignedIn {
  const client = new Client(s);
  return {
    repo: client,
    label: `${s.handle} · app-pw`,
    handle: s.handle,
    did: s.did,
    logout: () => {
      saveSession(null);
      setState(null);
    },
  };
}
