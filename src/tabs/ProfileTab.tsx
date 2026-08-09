import React, { useEffect, useState } from "react";
import { Repo } from "../repo";
import { NSID } from "../lexicons";
import { Checkbox, Field, Message, Msg, clean, now } from "../ui";
import { RecordDetailData, RecordDetailDialog } from "../RecordDetail";

interface WebLinkDraft {
  id: string;
  label: string;
  url: string;
}

let nextWebLinkId = 1;
const newWebLink = (label = "", url = ""): WebLinkDraft => ({ id: `web-link-${nextWebLinkId++}`, label, url });

// id.career.profile — single record, rkey "self".
export function ProfileTab({ client }: { client: Repo }) {
  const [displayName, setDisplayName] = useState("");
  const [nativeName, setNativeName] = useState("");
  const [namePreferredCitation, setNamePreferredCitation] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [affName, setAffName] = useState("");
  const [affRor, setAffRor] = useState("");
  const [affDept, setAffDept] = useState("");
  const [orcid, setOrcid] = useState("");
  const [researchmapId, setResearchmapId] = useState("");
  const [kakenId, setKakenId] = useState("");
  const [googleScholarId, setGoogleScholarId] = useState("");
  const [websites, setWebsites] = useState<WebLinkDraft[]>([newWebLink("Website")]);
  const [keywords, setKeywords] = useState("");
  const [acceptingStudents, setAcceptingStudents] = useState(false);
  const [openToCollaboration, setOpenToCollaboration] = useState(false);

  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [savedRecord, setSavedRecord] = useState<RecordDetailData | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const rec = await client.getRecord(NSID.profile, "self");
        const v = rec.value;
        setDisplayName(v.displayName ?? "");
        setNativeName(v.nativeName ?? "");
        setNamePreferredCitation(v.namePreferredCitation ?? "");
        setHeadline(v.headline ?? "");
        setBio(v.bio ?? "");
        setAffName(v.primaryAffiliation?.name ?? "");
        setAffRor(v.primaryAffiliation?.ror ?? "");
        setAffDept(v.primaryAffiliation?.department ?? "");
        setOrcid(v.orcid ?? "");
        setResearchmapId(v.researchmapId ?? "");
        setKakenId(v.kakenId ?? "");
        setGoogleScholarId(v.googleScholarId ?? "");
        setWebsites(v.websites?.length
          ? v.websites.map((link: any) => newWebLink(link.label ?? "", link.url ?? ""))
          : [newWebLink("Website")]);
        setKeywords((v.keywords ?? []).join(", "));
        setAcceptingStudents(!!v.acceptingStudents);
        setOpenToCollaboration(!!v.openToCollaboration);
        setCreatedAt(v.createdAt ?? null);
        setSavedRecord({ title: v.displayName ?? "CVプロフィール", uri: rec.uri, cid: rec.cid, value: v });
      } catch {
        // no profile yet — that's fine
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.did]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const primaryAffiliation = clean({ name: affName, ror: affRor, department: affDept });
      const kw = keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      const webLinks = websites
        .map(({ label, url }) => ({ label: label.trim(), url: url.trim() }))
        .filter((link) => link.url);
      for (const link of webLinks) {
        let parsed: URL;
        try { parsed = new URL(link.url); } catch { throw new Error(`Webサイト・SNSのURLが正しくありません: ${link.url}`); }
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error(`Webサイト・SNSは http(s) URLで入力してください: ${link.url}`);
      }
      const record: any = {
        $type: NSID.profile,
        ...clean({
          displayName,
          nativeName,
          namePreferredCitation,
          headline,
          bio,
          orcid,
          researchmapId,
          kakenId,
          googleScholarId,
        }),
        createdAt: createdAt ?? now(),
        updatedAt: now(),
      };
      if (Object.keys(primaryAffiliation).length) record.primaryAffiliation = primaryAffiliation;
      if (kw.length) record.keywords = kw;
      if (webLinks.length) record.websites = webLinks;
      if (acceptingStudents) record.acceptingStudents = true;
      if (openToCollaboration) record.openToCollaboration = true;

      const written = await client.putRecord(NSID.profile, "self", record);
      const verified = await client.getRecord(NSID.profile, "self");
      if (verified.uri !== written.uri || (verified.cid && verified.cid !== written.cid)) {
        throw new Error("PDS read-after-write verification failed");
      }
      setCreatedAt(record.createdAt);
      setSavedRecord({ title: record.displayName ?? "CVプロフィール", uri: verified.uri, cid: verified.cid, value: verified.value });
      setMsg({ kind: "ok", text: "プロフィールを PDS に保存し、読み戻し検証に成功しました。" });
    } catch (err: any) {
      setMsg({ kind: "err", text: `保存失敗: ${err?.message ?? err}` });
    } finally {
      setBusy(false);
    }
  }

  async function deleteDetail() {
    await client.deleteRecord(NSID.profile, "self");
    setSavedRecord(null);
    setCreatedAt(null);
    setMsg({ kind: "ok", text: "プロフィールを削除しました。" });
  }

  if (loading) return <div className="panel">読み込み中…</div>;

  return (
    <>
    <form className="panel" id="profile-form" onSubmit={save}>
      <h2>CV プロフィール</h2>
      <p className="hint">
        {createdAt ? "既存のプロフィールを編集中。" : "まだプロフィールがありません。作成します。"}
        rkey は <code>self</code> 固定で、1アカウント1件です。
      </p>

      <div className="subhead">氏名</div>
      <div className="grid">
        <Field label="表示名（CV表記）" value={displayName} onChange={setDisplayName} placeholder="Takeru Fukushima" />
        <Field label="ネイティブ表記" value={nativeName} onChange={setNativeName} placeholder="福島 岳" />
        <Field label="推奨引用名" value={namePreferredCitation} onChange={setNamePreferredCitation} placeholder="T. Fukushima" />
      </div>

      <hr className="sep" />
      <div className="subhead">肩書き・所属</div>
      <div className="grid">
        <Field label="ヘッドライン" value={headline} onChange={setHeadline} placeholder="Ph.D. Student in ..." />
        <Field label="主所属（機関名）" value={affName} onChange={setAffName} placeholder="Nagoya University" />
        <Field label="ROR ID" value={affRor} onChange={setAffRor} placeholder="04chrp450" />
        <Field label="部局・研究室" value={affDept} onChange={setAffDept} placeholder="Graduate School of ..." />
      </div>
      <div style={{ marginTop: 12 }}>
        <Field label="Bio" value={bio} onChange={setBio} textarea />
      </div>

      <hr className="sep" />
      <div className="subhead">識別子</div>
      <div className="grid">
        <Field label="ORCID" value={orcid} onChange={setOrcid} placeholder="0000-0002-1825-0097" />
        <Field label="researchmap ID" value={researchmapId} onChange={setResearchmapId} />
        <Field label="科研費 研究者番号" value={kakenId} onChange={setKakenId} placeholder="12345678" />
        <Field label="Google Scholar ID" value={googleScholarId} onChange={setGoogleScholarId} />
      </div>

      <hr className="sep" />
      <div className="subhead">Webサイト・SNS</div>
      <p className="hint">個人サイト、研究室ページ、GitHub、Bluesky、X、LinkedInなどの公開リンクを追加できます。</p>
      <div className="web-links">
        {websites.map((link, index) => (
          <div className="web-link-row" key={link.id}>
            <Field
              label="表示名"
              value={link.label}
              onChange={(value) => setWebsites((current) => current.map((item) => item.id === link.id ? { ...item, label: value } : item))}
              placeholder={index === 0 ? "Website" : "GitHub / Bluesky / X"}
            />
            <Field
              label="URL"
              type="url"
              value={link.url}
              onChange={(value) => setWebsites((current) => current.map((item) => item.id === link.id ? { ...item, url: value } : item))}
              placeholder="https://example.com"
            />
            <button className="btn danger small web-link-remove" type="button" onClick={() => setWebsites((current) => current.filter((item) => item.id !== link.id))}>
              削除
            </button>
          </div>
        ))}
      </div>
      {websites.length < 15 && (
        <button className="btn ghost small" type="button" onClick={() => setWebsites((current) => [...current, newWebLink()])}>
          ＋ リンクを追加
        </button>
      )}

      <hr className="sep" />
      <div className="subhead">研究キーワード・状態</div>
      <Field label="キーワード（カンマ区切り）" value={keywords} onChange={setKeywords} placeholder="ATProto, 分散SNS, 学術基盤" />
      <div className="row" style={{ marginTop: 12 }}>
        <Checkbox label="大学院生を受け入れ中" checked={acceptingStudents} onChange={setAcceptingStudents} />
        <Checkbox label="共同研究に前向き" checked={openToCollaboration} onChange={setOpenToCollaboration} />
      </div>

      <div className="toolbar">
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "保存中…" : createdAt ? "更新する" : "作成する"}
        </button>
        {savedRecord && (
          <button className="btn ghost" type="button" onClick={() => setShowDetail(true)}>
            公開レコードを確認
          </button>
        )}
      </div>
      <Message msg={msg} />
    </form>
    <RecordDetailDialog
      detail={showDetail ? savedRecord : null}
      onClose={() => setShowDetail(false)}
      onEdit={savedRecord ? () => document.getElementById("profile-form")?.scrollIntoView({ behavior: "smooth", block: "start" }) : undefined}
      onDelete={savedRecord ? deleteDetail : undefined}
    />
    </>
  );
}
