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
    <div className="app">
      <div className="login-wrap">
        <div className="topbar">
          <h1>Minori</h1>
        </div>

        <div className="panel">
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
