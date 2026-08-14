import React, { useEffect, useState } from "react";
import { Repo } from "../repo";
import { NSID } from "../lexicons";
import { Checkbox, Field, LanguageTextField, Message, Msg, clean, now } from "../ui";
import { RecordDetailData, RecordDetailDialog } from "../RecordDetail";
import { assertNoUndLanguageTexts, LanguageText, normalizeLanguageTexts, normalizeLanguageTextsForWrite, pickLanguageText } from "../languageText";
import { useI18n } from "../i18n";

interface WebLinkDraft {
  id: string;
  label: LanguageText[];
  url: string;
}

interface KeywordDraft {
  id: string;
  variants: LanguageText[];
}

let nextWebLinkId = 1;
const newWebLink = (label: LanguageText[] = [], url = ""): WebLinkDraft => ({ id: `web-link-${nextWebLinkId++}`, label, url });
let nextKeywordId = 1;
const newKeyword = (variants: LanguageText[] = []): KeywordDraft => ({ id: `keyword-${nextKeywordId++}`, variants });

function languageTexts(value: unknown): LanguageText[] {
  return normalizeLanguageTexts(value);
}

function keywordDrafts(value: unknown): KeywordDraft[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((keyword) => {
    const variants = languageTexts((keyword as { variants?: unknown } | null)?.variants);
    return variants.length ? [newKeyword(variants)] : [];
  });
}

// id.career.profile — single record, rkey "self".
export function ProfileTab({ client }: { client: Repo }) {
  const { locale, text } = useI18n();
  const [displayName, setDisplayName] = useState<LanguageText[]>([]);
  const [nativeName, setNativeName] = useState<LanguageText[]>([]);
  const [namePreferredCitation, setNamePreferredCitation] = useState<LanguageText[]>([]);
  const [headline, setHeadline] = useState<LanguageText[]>([]);
  const [bio, setBio] = useState<LanguageText[]>([]);
  const [affName, setAffName] = useState<LanguageText[]>([]);
  const [affRor, setAffRor] = useState("");
  const [affDept, setAffDept] = useState<LanguageText[]>([]);
  const [orcid, setOrcid] = useState("");
  const [researchmapId, setResearchmapId] = useState("");
  const [kakenId, setKakenId] = useState("");
  const [googleScholarId, setGoogleScholarId] = useState("");
  const [websites, setWebsites] = useState<WebLinkDraft[]>([newWebLink()]);
  const [keywords, setKeywords] = useState<KeywordDraft[]>([]);
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
        setDisplayName(languageTexts(v.displayName));
        setNativeName(languageTexts(v.nativeName));
        setNamePreferredCitation(languageTexts(v.namePreferredCitation));
        setHeadline(languageTexts(v.headline));
        setBio(languageTexts(v.bio));
        setAffName(languageTexts(v.primaryAffiliation?.name));
        setAffRor(v.primaryAffiliation?.ror ?? "");
        setAffDept(languageTexts(v.primaryAffiliation?.department));
        setOrcid(v.orcid ?? "");
        setResearchmapId(v.researchmapId ?? "");
        setKakenId(v.kakenId ?? "");
        setGoogleScholarId(v.googleScholarId ?? "");
        setWebsites(v.websites?.length
          ? v.websites.map((link: any) => newWebLink(languageTexts(link.label), link.url ?? ""))
          : [newWebLink()]);
        setKeywords(keywordDrafts(v.keywords));
        setAcceptingStudents(!!v.acceptingStudents);
        setOpenToCollaboration(!!v.openToCollaboration);
        setCreatedAt(v.createdAt ?? null);
        setSavedRecord({ title: pickLanguageText(v.displayName, locale) || text("CVプロフィール", "CV profile"), uri: rec.uri, cid: rec.cid, value: v });
      } catch {
        // No profile yet; the form starts empty.
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
      const normalizedAffName = normalizeLanguageTextsForWrite(affName);
      const normalizedAffDept = normalizeLanguageTextsForWrite(affDept);
      if ((affRor.trim() || normalizedAffDept.length) && !normalizedAffName.length) {
        throw new Error(text("主所属には機関名が必要です。", "A primary affiliation requires an organization name."));
      }
      const primaryAffiliation = clean({ name: normalizedAffName, ror: affRor, department: normalizedAffDept });
      const kw = keywords
        .map(({ variants }) => ({ variants: normalizeLanguageTextsForWrite(variants) }))
        .filter((keyword) => keyword.variants.length);
      const webLinks = websites
        .map(({ label, url }) => clean({ label: normalizeLanguageTextsForWrite(label), url: url.trim() }))
        .filter((link) => link.url);
      for (const link of webLinks) {
        let parsed: URL;
        try { parsed = new URL(link.url as string); } catch { throw new Error(text(`Webサイト・SNSのURLが正しくありません: ${link.url}`, `The website or social URL is invalid: ${link.url}`)); }
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error(text(`Webサイト・SNSは http(s) URLで入力してください: ${link.url}`, `Website and social links must use an HTTP(S) URL: ${link.url}`));
      }
      const base: Record<string, any> = structuredClone(savedRecord?.value ?? {});
      for (const key of [
        "displayName", "nativeName", "namePreferredCitation", "headline", "bio", "primaryAffiliation",
        "orcid", "researchmapId", "kakenId", "googleScholarId", "keywords", "websites",
        "acceptingStudents", "openToCollaboration", "updatedAt",
      ]) delete base[key];
      const record: any = {
        ...base,
        $type: NSID.profile,
        ...clean({
          displayName: normalizeLanguageTextsForWrite(displayName),
          nativeName: normalizeLanguageTextsForWrite(nativeName),
          namePreferredCitation: normalizeLanguageTextsForWrite(namePreferredCitation),
          headline: normalizeLanguageTextsForWrite(headline),
          bio: normalizeLanguageTextsForWrite(bio),
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
      assertNoUndLanguageTexts(record);

      const written = await client.putRecord(NSID.profile, "self", record);
      const verified = await client.getRecord(NSID.profile, "self");
      if (verified.uri !== written.uri || (verified.cid && verified.cid !== written.cid)) {
        throw new Error("PDS read-after-write verification failed");
      }
      setCreatedAt(record.createdAt);
      setSavedRecord({ title: pickLanguageText(verified.value.displayName, locale) || text("CVプロフィール", "CV profile"), uri: verified.uri, cid: verified.cid, value: verified.value });
      setMsg({ kind: "ok", text: text("プロフィールを PDS に保存し、読み戻し検証に成功しました。", "The profile was saved to the PDS and verified by reading it back.") });
    } catch (err: any) {
      setMsg({ kind: "err", text: `${text("保存失敗", "Save failed")}: ${err?.message ?? err}` });
    } finally {
      setBusy(false);
    }
  }

  async function deleteDetail() {
    await client.deleteRecord(NSID.profile, "self");
    setSavedRecord(null);
    setCreatedAt(null);
    setMsg({ kind: "ok", text: text("プロフィールを削除しました。", "The profile was deleted.") });
  }

  if (loading) return <div className="panel">{text("読み込み中…", "Loading...")}</div>;

  return (
    <>
    <form className="panel" id="profile-form" onSubmit={save}>
      <h2>{text("CV プロフィール", "CV Profile")}</h2>
      <p className="hint">
        {createdAt ? text("既存のプロフィールを編集中。", "Editing the existing profile.") : text("まだプロフィールがありません。作成します。", "No profile exists yet. Create one below.")}
        {text("rkey は", "The rkey is fixed to")} <code>self</code>{text(" 固定で、1アカウント1件です。", ", with one profile per account.")}
      </p>

      <div className="subhead">{text("氏名", "Name")}</div>
      <div className="grid">
        <LanguageTextField label={text("表示名（CV表記）", "Display name (CV)")} value={displayName} onChange={setDisplayName} placeholder="Takeru Fukushima" />
        <LanguageTextField label={text("ネイティブ表記", "Name in native script")} value={nativeName} onChange={setNativeName} placeholder={text("福島 岳", "Takeru Fukushima")} />
        <LanguageTextField label={text("推奨引用名", "Preferred citation name")} value={namePreferredCitation} onChange={setNamePreferredCitation} placeholder="T. Fukushima" />
      </div>

      <hr className="sep" />
      <div className="subhead">{text("肩書き・所属", "Headline and Affiliation")}</div>
      <div className="grid">
        <LanguageTextField label={text("ヘッドライン", "Headline")} value={headline} onChange={setHeadline} placeholder="Ph.D. Student in ..." />
        <LanguageTextField label={text("主所属（機関名）", "Primary affiliation (organization)")} value={affName} onChange={setAffName} placeholder="Nagoya University" />
        <Field label="ROR ID" value={affRor} onChange={setAffRor} placeholder="04chrp450" />
        <LanguageTextField label={text("部局・研究室", "Department or laboratory")} value={affDept} onChange={setAffDept} placeholder="Graduate School of ..." />
      </div>
      <div style={{ marginTop: 12 }}>
        <LanguageTextField label="Bio" value={bio} onChange={setBio} textarea />
      </div>

      <hr className="sep" />
      <div className="subhead">{text("識別子", "Identifiers")}</div>
      <div className="grid">
        <Field label="ORCID" value={orcid} onChange={setOrcid} placeholder="0000-0002-1825-0097" />
        <Field label="researchmap ID" value={researchmapId} onChange={setResearchmapId} />
        <Field label={text("科研費 研究者番号", "KAKEN researcher number")} value={kakenId} onChange={setKakenId} placeholder="12345678" />
        <Field label="Google Scholar ID" value={googleScholarId} onChange={setGoogleScholarId} />
      </div>

      <hr className="sep" />
      <div className="subhead">{text("Webサイト・SNS", "Websites and Social Media")}</div>
      <p className="hint">{text("個人サイト、研究室ページ、GitHub、Bluesky、X、LinkedInなどの公開リンクを追加できます。", "Add public links such as a personal site, laboratory page, GitHub, Bluesky, X, or LinkedIn.")}</p>
      <div className="web-links">
        {websites.map((link, index) => (
          <div className="web-link-row" key={link.id}>
            <LanguageTextField
              label={text("表示名", "Label")}
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
              {text("削除", "Remove")}
            </button>
          </div>
        ))}
      </div>
      {websites.length < 15 && (
        <button className="btn ghost small" type="button" onClick={() => setWebsites((current) => [...current, newWebLink()])}>
          {text("＋ リンクを追加", "+ Add link")}
        </button>
      )}

      <hr className="sep" />
      <div className="subhead">{text("研究キーワード・状態", "Research Keywords and Status")}</div>
      {keywords.map((keyword, index) => (
        <div className="web-link-row" key={keyword.id}>
          <LanguageTextField
            label={text(`キーワード ${index + 1}`, `Keyword ${index + 1}`)}
            value={keyword.variants}
            onChange={(variants) => setKeywords((current) => current.map((item) => item.id === keyword.id ? { ...item, variants } : item))}
            placeholder={text("分散SNS", "decentralized social networking")}
          />
          <button className="btn danger small" type="button" onClick={() => setKeywords((current) => current.filter((item) => item.id !== keyword.id))}>
            {text("削除", "Remove")}
          </button>
        </div>
      ))}
      {keywords.length < 30 && (
        <button className="btn ghost small" type="button" onClick={() => setKeywords((current) => [...current, newKeyword()])}>
          {text("＋ キーワードを追加", "+ Add keyword")}
        </button>
      )}
      <div className="row" style={{ marginTop: 12 }}>
        <Checkbox label={text("大学院生を受け入れ中", "Accepting graduate students")} checked={acceptingStudents} onChange={setAcceptingStudents} />
        <Checkbox label={text("共同研究に前向き", "Open to collaboration")} checked={openToCollaboration} onChange={setOpenToCollaboration} />
      </div>

      <div className="toolbar">
        <button className="btn" type="submit" disabled={busy}>
          {busy ? text("保存中…", "Saving...") : createdAt ? text("更新する", "Update") : text("作成する", "Create")}
        </button>
        {savedRecord && (
          <button className="btn ghost" type="button" onClick={() => setShowDetail(true)}>
            {text("公開レコードを確認", "View public record")}
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
