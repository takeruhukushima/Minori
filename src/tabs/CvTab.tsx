import React, { useEffect, useState } from "react";
import { rkeyFromUri, StrongRef } from "../atproto";
import { listAllRecords, Repo } from "../repo";
import { NSID } from "../lexicons";
import { Checkbox, Field, Message, Msg, SelectField, clean, now } from "../ui";
import { RecordCardShell, RecordDetailData, RecordDetailDialog } from "../RecordDetail";

type FieldType = "text" | "textarea" | "select" | "checkbox" | "org";

interface FieldDef {
  key: string;
  label: string;
  type?: FieldType;
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}

interface SectionDef {
  nsid: string;
  title: string;
  hint: string;
  fields: FieldDef[];
  // Which text keys are required (org requires its .name).
  render: (v: any) => { title: string; meta: string };
}

const opt = (values: string[]) => [
  { value: "", label: "（未選択）" },
  ...values.map((x) => ({ value: x, label: x })),
];

const SECTIONS: SectionDef[] = [
  {
    nsid: NSID.position,
    title: "職歴・ポジション (Sifa)",
    hint: "id.sifa.profile.position — Sifaの共有Lexiconへ直接保存します。日付は YYYY-MM または YYYY-MM-DD。",
    fields: [
      { key: "title", label: "役職・肩書き", required: true, placeholder: "Assistant Professor" },
      { key: "company", label: "機関・組織名", placeholder: "Nagoya University" },
      { key: "entityRef", label: "組織URI (ROR / Wikidata / LEI)", placeholder: "https://ror.org/00..." },
      { key: "startedAt", label: "開始", required: true, placeholder: "2024-04" },
      { key: "endedAt", label: "終了", placeholder: "2026-03（現職は空欄）" },
      { key: "employmentType", label: "雇用形態", type: "select", options: opt(["id.sifa.defs#fullTime", "id.sifa.defs#partTime", "id.sifa.defs#temporary", "id.sifa.defs#seasonal", "id.sifa.defs#contract", "id.sifa.defs#freelance", "id.sifa.defs#selfEmployed", "id.sifa.defs#independentWork", "id.sifa.defs#internship", "id.sifa.defs#apprenticeship", "id.sifa.defs#fellowship", "id.sifa.defs#trainee", "id.sifa.defs#volunteer", "id.sifa.defs#boardMember", "id.sifa.defs#boardObserver", "id.sifa.defs#advisor"]) },
      { key: "workplaceType", label: "勤務形態", type: "select", options: opt(["id.sifa.defs#onSite", "id.sifa.defs#remote", "id.sifa.defs#hybrid"]) },
      { key: "isPrimary", label: "主要な現職", type: "checkbox" },
      { key: "description", label: "職務・実績", type: "textarea" },
    ],
    render: (v) => ({
      title: `${v.title ?? "?"}${v.company ? " — " + v.company : ""}`,
      meta: [v.employmentType?.replace("id.sifa.defs#", ""), [v.startedAt, v.endedAt].filter(Boolean).join("–")].filter(Boolean).join(" · "),
    }),
  },
  {
    nsid: NSID.education,
    title: "学歴",
    hint: "id.career.education — 学位・学位論文・指導教員。日付は YYYY / YYYY-MM / YYYY-MM-DD。",
    fields: [
      { key: "institution", label: "機関", type: "org", required: true },
      { key: "degree", label: "学位レベル", type: "select", options: opt(["doctorate", "master", "bachelor", "associate", "postdoctoral", "nonDegree", "highSchool"]) },
      { key: "degreeName", label: "学位名（印字用）", placeholder: "博士(工学)" },
      { key: "fieldOfStudy", label: "専攻分野" },
      { key: "status", label: "状態", type: "select", options: opt(["completed", "inProgress", "expected", "withdrawn", "creditsCompletedNoDegree"]) },
      { key: "startedAt", label: "開始 (YYYY-MM)", placeholder: "2023-04" },
      { key: "endedAt", label: "終了 (YYYY-MM)", placeholder: "2027-03" },
      { key: "thesisTitle", label: "学位論文タイトル", type: "textarea" },
    ],
    render: (v) => ({
      title: `${v.institution?.name ?? "?"}${v.degreeName ? " — " + v.degreeName : ""}`,
      meta: [v.status, [v.startedAt, v.endedAt].filter(Boolean).join("–")].filter(Boolean).join(" · "),
    }),
  },
  {
    nsid: NSID.award,
    title: "受賞",
    hint: "id.career.award — 賞・栄誉。",
    fields: [
      { key: "name", label: "受賞名", required: true, placeholder: "Best Paper Award" },
      { key: "conferredBy", label: "授与機関", type: "org" },
      { key: "date", label: "受賞日 (YYYY-MM)", placeholder: "2025-03" },
      { key: "category", label: "カテゴリ", placeholder: "若手奨励賞" },
      { key: "scope", label: "範囲", type: "select", options: opt(["international", "national", "regional", "institutional", "departmental"]) },
      { key: "selectionPool", label: "選出母数（引用）", placeholder: "1 of 480 submissions" },
      { key: "description", label: "説明", type: "textarea" },
      { key: "url", label: "URL" },
    ],
    render: (v) => ({
      title: v.name ?? "?",
      meta: [v.conferredBy?.name, v.date].filter(Boolean).join(" · "),
    }),
  },
  {
    nsid: NSID.presentation,
    title: "講演・発表",
    hint: "id.career.presentation — 講演・ポスター・パネル・チュートリアル。",
    fields: [
      { key: "title", label: "タイトル", required: true },
      { key: "type", label: "種別", type: "select", required: true, options: opt(["keynote", "invited", "contributed", "poster", "panel", "tutorial", "seminar", "lightning", "demo", "publicLecture", "thesisDefense"]) },
      { key: "eventName", label: "イベント名" },
      { key: "eventSeries", label: "シリーズ名", placeholder: "NeurIPS" },
      { key: "place", label: "開催地" },
      { key: "country", label: "国コード (ISO2)", placeholder: "JP" },
      { key: "date", label: "日付 (YYYY-MM-DD)", placeholder: "2025-09-01" },
      { key: "language", label: "言語 (BCP-47)", placeholder: "ja" },
      { key: "scope", label: "範囲", type: "select", options: opt(["international", "national", "regional", "institutional", "departmental"]) },
      { key: "refereed", label: "査読あり", type: "checkbox" },
      { key: "isOnline", label: "オンライン開催", type: "checkbox" },
    ],
    render: (v) => ({
      title: v.title ?? "?",
      meta: [v.type, v.eventName, v.date].filter(Boolean).join(" · "),
    }),
  },
  {
    nsid: NSID.grant,
    title: "研究資金",
    hint: "id.career.grant — 競争的資金・受託研究・共同研究。金額は公開されます。",
    fields: [
      { key: "title", label: "課題名", required: true },
      { key: "funder", label: "配分機関", type: "org", required: true },
      { key: "programName", label: "事業名", placeholder: "科学研究費助成事業 基盤研究(C)" },
      { key: "awardNumber", label: "課題番号", placeholder: "23K12345" },
      { key: "role", label: "役割", type: "select", options: opt(["pi", "coPi", "coInvestigator", "fellow", "collaborator", "hostResearcher", "researchAssistant"]) },
      { key: "status", label: "状態", type: "select", options: opt(["awarded", "active", "completed", "submitted", "underReview", "notFunded"]) },
      { key: "fundingType", label: "資金種別", type: "select", options: opt(["kakenhi", "amed", "jst", "nedo", "ministry", "foundation", "contractResearch", "jointResearch", "donation", "industryFunded", "international"]) },
      { key: "startedAt", label: "開始 (YYYY)", placeholder: "2024" },
      { key: "endedAt", label: "終了 (YYYY)", placeholder: "2027" },
      { key: "url", label: "URL" },
    ],
    render: (v) => ({
      title: v.title ?? "?",
      meta: [v.funder?.name, v.programName, v.awardNumber].filter(Boolean).join(" · "),
    }),
  },
  {
    nsid: NSID.service,
    title: "委員・学術貢献",
    hint: "査読は匿名性保護のため、学会・媒体名と期間だけを記録してください。対象論文は記録しません。",
    fields: [
      { key: "type", label: "種別", type: "select", required: true, options: opt(["peerReview", "editorInChief", "editor", "associateEditor", "guestEditor", "editorialBoard", "areaChair", "seniorPcMember", "pcMember", "organizer", "generalChair", "programChair", "sessionChair", "societyRole", "committee", "governmentCommittee", "academyMember", "advisoryBoard", "externalExaminer", "grantReviewer", "accreditationReviewer", "mentoring"]) },
      { key: "venue", label: "学会・媒体・委員会", required: true },
      { key: "venueOrg", label: "組織", type: "org" },
      { key: "roleTitle", label: "役職名" },
      { key: "startedAt", label: "開始", placeholder: "2024-04" },
      { key: "endedAt", label: "終了", placeholder: "2026-03" },
      { key: "status", label: "状態", type: "select", options: opt(["current", "past"]) },
    ],
    render: (v) => ({ title: v.venue ?? "?", meta: [v.type, v.roleTitle, v.startedAt].filter(Boolean).join(" · ") }),
  },
  {
    nsid: NSID.membership,
    title: "所属学協会",
    hint: "学協会への所属。",
    fields: [
      { key: "organization", label: "学協会", type: "org", required: true },
      { key: "grade", label: "会員区分", type: "select", options: opt(["regular", "student", "associate", "senior", "fellow", "honorary", "emeritus", "lifetime", "corporate"]) },
      { key: "status", label: "状態", type: "select", options: opt(["current", "past"]) },
      { key: "startedAt", label: "開始", placeholder: "2022" },
      { key: "endedAt", label: "終了", placeholder: "2025" },
    ],
    render: (v) => ({ title: v.organization?.name ?? "?", meta: [v.grade, v.status].filter(Boolean).join(" · ") }),
  },
  {
    nsid: NSID.teaching,
    title: "担当授業",
    hint: "担当経験のある科目。",
    fields: [
      { key: "courseName", label: "科目名", required: true },
      { key: "institution", label: "機関", type: "org", required: true },
      { key: "level", label: "課程", type: "select", options: opt(["undergraduate", "graduate", "doctoral", "professional", "highSchool", "continuingEducation", "outreach"]) },
      { key: "role", label: "役割", type: "select", options: opt(["instructor", "coInstructor", "ta", "guestLecturer", "labInstructor", "courseDesigner", "tutor"]) },
      { key: "startedAt", label: "開始", placeholder: "2024-04" },
      { key: "endedAt", label: "終了", placeholder: "2024-09" },
    ],
    render: (v) => ({ title: v.courseName ?? "?", meta: [v.institution?.name, v.role, v.startedAt].filter(Boolean).join(" · ") }),
  },
  {
    nsid: NSID.supervision,
    title: "学生指導",
    hint: "学生氏名は既定で記録しません。本人のDIDがある場合のみ別途紐付ける設計です。",
    fields: [
      { key: "role", label: "役割", type: "select", required: true, options: opt(["primaryAdvisor", "coAdvisor", "committeeMember", "externalExaminer", "labSupervisor", "internshipSupervisor", "postdocMentor", "informalMentor"]) },
      { key: "degree", label: "課程", type: "select", options: opt(["doctorate", "master", "bachelor", "postdoc", "intern", "visitingStudent", "highSchool"]) },
      { key: "thesisTitle", label: "研究テーマ・論文題目" },
      { key: "institution", label: "機関", type: "org" },
      { key: "status", label: "状態", type: "select", options: opt(["inProgress", "completed", "discontinued"]) },
      { key: "startedAt", label: "開始", placeholder: "2024" },
      { key: "endedAt", label: "終了", placeholder: "2026" },
    ],
    render: (v) => ({ title: v.thesisTitle ?? v.role ?? "?", meta: [v.degree, v.status, v.institution?.name].filter(Boolean).join(" · ") }),
  },
  {
    nsid: NSID.patent,
    title: "産業財産権",
    hint: "特許・実用新案・意匠・商標。公開PDSに書ける情報だけを入力してください。",
    fields: [
      { key: "title", label: "名称", required: true },
      { key: "rightType", label: "権利種別", type: "select", options: opt(["patent", "utilityModel", "designRight", "trademark", "plantVariety"]) },
      { key: "applicationNumber", label: "出願番号" },
      { key: "registrationNumber", label: "登録番号" },
      { key: "status", label: "状態", type: "select", options: opt(["filed", "published", "underExamination", "granted", "rejected", "withdrawn", "abandoned", "expired", "licensed"]) },
      { key: "filingDate", label: "出願日", placeholder: "2025-01-20" },
      { key: "url", label: "URL" },
    ],
    render: (v) => ({ title: v.title ?? "?", meta: [v.rightType, v.applicationNumber, v.status].filter(Boolean).join(" · ") }),
  },
  {
    nsid: NSID.outreach,
    title: "社会貢献・メディア",
    hint: "社会貢献活動、報道、一般向けイベント。",
    fields: [
      { key: "title", label: "タイトル", required: true },
      { key: "kind", label: "種別", type: "select", options: opt(["publicLecture", "scienceCafe", "workshop", "symposium", "panel", "schoolVisit", "exhibition", "openCampus", "mediaAppearance", "newspaper", "magazine", "tvRadio", "webArticle", "podcast", "interview", "pressRelease", "policyAdvice", "consultation", "competitionJudging", "other"]) },
      { key: "organizer", label: "主催", type: "org" },
      { key: "mediaOutlet", label: "媒体名" },
      { key: "startedAt", label: "日付", placeholder: "2025-06-01" },
      { key: "audience", label: "対象", type: "select", options: opt(["generalPublic", "schoolStudents", "undergraduates", "industry", "policymakers", "patients", "media"]) },
      { key: "url", label: "URL" },
      { key: "description", label: "説明", type: "textarea" },
    ],
    render: (v) => ({ title: v.title ?? "?", meta: [v.kind, v.organizer?.name ?? v.mediaOutlet, v.startedAt].filter(Boolean).join(" · ") }),
  },
  {
    nsid: NSID.work,
    title: "Works",
    hint: "提言・報告書・作品・展示。ソースリポジトリやパッケージがある成果はOSS欄へ。",
    fields: [
      { key: "title", label: "名称", required: true },
      { key: "kind", label: "種別", type: "select", options: opt(["policyRecommendation", "committeeReport", "whitePaper", "database", "teachingMaterial", "textbook", "artwork", "exhibition", "performance", "composition", "design", "architecture", "film", "standard", "translation", "guideline", "protocol", "other"]) },
      { key: "startedAt", label: "開始・公開日", placeholder: "2025" },
      { key: "organization", label: "公開主体", type: "org" },
      { key: "url", label: "URL" },
      { key: "description", label: "説明", type: "textarea" },
    ],
    render: (v) => ({ title: v.title ?? "?", meta: [v.kind, v.organization?.name, v.startedAt].filter(Boolean).join(" · ") }),
  },
  {
    nsid: NSID.openSourceContribution,
    title: "OSS・公開データ",
    hint: "ソフトウェア、公開データ、仕様、ドキュメントへの貢献。",
    fields: [
      { key: "name", label: "プロジェクト名", required: true },
      { key: "role", label: "役割", type: "select", options: opt(["author", "maintainer", "coreContributor", "contributor", "reviewer", "documentation", "translator", "communityOrganizer"]) },
      { key: "projectKind", label: "種別", type: "select", options: opt(["library", "application", "researchSoftware", "dataset", "specification", "documentation", "infrastructure"]) },
      { key: "repoUrl", label: "リポジトリURL" },
      { key: "startedAt", label: "開始", placeholder: "2023" },
      { key: "status", label: "状態", type: "select", options: opt(["active", "maintenance", "past", "archived"]) },
      { key: "description", label: "説明", type: "textarea" },
    ],
    render: (v) => ({ title: v.name ?? "?", meta: [v.projectKind, v.role, v.status].filter(Boolean).join(" · ") }),
  },
];

const ORG_SUBS = [
  { suffix: "name", label: "名称", required: true },
  { suffix: "ror", label: "ROR ID" },
  { suffix: "department", label: "部局" },
];

export function CvTab({ client }: { client: Repo }) {
  return (
    <>
      <PublicationsSection client={client} />
      {SECTIONS.map((s) => (
        <Section key={s.nsid} client={client} def={s} />
      ))}
    </>
  );
}

const PUBLICATION_TYPES = ["article-journal", "paper-conference", "preprint", "chapter", "book", "thesis", "report", "dataset", "software"].map((value) => ({ value, label: value }));
const OUTPUT_CATEGORIES = ["article", "misc", "book", "other"].map((value) => ({ value, label: value }));

function PublicationsSection({ client }: { client: Repo }) {
  const [records, setRecords] = useState<{ authorship: any; reference: any | null }[]>([]);
  const [detail, setDetail] = useState<RecordDetailData | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("article-journal");
  const [authors, setAuthors] = useState("");
  const [venue, setVenue] = useState("");
  const [year, setYear] = useState("");
  const [doi, setDoi] = useState("");
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState("article");
  const [featured, setFeatured] = useState(false);
  const [claim, setClaim] = useState(true);
  const [editing, setEditing] = useState<{ authorship: any; reference: any } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function load() {
    try {
      const claims = await listAllRecords(client, NSID.authorship);
      const resolved = await Promise.all(claims.map(async (authorship) => {
        try {
          const uri = authorship.value.reference?.uri;
          if (!uri) return { authorship, reference: null };
          const reference = await client.getRecord(NSID.reference, rkeyFromUri(uri));
          return { authorship, reference };
        } catch { return { authorship, reference: null }; }
      }));
      setRecords(resolved);
    } catch { setRecords([]); }
  }

  useEffect(() => { load(); }, [client.did]);

  function reset() {
    setTitle(""); setType("article-journal"); setAuthors(""); setVenue(""); setYear("");
    setDoi(""); setUrl(""); setCategory("article"); setFeatured(false);
    setClaim(true);
    setEditing(null);
  }

  function startEdit(entry: { authorship: any; reference: any | null }) {
    if (!entry.reference) return setMsg({ kind: "err", text: "参照レコードを取得できないため編集できません。" });
    const value = entry.reference.value;
    setTitle(value.title ?? ""); setType(value.type ?? "article-journal");
    setAuthors((value.contributors ?? []).map((person: any) => person.literal ?? person.name ?? "").filter(Boolean).join("\n"));
    setVenue(value.containerTitle ?? ""); setYear(value.issued?.year ? String(value.issued.year) : "");
    setDoi(value.doi ?? ""); setUrl(value.url ?? "");
    setCategory(entry.authorship.value.outputCategory ?? "article"); setFeatured(!!entry.authorship.value.isFeatured);
    setClaim(true);
    setEditing({ authorship: entry.authorship, reference: entry.reference }); setMsg(null);
    document.getElementById("cv-publications")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function addPublication(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return setMsg({ kind: "err", text: "タイトルは必須です。" });
    setBusy(true); setMsg(null);
    let referenceRef: StrongRef | null = null;
    try {
      const contributors = authors.split(/[;,\n]/).map((name) => name.trim()).filter(Boolean)
        .map((literal, index) => ({ role: "author", literal, sequence: index + 1 }));
      const parsedYear = Number.parseInt(year, 10);
      const reference: any = {
        $type: NSID.reference, type, title: title.trim(), createdAt: now(),
        ...clean({ containerTitle: venue, doi: doi.trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "").toLowerCase(), url }),
      };
      if (contributors.length) reference.contributors = contributors;
      if (!Number.isNaN(parsedYear)) reference.issued = { year: parsedYear };
      referenceRef = editing
        ? await client.putRecord(NSID.reference, rkeyFromUri(editing.reference.uri), { ...reference, createdAt: editing.reference.value.createdAt ?? reference.createdAt })
        : await client.createRecord(NSID.reference, reference);
      const authorshipRecord = {
        $type: NSID.authorship,
        reference: referenceRef,
        role: "author",
        outputCategory: category,
        ...(featured ? { isFeatured: true } : {}),
        createdAt: editing?.authorship.value.createdAt ?? now(),
      };
      if (editing) {
        if (claim) {
          await client.putRecord(NSID.authorship, rkeyFromUri(editing.authorship.uri), authorshipRecord);
        } else {
          await client.deleteRecord(NSID.authorship, rkeyFromUri(editing.authorship.uri));
        }
        const linkedItems = (await listAllRecords(client, NSID.collectionItem)).filter((record) => record.value.reference?.uri === editing.reference.uri);
        await Promise.all(linkedItems.map((record) => client.putRecord(NSID.collectionItem, rkeyFromUri(record.uri), {
          ...record.value, reference: referenceRef,
        })));
      } else {
        await client.createRecord(NSID.authorship, authorshipRecord);
      }
      const wasEditing = !!editing;
      reset(); await load();
      setMsg({ kind: "ok", text: wasEditing && !claim ? "文献情報を更新し、自分の業績から外しました。" : `論文・出版物を${wasEditing ? "更新" : "CVへ登録"}しました。` });
    } catch (error: any) {
      if (referenceRef && !editing) await client.deleteRecord(NSID.reference, rkeyFromUri(referenceRef.uri)).catch(() => {});
      setMsg({ kind: "err", text: `登録失敗: ${error?.message ?? error}` });
    } finally { setBusy(false); }
  }

  async function removeClaim(uri: string) {
    await client.deleteRecord(NSID.authorship, rkeyFromUri(uri));
    await load();
    setMsg({ kind: "ok", text: "CVの論文一覧から外しました。文献レコードは保持されています。" });
  }

  return (
    <>
      <div className="panel" id="cv-publications">
        <h2>論文・出版物 <span className="tag">{records.length}</span></h2>
        <p className="hint">自分が著者として発表した成果です。プロジェクトで業績登録した論文もここに表示されます。</p>
        <form onSubmit={addPublication}>
          <div className="grid">
            <SelectField label="種別 (CSL)" value={type} onChange={setType} options={PUBLICATION_TYPES} />
            <Field label="タイトル" required value={title} onChange={setTitle} />
            <Field label="掲載誌・会議名" value={venue} onChange={setVenue} />
            <Field label="発行年" value={year} onChange={setYear} placeholder="2026" />
            <Field label="DOI" value={doi} onChange={setDoi} />
            <Field label="URL" value={url} onChange={setUrl} />
          </div>
          <div style={{ marginTop: 12 }}><Field label="著者（カンマ、;、改行区切り）" value={authors} onChange={setAuthors} textarea /></div>
          <div className="row" style={{ marginTop: 12 }}>
            {editing && <Checkbox label="自分の業績として登録" checked={claim} onChange={setClaim} />}
            {(!editing || claim) && <>
              <SelectField label="CV区分" value={category} onChange={setCategory} options={OUTPUT_CATEGORIES} />
              <Checkbox label="主要業績" checked={featured} onChange={setFeatured} />
            </>}
          </div>
          <div className="toolbar">
            <button className="btn" disabled={busy}>{busy ? "保存中…" : editing ? "論文・出版物を更新" : "論文・出版物を登録"}</button>
            {editing && <button className="btn ghost" type="button" onClick={reset}>編集をキャンセル</button>}
          </div>
          <Message msg={msg} />
        </form>
        <div className="list">
          {records.length === 0 && <div className="empty">まだ論文・出版物がありません。</div>}
          {records.map(({ authorship, reference }) => (
            <RecordCardShell key={authorship.uri} onOpen={() => setDetail({
              title: reference?.value.title ?? "文献レコード",
              uri: authorship.uri,
              cid: authorship.cid,
              value: { referenceRecord: reference?.value ?? null, referenceUri: reference?.uri ?? null, authorshipRecord: authorship.value },
            })}>
              <div><div className="title">{reference?.value.title ?? "（参照解決できず）"}</div><div className="meta">{[reference?.value.containerTitle, reference?.value.issued?.year].filter(Boolean).join(" · ")}</div></div>
              <button className="btn danger small" type="button" onClick={(event) => { event.stopPropagation(); if (confirm("CVの論文一覧から外しますか？")) removeClaim(authorship.uri); }}>CVから外す</button>
            </RecordCardShell>
          ))}
        </div>
      </div>
      <RecordDetailDialog
        detail={detail}
        onClose={() => setDetail(null)}
        onEdit={detail?.uri ? () => {
          const entry = records.find(({ authorship }) => authorship.uri === detail.uri);
          if (entry) startEdit(entry);
        } : undefined}
        onDelete={detail?.uri ? () => removeClaim(detail.uri!) : undefined}
      />
    </>
  );
}

function Section({ client, def }: { client: Repo; def: SectionDef }) {
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [records, setRecords] = useState<{ uri: string; cid: string; value: any }[]>([]);
  const [detail, setDetail] = useState<RecordDetailData | null>(null);
  const [editing, setEditing] = useState<{ uri: string; createdAt?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const set = (k: string, v: string | boolean) => setValues((prev) => ({ ...prev, [k]: v }));
  const sv = (k: string) => (values[k] as string) ?? "";
  const bv = (k: string) => (values[k] as boolean) ?? false;

  async function load() {
    try {
      const records = await listAllRecords(client, def.nsid);
      setRecords(records.map((r) => ({ uri: r.uri, cid: r.cid, value: r.value })));
    } catch {
      setRecords([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.did, def.nsid]);

  function buildRecord(): any {
    const rec: any = { $type: def.nsid, createdAt: editing?.createdAt ?? now() };
    for (const f of def.fields) {
      if (f.type === "org") {
        const org = clean({
          name: sv(`${f.key}.name`),
          ror: sv(`${f.key}.ror`),
          department: sv(`${f.key}.department`),
        });
        if (Object.keys(org).length) rec[f.key] = org;
      } else if (f.type === "checkbox") {
        if (bv(f.key)) rec[f.key] = true;
      } else {
        const t = sv(f.key).trim();
        if (t !== "") rec[f.key] = t;
      }
    }
    return rec;
  }

  function validate(rec: any): string | null {
    for (const f of def.fields) {
      if (!f.required) continue;
      if (f.type === "org") {
        if (!rec[f.key]?.name) return `${f.label}（名称）は必須です`;
      } else if (!rec[f.key]) {
        return `${f.label} は必須です`;
      }
    }
    return null;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const rec = buildRecord();
      const err = validate(rec);
      if (err) {
        setMsg({ kind: "err", text: err });
        setBusy(false);
        return;
      }
      const written = editing
        ? await client.putRecord(def.nsid, rkeyFromUri(editing.uri), rec)
        : await client.createRecord(def.nsid, rec);
      const verified = await client.getRecord(def.nsid, rkeyFromUri(written.uri));
      if (verified.uri !== written.uri || (verified.cid && verified.cid !== written.cid)) {
        throw new Error("PDS read-after-write verification failed");
      }
      setValues({});
      const wasEditing = !!editing;
      setEditing(null);
      await load();
      setMsg({ kind: "ok", text: `${def.title} を${wasEditing ? "更新" : "追加"}し、PDSからの読み戻しを確認しました。` });
    } catch (err: any) {
      setMsg({ kind: "err", text: `追加失敗: ${err?.message ?? err}` });
    } finally {
      setBusy(false);
    }
  }

  async function remove(uri: string) {
    try {
      await client.deleteRecord(def.nsid, rkeyFromUri(uri));
      await load();
    } catch (err: any) {
      setMsg({ kind: "err", text: `削除失敗: ${err?.message ?? err}` });
    }
  }

  function startEdit(record: { uri: string; value: any }) {
    const next: Record<string, string | boolean> = {};
    for (const field of def.fields) {
      if (field.type === "org") {
        for (const sub of ORG_SUBS) next[`${field.key}.${sub.suffix}`] = record.value[field.key]?.[sub.suffix] ?? "";
      } else if (field.type === "checkbox") {
        next[field.key] = !!record.value[field.key];
      } else {
        next[field.key] = record.value[field.key] ?? "";
      }
    }
    setValues(next);
    setEditing({ uri: record.uri, createdAt: record.value.createdAt });
    setMsg(null);
    document.getElementById(`section-${def.nsid}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
    <div className="panel" id={`section-${def.nsid}`}>
      <div className="section-title">
        <h2>
          {def.title} <span className="tag">{records.length}</span>
        </h2>
      </div>
      <p className="hint">{def.hint}</p>

      <form onSubmit={add}>
        <div className="grid">
          {def.fields.map((f) => {
            if (f.type === "org") {
              return ORG_SUBS.map((sub) => (
                <Field
                  key={`${f.key}.${sub.suffix}`}
                  label={`${f.label}: ${sub.label}`}
                  required={f.required && sub.required}
                  value={sv(`${f.key}.${sub.suffix}`)}
                  onChange={(v) => set(`${f.key}.${sub.suffix}`, v)}
                />
              ));
            }
            if (f.type === "select") {
              return (
                <SelectField
                  key={f.key}
                  label={f.label}
                  required={f.required}
                  value={sv(f.key)}
                  onChange={(v) => set(f.key, v)}
                  options={f.options ?? []}
                />
              );
            }
            if (f.type === "checkbox") {
              return (
                <Checkbox key={f.key} label={f.label} checked={bv(f.key)} onChange={(v) => set(f.key, v)} />
              );
            }
            return (
              <Field
                key={f.key}
                label={f.label}
                required={f.required}
                placeholder={f.placeholder}
                textarea={f.type === "textarea"}
                value={sv(f.key)}
                onChange={(v) => set(f.key, v)}
              />
            );
          })}
        </div>
        <div className="toolbar">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "保存中…" : editing ? `${def.title}を更新` : `${def.title}を追加`}
          </button>
          {editing && <button className="btn ghost" type="button" onClick={() => { setEditing(null); setValues({}); }}>編集をキャンセル</button>}
        </div>
        <Message msg={msg} />
      </form>

      <div className="list">
        {records.length === 0 && <div className="empty">まだ登録がありません。</div>}
        {records.map((r) => {
          const { title, meta } = def.render(r.value);
          return (
            <RecordCardShell
              key={r.uri}
              onOpen={() => setDetail({ title, uri: r.uri, cid: r.cid, value: r.value })}
            >
              <div>
                <div className="title">{title}</div>
                {meta && <div className="meta">{meta}</div>}
              </div>
              <button className="btn danger small" onClick={(event) => { event.stopPropagation(); remove(r.uri); }}>
                削除
              </button>
            </RecordCardShell>
          );
        })}
      </div>
    </div>
    <RecordDetailDialog
      detail={detail}
      onClose={() => setDetail(null)}
      onEdit={detail?.uri ? () => {
        const record = records.find((candidate) => candidate.uri === detail.uri);
        if (record) startEdit(record);
      } : undefined}
      onDelete={detail?.uri ? () => remove(detail.uri!) : undefined}
    />
    </>
  );
}
