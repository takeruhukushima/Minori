import React, { useState } from "react";
import { createSession, Session } from "./atproto";
import { startOAuthSignIn } from "./oauth";
import { Field, Message, Msg } from "./ui";
import { LocaleSwitcher, useI18n } from "./i18n";
import { discoverHref } from "./hashRoute";

export function Login({ onPasswordLogin }: { onPasswordLogin: (s: Session) => void }) {
  const { text } = useI18n();
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [showPw, setShowPw] = useState(false);
  const allowPassword = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);

  async function oauth(e: React.FormEvent) {
    e.preventDefault();
    if (!handle.trim()) {
      setMsg({ kind: "err", text: text("ハンドルを入力してください", "Enter your handle") });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await startOAuthSignIn(handle); // redirects away
    } catch (err: any) {
      setBusy(false);
      setMsg({ kind: "err", text: `${text("サインイン開始に失敗", "Could not start sign-in")}: ${err?.message ?? err}` });
    }
  }

  return (
    <div className="landing">
      <header className="landing-nav">
        <a className="brand" href="#top" aria-label={text("Minori ホーム", "Minori home")}>
          <span className="brand-mark" aria-hidden="true">M</span>
          <span>Minori</span>
        </a>
        <div className="row">
          <LocaleSwitcher />
          <a className="btn ghost small nav-cta" href={discoverHref()}>{text("公開CVを探す", "Find public CVs")}</a>
          <a className="btn ghost small nav-cta" href="#signin">{text("サインイン", "Sign in")}</a>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <div className="hero-kicker"><span /> {text("AT Protocolで構築", "Built on AT Protocol")}</div>
            <h1>{text("研究の歩みを、", "Your research journey,")}<br /><em>{text("自分のデータ", "as your own data")}</em>{text("として。", ".")}</h1>
            <p className="hero-lead">
              {text("Minoriは、プロフィール、経歴、プロジェクト、論文をあなた自身のPDSへ記録する研究者向けポートフォリオです。", "Minori is a portfolio for researchers that records your profile, career, projects, and papers in your own PDS.")}
            </p>
            <div className="hero-actions">
              <a className="btn hero-primary" href="#signin">{text("自分のPDSではじめる", "Start with your PDS")} <span aria-hidden="true">→</span></a>
              <span className="hero-assurance">{text("パスワードをMinoriに預けません", "Minori never receives your password")}</span>
            </div>
          </div>

          <div className="hero-preview" aria-label={text("Minoriで管理できる情報の例", "Example information managed with Minori")}>
            <div className="preview-glow" />
            <div className="preview-window">
              <div className="preview-bar"><i /><i /><i /><span>at://your.did/id.career</span></div>
              <div className="preview-profile">
                <div className="preview-avatar">TF</div>
                <div><strong>{text("あなたの研究プロフィール", "Your Research Profile")}</strong><small>{text("研究者 · 所属大学", "Researcher · your university")}</small></div>
                <span className="preview-live">PDS</span>
              </div>
              <div className="preview-grid">
                <div><small>{text("プロフィール", "PROFILE")}</small><strong>{text("CV・経歴", "CV & Career")}</strong><span>{text("学歴、職歴、受賞など", "Education, positions, awards")}</span></div>
                <div><small>{text("プロジェクト", "PROJECTS")}</small><strong>{text("研究プロジェクト", "Research Projects")}</strong><span>{text("テーマごとに整理", "Organized by topic")}</span></div>
                <div><small>{text("論文", "PAPERS")}</small><strong>{text("論文・業績", "Papers & Work")}</strong><span>{text("DOI・著者情報も記録", "DOIs and authors included")}</span></div>
              </div>
              <div className="preview-record"><code>id.career.profile</code><span>{text("あなたが所有する公開レコード", "A public record you own")}</span><b>✓</b></div>
            </div>
          </div>
        </section>

        <section className="value-strip" aria-label={text("Minoriの特徴", "Minori features")}>
          <article><span>01</span><div><strong>{text("まとめる", "Collect")}</strong><p>{text("散らばったCVと論文情報を、ひとつの画面から記録。", "Record scattered CV and publication information in one place.")}</p></div></article>
          <article><span>02</span><div><strong>{text("所有する", "Own")}</strong><p>{text("データはサービスではなく、あなた自身のPDSに保存。", "Your data is stored in your own PDS, not in the service.")}</p></div></article>
          <article><span>03</span><div><strong>{text("育てる", "Develop")}</strong><p>{text("公開後も詳細を確認し、いつでも編集・削除できます。", "Review, edit, or delete details at any time after publishing.")}</p></div></article>
        </section>

        <section className="signin-section" id="signin">
          <div className="signin-intro">
            <span className="section-label">{text("はじめる", "GET STARTED")}</span>
            <h2>{text("あなたの研究記録を", "Start building your")}<br />{text("つくりはじめる", "research record")}</h2>
            <p>{text("Blueskyなどで利用しているAT Protocolのハンドルを入力してください。認証はあなたのPDS上で安全に行われます。", "Enter the AT Protocol handle you use with Bluesky or another service. Authentication takes place securely on your PDS.")}</p>
          </div>

          <div className="panel login-panel">
          <h2>{text("サインイン", "Sign in")}</h2>
          <p className="hint">
            {text("atproto OAuth で自分の PDS にサインインします。パスワードはこのアプリには渡さず、あなたの PDS の画面で認証します。", "Sign in to your PDS with atproto OAuth. Your password is not shared with this app; authentication happens on your PDS.")}
          </p>
          <form onSubmit={oauth}>
            <Field
              label={text("ハンドル または DID", "Handle or DID")}
              value={handle}
              onChange={setHandle}
              placeholder="you.bsky.social"
              required
            />
            <div className="toolbar">
              <button className="btn" type="submit" disabled={busy}>
                {busy ? text("リダイレクト中…", "Redirecting...") : text("OAuth でサインイン", "Sign in with OAuth")}
              </button>
            </div>
            <Message msg={msg} />
          </form>
          </div>
        </section>

        <div className="local-login">
          {allowPassword && (
            <>
              <p className="center-note">
                <button className="btn ghost small" onClick={() => setShowPw((v) => !v)}>
                  {showPw ? text("アプリパスワードを隠す", "Hide app password") : text("開発者向け: アプリパスワードでログイン", "For developers: sign in with an app password")}
                </button>
              </p>
              {showPw && <PasswordLogin onLogin={onPasswordLogin} />}
            </>
          )}
        </div>
      </main>

      <footer className="landing-footer"><span>Minori</span><span>{text("あなたの研究。あなたのデータ。", "Your research. Your data.")}</span></footer>
    </div>
  );
}

function PasswordLogin({ onLogin }: { onLogin: (s: Session) => void }) {
  const { text } = useI18n();
  const [service, setService] = useState("https://bsky.social");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const s = await createSession(service, identifier, password);
      onLogin(s);
    } catch (err: any) {
      setMsg({ kind: "err", text: `${text("ログイン失敗", "Sign-in failed")}: ${err?.message ?? err}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h2>{text("アプリパスワード（ローカル開発用）", "App password (local development)")}</h2>
      <p className="hint">
        {text("OAuth の localhost リダイレクトを避けたいときの代替。パスワードはブラウザから PDS へ直接送られ、サーバーには保存されません。", "An alternative when you need to avoid an OAuth localhost redirect. The password is sent directly from your browser to the PDS and is not stored on the server.")}
      </p>
      <form onSubmit={submit}>
        <div className="grid">
          <Field label={text("PDS ホスト", "PDS host")} value={service} onChange={setService} required />
          <Field label={text("ハンドル / DID", "Handle / DID")} value={identifier} onChange={setIdentifier} required />
        </div>
        <div style={{ marginTop: 12 }}>
          <Field
            label={text("アプリパスワード", "App password")}
            value={password}
            onChange={setPassword}
            type="password"
            placeholder="xxxx-xxxx-xxxx-xxxx"
            required
          />
        </div>
        <div className="toolbar">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? text("接続中…", "Connecting...") : text("ログイン", "Sign in")}
          </button>
        </div>
        <Message msg={msg} />
      </form>
    </div>
  );
}
