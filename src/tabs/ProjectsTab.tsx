import React, { useEffect, useState } from "react";
import { StrongRef, rkeyFromUri } from "../atproto";
import { useI18n } from "../i18n";
import { LanguageText, normalizeLanguageTexts, pickLanguageText } from "../languageText";
import { listAllRecords, Repo } from "../repo";
import { NSID } from "../lexicons";
import { Checkbox, Field, LanguageTextField, Message, Msg, SelectField, clean, now } from "../ui";
import { RecordCardShell, RecordDetailData, RecordDetailDialog } from "../RecordDetail";
import { repairCurrentStrongRefs } from "../migration";

interface Rec {
  uri: string;
  cid: string;
  value: any;
}

const CSL_TYPES = [
  "article-journal",
  "paper-conference",
  "preprint",
  "chapter",
  "book",
  "thesis",
  "report",
  "dataset",
  "software",
  "webpage",
  "manuscript",
].map((v) => ({ value: v, label: v }));

function normalizeDoi(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .toLowerCase();
}

function languageTexts(value: unknown): LanguageText[] {
  if (typeof value === "string") {
    const legacy = value.trim();
    return legacy ? [{ language: "und", value: legacy }] : [];
  }
  return normalizeLanguageTexts(value);
}

function contributorNames(contributors: any[]): LanguageText[] {
  const names = contributors.map((person) => languageTexts(person.literal ?? person.name));
  const languages = [...new Set(names.flatMap((variants) => variants.map((variant) => variant.language)))];
  return languages.map((language) => ({
    language,
    value: names
      .map((variants) => variants.find((variant) => variant.language === language)?.value ?? "")
      .join("\n")
      .trim(),
  })).filter((variant) => variant.value);
}

export function ProjectsTab({ client }: { client: Repo }) {
  const { locale, text } = useI18n();
  const [projects, setProjects] = useState<Rec[]>([]);
  const [selected, setSelected] = useState<Rec | null>(null);
  const [detail, setDetail] = useState<RecordDetailData | null>(null);
  const [editingProject, setEditingProject] = useState<Rec | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  // new project form
  const [pName, setPName] = useState<LanguageText[]>([]);
  const [pDesc, setPDesc] = useState<LanguageText[]>([]);
  const [pPurpose, setPPurpose] = useState("writing");
  const [pVenue, setPVenue] = useState<LanguageText[]>([]);
  const [creatingP, setCreatingP] = useState(false);
  const purposes = [
    { value: "", label: text("（未選択）", "(Not selected)") },
    { value: "writing", label: text("執筆中 (writing)", "Writing (writing)") },
    { value: "reading", label: text("積読・購読 (reading)", "Reading list (reading)") },
    { value: "teaching", label: text("講義 (teaching)", "Teaching (teaching)") },
    { value: "topic", label: text("トピック (topic)", "Topic (topic)") },
    { value: "systematicReview", label: "SR (systematicReview)" },
    { value: "grantApplication", label: text("申請 (grantApplication)", "Application (grantApplication)") },
    { value: "thesis", label: text("学位論文 (thesis)", "Thesis (thesis)") },
  ];

  async function loadProjects() {
    try {
      const records = await listAllRecords(client, NSID.collection);
      const recs = records.map((r) => ({ uri: r.uri, cid: r.cid, value: r.value }));
      setProjects(recs);
      // keep selection consistent
      setSelected((cur) => (cur ? recs.find((r) => r.uri === cur.uri) ?? null : null));
    } catch {
      setProjects([]);
    }
  }

  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.did]);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    const names = normalizeLanguageTexts(pName);
    if (!names.length) {
      setMsg({ kind: "err", text: text("プロジェクト名は必須です", "Project name is required") });
      return;
    }
    setCreatingP(true);
    setMsg(null);
    try {
      const base = structuredClone(editingProject?.value ?? {});
      for (const key of ["name", "description", "purpose", "targetVenue", "updatedAt"]) delete base[key];
      const rec: any = {
        ...base,
        $type: NSID.collection,
        name: names,
        ...clean({ description: normalizeLanguageTexts(pDesc), purpose: pPurpose, targetVenue: normalizeLanguageTexts(pVenue) }),
        createdAt: editingProject?.value.createdAt ?? now(),
      };
      const ref = editingProject
        ? await client.putRecord(NSID.collection, rkeyFromUri(editingProject.uri), rec)
        : await client.createRecord(NSID.collection, rec);
      const verified = await client.getRecord(NSID.collection, rkeyFromUri(ref.uri));
      if (verified.uri !== ref.uri || (verified.cid && verified.cid !== ref.cid)) {
        throw new Error("PDS read-after-write verification failed");
      }
      if (editingProject) await repairCurrentStrongRefs(client);
      setPName([]);
      setPDesc([]);
      setPVenue([]);
      const wasEditing = !!editingProject;
      setEditingProject(null);
      await loadProjects();
      const created = { uri: ref.uri, cid: ref.cid, value: rec };
      setSelected(created);
      setMsg({
        kind: "ok",
        text: text(
          `プロジェクト「${pickLanguageText(rec.name, locale)}」を${wasEditing ? "更新" : "作成"}し、PDSからの読み戻しを確認しました。`,
          `Project “${pickLanguageText(rec.name, locale)}” was ${wasEditing ? "updated" : "created"} and read back from the PDS.`,
        ),
      });
    } catch (err: any) {
      setMsg({ kind: "err", text: `${text("作成失敗", "Creation failed")}: ${err?.message ?? err}` });
    } finally {
      setCreatingP(false);
    }
  }

  function startProjectEdit(project: Rec) {
    setPName(languageTexts(project.value.name));
    setPDesc(languageTexts(project.value.description));
    setPPurpose(project.value.purpose ?? "");
    setPVenue(languageTexts(project.value.targetVenue));
    setEditingProject(project);
    setMsg(null);
    document.getElementById("project-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function deleteProject(p: Rec) {
    try {
      const allItems = await listAllRecords(client, NSID.collectionItem);
      const memberships = allItems.filter((item) => item.value.collection?.uri === p.uri);
      await client.deleteRecord(NSID.collection, rkeyFromUri(p.uri));
      const cleanup = await Promise.allSettled(
        memberships.map((item) => client.deleteRecord(NSID.collectionItem, rkeyFromUri(item.uri))),
      );
      if (selected?.uri === p.uri) setSelected(null);
      await loadProjects();
      if (cleanup.some((result) => result.status === "rejected")) {
        setMsg({ kind: "err", text: text("プロジェクトは削除しましたが、一部の所属レコードを削除できませんでした。", "The project was deleted, but some membership records could not be deleted.") });
      } else {
        setMsg({ kind: "ok", text: text("プロジェクトと所属レコードを削除しました。論文レコードは保持されています。", "The project and membership records were deleted. Paper records were retained.") });
      }
    } catch (err: any) {
      setMsg({ kind: "err", text: `${text("削除失敗", "Deletion failed")}: ${err?.message ?? err}` });
    }
  }

  return (
    <>
      <div className="panel" id="project-form">
        <h2>{text("新しいプロジェクト", "New project")}</h2>
        <p className="hint">
          {text("プロジェクト = ", "Project = ")}<code>pub.paper.collection</code>{text("。執筆中の論文・講義・SRなどの名前付き集合です。論文の所属は別レコード（collectionItem）で管理します。", ". It is a named collection for a paper in progress, course, SR, and similar work. Paper membership is managed in separate collectionItem records.")}
        </p>
        <form onSubmit={createProject}>
          <div className="grid">
            <LanguageTextField label={text("プロジェクト名", "Project name")} required value={pName} onChange={setPName} placeholder={text("ATProto学術基盤 論文", "ATProto scholarly infrastructure paper")} />
            <SelectField label={text("目的", "Purpose")} value={pPurpose} onChange={setPPurpose} options={purposes} />
            <LanguageTextField label={text("投稿先（任意）", "Target venue (optional)")} value={pVenue} onChange={setPVenue} placeholder="Nature / NeurIPS" />
          </div>
          <div style={{ marginTop: 12 }}>
            <LanguageTextField label={text("説明", "Description")} value={pDesc} onChange={setPDesc} textarea />
          </div>
          <div className="toolbar">
            <button className="btn" type="submit" disabled={creatingP}>
              {creatingP ? text("保存中…", "Saving...") : editingProject ? text("プロジェクトを更新", "Update project") : text("プロジェクトを作成", "Create project")}
            </button>
            {editingProject && <button className="btn ghost" type="button" onClick={() => { setEditingProject(null); setPName([]); setPDesc([]); setPPurpose("writing"); setPVenue([]); }}>{text("編集をキャンセル", "Cancel editing")}</button>}
          </div>
        </form>
        <Message msg={msg} />
      </div>

      <div className="panel">
        <h2>
          {text("プロジェクト一覧", "Projects")} <span className="tag">{projects.length}</span>
        </h2>
        <div className="list">
          {projects.length === 0 && <div className="empty">{text("まだプロジェクトがありません。", "No projects yet.")}</div>}
          {projects.map((p) => (
            <RecordCardShell
              key={p.uri}
              onOpen={() => setDetail({ title: pickLanguageText(p.value.name, locale) || text("プロジェクト", "Project"), uri: p.uri, cid: p.cid, value: p.value })}
            >
              <div>
                <div className="title">{pickLanguageText(p.value.name, locale)}</div>
                <div className="meta">
                  {p.value.purpose && <span className="tag">{p.value.purpose}</span>}
                  {pickLanguageText(p.value.targetVenue, locale)}
                </div>
              </div>
              <div className="row">
                <button
                  className="btn small ghost"
                  onClick={(event) => { event.stopPropagation(); setSelected(selected?.uri === p.uri ? null : p); }}
                >
                  {selected?.uri === p.uri ? text("閉じる", "Close") : text("論文を管理", "Manage papers")}
                </button>
                <button className="btn danger small" onClick={(event) => { event.stopPropagation(); if (confirm(text(`プロジェクト「${pickLanguageText(p.value.name, locale)}」を削除しますか？（論文レコード自体は残ります）`, `Delete project “${pickLanguageText(p.value.name, locale)}”? (Paper records will remain.)`))) deleteProject(p); }}>
                  {text("削除", "Delete")}
                </button>
              </div>
            </RecordCardShell>
          ))}
        </div>
      </div>

      {selected && <ProjectPapers client={client} project={selected} />}
      <RecordDetailDialog
        detail={detail}
        onClose={() => setDetail(null)}
        onEdit={detail?.uri ? () => {
          const project = projects.find((candidate) => candidate.uri === detail.uri);
          if (project) startProjectEdit(project);
        } : undefined}
        onDelete={detail?.uri ? () => {
          const project = projects.find((candidate) => candidate.uri === detail.uri);
          if (!project) throw new Error(text("プロジェクトが見つかりません。", "Project not found."));
          return deleteProject(project);
        } : undefined}
      />
    </>
  );
}

// ---- papers within a project ----

function ProjectPapers({ client, project }: { client: Repo; project: Rec }) {
  const { locale, text } = useI18n();
  const [items, setItems] = useState<{ item: Rec; ref: Rec | null; authorship: Rec | null }[]>([]);
  const [editingPaper, setEditingPaper] = useState<{ item: Rec; ref: Rec; authorship: Rec | null } | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<RecordDetailData | null>(null);

  // paper form
  const [type, setType] = useState("article-journal");
  const [title, setTitle] = useState<LanguageText[]>([]);
  const [authors, setAuthors] = useState<LanguageText[]>([]);
  const [authorsDirty, setAuthorsDirty] = useState(false);
  const [container, setContainer] = useState<LanguageText[]>([]);
  const [year, setYear] = useState("");
  const [doi, setDoi] = useState("");
  const [arxivId, setArxivId] = useState("");
  const [url, setUrl] = useState("");
  // authorship
  const [claim, setClaim] = useState(false);
  const [outputCategory, setOutputCategory] = useState("article");
  const [isFeatured, setIsFeatured] = useState(false);
  const outputCategories = [
    { value: "article", label: text("論文 (article)", "Article (article)") },
    { value: "misc", label: "MISC" },
    { value: "book", label: text("書籍 (book)", "Book (book)") },
    { value: "other", label: text("その他 (other)", "Other (other)") },
  ];

  async function load() {
    try {
      const records = await listAllRecords(client, NSID.collectionItem);
      const authorships = await listAllRecords(client, NSID.authorship).catch(() => []);
      const mine = records
        .map((r) => ({ uri: r.uri, cid: r.cid, value: r.value }))
        .filter((r) => r.value.collection?.uri === project.uri);
      // resolve references
      const resolved = await Promise.all(
        mine.map(async (it) => {
          let ref: Rec | null = null;
          const refUri: string | undefined = it.value.reference?.uri;
          if (refUri) {
            try {
              const got = await client.getRecord(NSID.reference, rkeyFromUri(refUri));
              ref = { uri: got.uri, cid: got.cid, value: got.value };
            } catch {
              ref = null;
            }
          }
          const authorship = refUri
            ? (authorships.find((claim) => claim.value.reference?.uri === refUri) ?? null)
            : null;
          return { item: it, ref, authorship };
        }),
      );
      setItems(resolved);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.uri]);

  function buildContributors() {
    const byLanguage = normalizeLanguageTexts(authors).map((variant) => ({
      language: variant.language,
      names: variant.value.split(/[;,\n]/).map((name) => name.trim()).filter(Boolean),
    }));
    const count = Math.max(0, ...byLanguage.map((variant) => variant.names.length));
    return Array.from({ length: count }, (_, i) => ({
      role: "author",
      literal: byLanguage
        .map((variant) => ({ language: variant.language, value: variant.names[i] ?? "" }))
        .filter((variant) => variant.value),
      sequence: i + 1,
    })).filter((person) => person.literal.length);
  }

  function resetPaperForm() {
    setType("article-journal");
    setTitle([]);
    setAuthors([]);
    setAuthorsDirty(false);
    setContainer([]);
    setYear("");
    setDoi("");
    setArxivId("");
    setUrl("");
    setClaim(false);
    setOutputCategory("article");
    setIsFeatured(false);
    setEditingPaper(null);
  }

  function startPaperEdit(entry: { item: Rec; ref: Rec | null; authorship: Rec | null }) {
    if (!entry.ref) {
      setMsg({ kind: "err", text: text("参照レコードを取得できないため編集できません。", "This paper cannot be edited because its reference record could not be loaded.") });
      return;
    }
    const value = entry.ref.value;
    setType(value.type ?? "article-journal");
    setTitle(languageTexts(value.title));
    setAuthors(contributorNames(value.contributors ?? []));
    setAuthorsDirty(false);
    setContainer(languageTexts(value.containerTitle));
    setYear(value.issued?.year ? String(value.issued.year) : "");
    setDoi(value.doi ?? "");
    setArxivId(value.arxivId ?? "");
    setUrl(value.url ?? "");
    setClaim(!!entry.authorship);
    setOutputCategory(entry.authorship?.value.outputCategory ?? "article");
    setIsFeatured(!!entry.authorship?.value.isFeatured);
    setEditingPaper({ item: entry.item, ref: entry.ref, authorship: entry.authorship });
    setMsg(null);
    document.getElementById(`paper-form-${rkeyFromUri(project.uri)}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function addPaper(e: React.FormEvent) {
    e.preventDefault();
    const titles = normalizeLanguageTexts(title);
    if (!titles.length) {
      setMsg({ kind: "err", text: text("タイトルは必須です", "Title is required") });
      return;
    }
    setBusy(true);
    setMsg(null);
    const created: { collection: string; uri: string }[] = [];
    try {
      // 1) reference
      const reference: any = structuredClone(editingPaper?.ref.value ?? {});
      for (const key of ["type", "title", "containerTitle", "doi", "arxivId", "url", "issued"]) delete reference[key];
      reference.$type = NSID.reference;
      reference.type = type;
      reference.title = titles;
      reference.createdAt = editingPaper?.ref.value.createdAt ?? now();
      Object.assign(reference, clean({ containerTitle: normalizeLanguageTexts(container), doi: normalizeDoi(doi), arxivId, url }));
      const contribs = buildContributors();
      if (!editingPaper || authorsDirty) {
        delete reference.contributors;
        if (contribs.length) reference.contributors = contribs;
      }
      const y = parseInt(year, 10);
      if (!Number.isNaN(y)) reference.issued = { year: y };

      if (editingPaper) {
        reference.createdAt = editingPaper.ref.value.createdAt ?? reference.createdAt;
        const refRef = await client.putRecord(NSID.reference, rkeyFromUri(editingPaper.ref.uri), reference);
        const linkedItems = (await listAllRecords(client, NSID.collectionItem))
          .filter((record) => record.value.reference?.uri === editingPaper.ref.uri);
        await Promise.all(linkedItems.map((record) => client.putRecord(
          NSID.collectionItem,
          rkeyFromUri(record.uri),
          { ...record.value, reference: { uri: refRef.uri, cid: refRef.cid } },
        )));
        if (claim) {
          const authorshipRecord = {
            ...(editingPaper.authorship?.value ?? {}),
            $type: NSID.authorship,
            reference: { uri: refRef.uri, cid: refRef.cid },
            role: "author",
            ...clean({ outputCategory }),
            ...(isFeatured ? { isFeatured: true } : {}),
            createdAt: editingPaper.authorship?.value.createdAt ?? now(),
          };
          if (editingPaper.authorship) {
            await client.putRecord(NSID.authorship, rkeyFromUri(editingPaper.authorship.uri), authorshipRecord);
          } else {
            await client.createRecord(NSID.authorship, authorshipRecord);
          }
        } else if (editingPaper.authorship) {
          await client.deleteRecord(NSID.authorship, rkeyFromUri(editingPaper.authorship.uri));
        }
        const verified = await client.getRecord(NSID.reference, rkeyFromUri(editingPaper.ref.uri));
        if (verified.uri !== refRef.uri || (verified.cid && verified.cid !== refRef.cid)) {
          throw new Error("Reference read-after-write verification failed");
        }
        await repairCurrentStrongRefs(client);
        resetPaperForm();
        await load();
        setMsg({ kind: "ok", text: text("論文情報をフォームから更新しました。", "Paper information was updated from the form.") });
        return;
      }

      const refRef: StrongRef = await client.createRecord(NSID.reference, reference);
      created.push({ collection: NSID.reference, uri: refRef.uri });
      const verifiedReference = await client.getRecord(NSID.reference, rkeyFromUri(refRef.uri));
      if (verifiedReference.uri !== refRef.uri || (verifiedReference.cid && verifiedReference.cid !== refRef.cid)) {
        throw new Error("Reference read-after-write verification failed");
      }

      // 2) collectionItem (membership)
      const itemRef = await client.createRecord(NSID.collectionItem, {
        $type: NSID.collectionItem,
        collection: { uri: project.uri, cid: project.cid },
        reference: { uri: refRef.uri, cid: refRef.cid },
        addedAt: now(),
      });
      created.push({ collection: NSID.collectionItem, uri: itemRef.uri });

      // 3) optional authorship claim
      if (claim) {
        const authorshipRef = await client.createRecord(NSID.authorship, {
          $type: NSID.authorship,
          reference: { uri: refRef.uri, cid: refRef.cid },
          role: "author",
          ...clean({ outputCategory }),
          ...(isFeatured ? { isFeatured: true } : {}),
          createdAt: now(),
        });
        created.push({ collection: NSID.authorship, uri: authorshipRef.uri });
      }

      // reset
      resetPaperForm();
      await load();
      setMsg({
        kind: "ok",
        text: text(
          `論文を追加しました${claim ? "（業績として authorship も登録）" : ""}。`,
          `Paper added${claim ? " (authorship also registered as an achievement)" : ""}.`,
        ),
      });
    } catch (err: any) {
      const rollback = await Promise.allSettled(
        created.reverse().map((record) =>
          client.deleteRecord(record.collection, rkeyFromUri(record.uri)),
        ),
      );
      const rollbackFailed = rollback.some((result) => result.status === "rejected");
      setMsg({
        kind: "err",
        text: text(
          `追加失敗: ${err?.message ?? err}${rollbackFailed ? "（途中レコードの自動削除にも失敗しました）" : created.length ? "（途中レコードは取り消しました）" : ""}`,
          `Addition failed: ${err?.message ?? err}${rollbackFailed ? " (automatic cleanup of partial records also failed)" : created.length ? " (partial records were rolled back)" : ""}`,
        ),
      });
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(itemUri: string) {
    try {
      await client.deleteRecord(NSID.collectionItem, rkeyFromUri(itemUri));
      await load();
    } catch (err: any) {
      setMsg({ kind: "err", text: `${text("削除失敗", "Removal failed")}: ${err?.message ?? err}` });
    }
  }

  async function deletePaper(item: Rec, reference: Rec | null, authorship: Rec | null) {
    const referenceUri = reference?.uri ?? item.value.reference?.uri;
    const [allItems, allAuthorships] = referenceUri
      ? await Promise.all([
        listAllRecords(client, NSID.collectionItem),
        listAllRecords(client, NSID.authorship).catch(() => []),
      ])
      : [[], []];
    const targets = referenceUri ? [
      ...allAuthorships.filter((record) => record.value.reference?.uri === referenceUri).map((record) => ({ collection: NSID.authorship, uri: record.uri })),
      ...allItems.filter((record) => record.value.reference?.uri === referenceUri).map((record) => ({ collection: NSID.collectionItem, uri: record.uri })),
      ...(reference ? [{ collection: NSID.reference, uri: reference.uri }] : []),
    ] : [
      ...(authorship ? [{ collection: NSID.authorship, uri: authorship.uri }] : []),
      { collection: NSID.collectionItem, uri: item.uri },
    ];
    const results = await Promise.allSettled(targets.map((target) => client.deleteRecord(target.collection, rkeyFromUri(target.uri))));
    if (results.some((result) => result.status === "rejected")) throw new Error(text("関連レコードの一部を削除できませんでした。", "Some related records could not be deleted."));
    await load();
    setMsg({ kind: "ok", text: text("論文と関連する所属・著者レコードを削除しました。", "The paper and its related membership and authorship records were deleted.") });
  }

  return (
    <>
    <div className="panel" id={`paper-form-${rkeyFromUri(project.uri)}`} style={{ borderColor: "var(--accent)" }}>
      <h2>{text(`「${pickLanguageText(project.value.name, locale)}」の論文`, `Papers in “${pickLanguageText(project.value.name, locale)}”`)}</h2>
      <p className="hint">
        {text("論文（pub.paper.reference）を作り、このプロジェクトに所属させます（collectionItem）。「自分の業績として登録」で id.career.authorship も同時に作成します。", "Create a paper (pub.paper.reference) and add it to this project (collectionItem). Selecting “Register as my work” also creates id.career.authorship.")}
      </p>

      <form onSubmit={addPaper}>
        <div className="grid">
          <SelectField label={text("種別 (CSL)", "Type (CSL)")} value={type} onChange={setType} options={CSL_TYPES} />
          <LanguageTextField label={text("タイトル", "Title")} required value={title} onChange={setTitle} />
          <LanguageTextField label={text("掲載誌・会議名", "Journal or conference")} value={container} onChange={setContainer} placeholder="Journal of ..." />
          <Field label={text("発行年", "Publication year")} value={year} onChange={setYear} placeholder="2025" />
          <Field label="DOI" value={doi} onChange={setDoi} placeholder="10.1145/xxxxxxx" />
          <Field label="arXiv ID" value={arxivId} onChange={setArxivId} placeholder="2402.03239" />
          <Field label="URL" value={url} onChange={setUrl} />
        </div>
        <div style={{ marginTop: 12 }}>
          <LanguageTextField
            label={text("著者（カンマ、;、改行区切り）", "Authors (separated by comma, semicolon, or newline)")}
            value={authors}
            onChange={(value) => { setAuthors(value); setAuthorsDirty(true); }}
            textarea
            placeholder={text("福島 岳\n山田 太郎", "Takeru Fukushima\nTaro Yamada")}
          />
        </div>

        <hr className="sep" />
        <div className="subhead">{text("業績登録（authorship）", "Achievement registration (authorship)")}</div>
        <div className="row">
          <Checkbox label={text("自分の業績として登録", "Register as my work")} checked={claim} onChange={setClaim} />
          {claim && (
            <>
              <SelectField label={text("CV区分", "CV category")} value={outputCategory} onChange={setOutputCategory} options={outputCategories} />
              <Checkbox label={text("主要業績", "Featured work")} checked={isFeatured} onChange={setIsFeatured} />
            </>
          )}
        </div>

        <div className="toolbar">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? text("保存中…", "Saving...") : editingPaper ? text("論文情報を更新", "Update paper") : text("論文を追加", "Add paper")}
          </button>
          {editingPaper && <button className="btn ghost" type="button" onClick={resetPaperForm}>{text("編集をキャンセル", "Cancel editing")}</button>}
        </div>
        <Message msg={msg} />
      </form>

      <div className="list">
        {items.length === 0 && <div className="empty">{text("まだ論文がありません。", "No papers yet.")}</div>}
        {items.map(({ item, ref, authorship }) => (
          <RecordCardShell
            key={item.uri}
            onOpen={() => setDetail({
              title: pickLanguageText(ref?.value.title, locale) || text("文献レコード", "Reference record"),
              uri: item.uri,
              cid: item.cid,
              value: {
                collectionItemRecord: item.value,
                referenceRecord: ref?.value ?? null,
                referenceUri: ref?.uri ?? null,
                referenceCid: ref?.cid ?? null,
                authorshipRecord: authorship?.value ?? null,
                authorshipUri: authorship?.uri ?? null,
                authorshipCid: authorship?.cid ?? null,
              },
            })}
          >
            <div>
              <div className="title">{pickLanguageText(ref?.value.title, locale) || text("（参照解決できず）", "(Reference unavailable)")}</div>
              <div className="meta">
                {ref?.value.type && <span className="tag">{ref.value.type}</span>}
                {[pickLanguageText(ref?.value.containerTitle, locale), ref?.value.issued?.year].filter(Boolean).join(" · ")}
              </div>
            </div>
            <button className="btn danger small" onClick={(event) => { event.stopPropagation(); removeItem(item.uri); }}>
              {text("外す", "Remove")}
            </button>
          </RecordCardShell>
        ))}
      </div>
    </div>
    <RecordDetailDialog
      detail={detail}
      onClose={() => setDetail(null)}
      onEdit={detail ? () => {
        const entry = items.find(({ item }) => item.uri === detail.uri);
        if (entry) startPaperEdit(entry);
      } : undefined}
      onDelete={detail ? async () => {
        const entry = items.find(({ item }) => item.uri === detail.uri);
        if (!entry) throw new Error(text("削除対象の論文レコードが見つかりません。", "The paper record to delete was not found."));
        await deletePaper(entry.item, entry.ref, entry.authorship);
      } : undefined}
    />
    </>
  );
}
