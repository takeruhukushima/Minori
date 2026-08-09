import React, { useState } from "react";
import { createSession, Session } from "./atproto";
import { startOAuthSignIn } from "./oauth";
import { Field, Message, Msg } from "./ui";

export function Login({ onPasswordLogin }: { onPasswordLogin: (s: Session) => void }) {
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [showPw, setShowPw] = useState(false);
  const allowPassword = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);

  async function oauth(e: React.FormEvent) {
    e.preventDefault();
    if (!handle.trim()) {
      setMsg({ kind: "err", text: "ハンドルを入力してください" });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await startOAuthSignIn(handle); // redirects away
    } catch (err: any) {
      setBusy(false);
      setMsg({ kind: "err", text: `サインイン開始に失敗: ${err?.message ?? err}` });
    }
  }

  return (
    <div className="landing">
      <header className="landing-nav">
        <a className="brand" href="#top" aria-label="Minori ホーム">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span>Minori</span>
        </a>
        <a className="btn ghost small nav-cta" href="#signin">サインイン</a>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <div className="hero-kicker"><span /> Built on AT Protocol</div>
            <h1>研究の歩みを、<br /><em>自分のデータ</em>として。</h1>
            <p className="hero-lead">
              Minoriは、プロフィール、経歴、プロジェクト、論文をあなた自身のPDSへ記録する研究者向けポートフォリオです。
            </p>
            <div className="hero-actions">
              <a className="btn hero-primary" href="#signin">自分のPDSではじめる <span aria-hidden="true">→</span></a>
              <span className="hero-assurance">パスワードをMinoriに預けません</span>
            </div>
          </div>

          <div className="hero-preview" aria-label="Minoriで管理できる情報の例">
            <div className="preview-glow" />
            <div className="preview-window">
              <div className="preview-bar"><i /><i /><i /><span>at://your.did/id.career</span></div>
              <div className="preview-profile">
                <div className="preview-avatar">TF</div>
                <div><strong>Your Research Profile</strong><small>Researcher · your university</small></div>
                <span className="preview-live">PDS</span>
              </div>
              <div className="preview-grid">
                <div><small>PROFILE</small><strong>CV・経歴</strong><span>学歴、職歴、受賞など</span></div>
                <div><small>PROJECTS</small><strong>研究プロジェクト</strong><span>テーマごとに整理</span></div>
                <div><small>PAPERS</small><strong>論文・業績</strong><span>DOI・著者情報も記録</span></div>
              </div>
              <div className="preview-record"><code>id.career.profile</code><span>あなたが所有する公開レコード</span><b>✓</b></div>
            </div>
          </div>
        </section>

        <section className="value-strip" aria-label="Minoriの特徴">
          <article><span>01</span><div><strong>まとめる</strong><p>散らばったCVと論文情報を、ひとつの画面から記録。</p></div></article>
          <article><span>02</span><div><strong>所有する</strong><p>データはサービスではなく、あなた自身のPDSに保存。</p></div></article>
          <article><span>03</span><div><strong>育てる</strong><p>公開後も詳細を確認し、いつでも編集・削除できます。</p></div></article>
        </section>

        <section className="signin-section" id="signin">
          <div className="signin-intro">
            <span className="section-label">GET STARTED</span>
            <h2>あなたの研究記録を<br />つくりはじめる</h2>
            <p>Blueskyなどで利用しているAT Protocolのハンドルを入力してください。認証はあなたのPDS上で安全に行われます。</p>
          </div>

          <div className="panel login-panel">
          <h2>サインイン</h2>
          <p className="hint">
            atproto OAuth で自分の PDS にサインインします。パスワードはこのアプリには
            渡さず、あなたの PDS の画面で認証します。
          </p>
          <form onSubmit={oauth}>
            <Field
              label="ハンドル または DID"
              value={handle}
              onChange={setHandle}
              placeholder="you.bsky.social"
              required
            />
            <div className="toolbar">
              <button className="btn" type="submit" disabled={busy}>
                {busy ? "リダイレクト中…" : "OAuth でサインイン"}
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
                  {showPw ? "アプリパスワードを隠す" : "開発者向け: アプリパスワードでログイン"}
                </button>
              </p>
              {showPw && <PasswordLogin onLogin={onPasswordLogin} />}
            </>
          )}
        </div>
      </main>

      <footer className="landing-footer"><span>Minori</span><span>Your research. Your data.</span></footer>
    </div>
  );
}

function PasswordLogin({ onLogin }: { onLogin: (s: Session) => void }) {
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
      setMsg({ kind: "err", text: `ログイン失敗: ${err?.message ?? err}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h2>アプリパスワード（ローカル開発用）</h2>
      <p className="hint">
        OAuth の localhost リダイレクトを避けたいときの代替。パスワードは
        ブラウザから PDS へ直接送られ、サーバーには保存されません。
      </p>
      <form onSubmit={submit}>
        <div className="grid">
          <Field label="PDS ホスト" value={service} onChange={setService} required />
          <Field label="ハンドル / DID" value={identifier} onChange={setIdentifier} required />
        </div>
        <div style={{ marginTop: 12 }}>
          <Field
            label="アプリパスワード"
            value={password}
            onChange={setPassword}
            type="password"
            placeholder="xxxx-xxxx-xxxx-xxxx"
            required
          />
        </div>
        <div className="toolbar">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "接続中…" : "ログイン"}
          </button>
        </div>
        <Message msg={msg} />
      </form>
    </div>
  );
}
