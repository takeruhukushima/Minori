import React, { useEffect, useState } from "react";
import { StrongRef, rkeyFromUri } from "../atproto";
import { listAllRecords, Repo } from "../repo";
import { NSID } from "../lexicons";
import { Checkbox, Field, Message, Msg, SelectField, clean, now } from "../ui";

interface Rec {
  uri: string;
  cid: string;
  value: any;
}

const PURPOSES = [
  { value: "", label: "（未選択）" },
  { value: "writing", label: "執筆中 (writing)" },
  { value: "reading", label: "積読・購読 (reading)" },
  { value: "teaching", label: "講義 (teaching)" },
  { value: "topic", label: "トピック (topic)" },
  { value: "systematicReview", label: "SR (systematicReview)" },
  { value: "grantApplication", label: "申請 (grantApplication)" },
  { value: "thesis", label: "学位論文 (thesis)" },
];

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

const OUTPUT_CATS = [
  { value: "article", label: "論文 (article)" },
  { value: "misc", label: "MISC" },
  { value: "book", label: "書籍 (book)" },
  { value: "other", label: "その他 (other)" },
];

function normalizeDoi(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .toLowerCase();
}

export function ProjectsTab({ client }: { client: Repo }) {
  const [projects, setProjects] = useState<Rec[]>([]);
  const [selected, setSelected] = useState<Rec | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  // new project form
  const [pName, setPName] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pPurpose, setPPurpose] = useState("writing");
  const [pVenue, setPVenue] = useState("");
  const [creatingP, setCreatingP] = useState(false);

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
    if (!pName.trim()) {
      setMsg({ kind: "err", text: "プロジェクト名は必須です" });
      return;
    }
    setCreatingP(true);
    setMsg(null);
    try {
      const rec: any = {
        $type: NSID.collection,
        name: pName.trim(),
        ...clean({ description: pDesc, purpose: pPurpose, targetVenue: pVenue }),
        createdAt: now(),
      };
      const ref = await client.createRecord(NSID.collection, rec);
      const verified = await client.getRecord(NSID.collection, rkeyFromUri(ref.uri));
      if (verified.uri !== ref.uri || (verified.cid && verified.cid !== ref.cid)) {
        throw new Error("PDS read-after-write verification failed");
      }
      setPName("");
      setPDesc("");
      setPVenue("");
      await loadProjects();
      const created = { uri: ref.uri, cid: ref.cid, value: rec };
      setSelected(created);
      setMsg({ kind: "ok", text: `プロジェクト「${rec.name}」を作成し、PDSからの読み戻しを確認しました。` });
    } catch (err: any) {
      setMsg({ kind: "err", text: `作成失敗: ${err?.message ?? err}` });
    } finally {
      setCreatingP(false);
    }
  }

  async function deleteProject(p: Rec) {
    if (!confirm(`プロジェクト「${p.value.name}」を削除しますか？（論文レコード自体は残ります）`)) return;
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
        setMsg({ kind: "err", text: "プロジェクトは削除しましたが、一部の所属レコードを削除できませんでした。" });
      } else {
        setMsg({ kind: "ok", text: "プロジェクトと所属レコードを削除しました。論文レコードは保持されています。" });
      }
    } catch (err: any) {
      setMsg({ kind: "err", text: `削除失敗: ${err?.message ?? err}` });
    }
  }

  return (
    <>
      <div className="panel">
        <h2>新しいプロジェクト</h2>
        <p className="hint">
          プロジェクト = <code>pub.paper.collection</code>。執筆中の論文・講義・SR
          などの名前付き集合です。論文の所属は別レコード（collectionItem）で管理します。
        </p>
        <form onSubmit={createProject}>
          <div className="grid">
            <Field label="プロジェクト名" required value={pName} onChange={setPName} placeholder="ATProto学術基盤 論文" />
            <SelectField label="目的" value={pPurpose} onChange={setPPurpose} options={PURPOSES} />
            <Field label="投稿先（任意）" value={pVenue} onChange={setPVenue} placeholder="Nature / NeurIPS" />
          </div>
          <div style={{ marginTop: 12 }}>
            <Field label="説明" value={pDesc} onChange={setPDesc} textarea />
          </div>
          <div className="toolbar">
            <button className="btn" type="submit" disabled={creatingP}>
              {creatingP ? "作成中…" : "プロジェクトを作成"}
            </button>
          </div>
        </form>
        <Message msg={msg} />
      </div>

      <div className="panel">
        <h2>
          プロジェクト一覧 <span className="tag">{projects.length}</span>
        </h2>
        <div className="list">
          {projects.length === 0 && <div className="empty">まだプロジェクトがありません。</div>}
          {projects.map((p) => (
            <div className="card" key={p.uri}>
              <div>
                <div className="title">{p.value.name}</div>
                <div className="meta">
                  {p.value.purpose && <span className="tag">{p.value.purpose}</span>}
                  {p.value.targetVenue ?? ""}
                </div>
              </div>
              <div className="row">
                <button
                  className="btn small ghost"
                  onClick={() => setSelected(selected?.uri === p.uri ? null : p)}
                >
                  {selected?.uri === p.uri ? "閉じる" : "論文を管理"}
                </button>
                <button className="btn danger small" onClick={() => deleteProject(p)}>
                  削除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && <ProjectPapers client={client} project={selected} />}
    </>
  );
}

// ---- papers within a project ----

function ProjectPapers({ client, project }: { client: Repo; project: Rec }) {
  const [items, setItems] = useState<{ item: Rec; ref: Rec | null }[]>([]);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  // paper form
  const [type, setType] = useState("article-journal");
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [container, setContainer] = useState("");
  const [year, setYear] = useState("");
  const [doi, setDoi] = useState("");
  const [arxivId, setArxivId] = useState("");
  const [url, setUrl] = useState("");
  // authorship
  const [claim, setClaim] = useState(true);
  const [outputCategory, setOutputCategory] = useState("article");
  const [isFeatured, setIsFeatured] = useState(false);

  async function load() {
    try {
      const records = await listAllRecords(client, NSID.collectionItem);
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
          return { item: it, ref };
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
    return authors
      .split(/[;\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name, i) => ({ role: "author", literal: name, sequence: i + 1 }));
  }

  async function addPaper(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setMsg({ kind: "err", text: "タイトルは必須です" });
      return;
    }
    setBusy(true);
    setMsg(null);
    const created: { collection: string; uri: string }[] = [];
    try {
      // 1) reference
      const reference: any = {
        $type: NSID.reference,
        type,
        title: title.trim(),
        ...clean({ containerTitle: container, doi: normalizeDoi(doi), arxivId, url }),
        createdAt: now(),
      };
      const contribs = buildContributors();
      if (contribs.length) reference.contributors = contribs;
      const y = parseInt(year, 10);
      if (!Number.isNaN(y)) reference.issued = { year: y };

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
      setTitle("");
      setAuthors("");
      setContainer("");
      setYear("");
      setDoi("");
      setArxivId("");
      setUrl("");
      setIsFeatured(false);
      await load();
      setMsg({
        kind: "ok",
        text: `論文を追加しました${claim ? "（業績として authorship も登録）" : ""}。`,
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
        text: `追加失敗: ${err?.message ?? err}${rollbackFailed ? "（途中レコードの自動削除にも失敗しました）" : created.length ? "（途中レコードは取り消しました）" : ""}`,
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
      setMsg({ kind: "err", text: `削除失敗: ${err?.message ?? err}` });
    }
  }

  return (
    <div className="panel" style={{ borderColor: "var(--accent)" }}>
      <h2>「{project.value.name}」の論文</h2>
      <p className="hint">
        論文（pub.paper.reference）を作り、このプロジェクトに所属させます（collectionItem）。
        「自分の業績として登録」で id.career.authorship も同時に作成します。
      </p>

      <form onSubmit={addPaper}>
        <div className="grid">
          <SelectField label="種別 (CSL)" value={type} onChange={setType} options={CSL_TYPES} />
          <Field label="タイトル" required value={title} onChange={setTitle} />
          <Field label="掲載誌・会議名" value={container} onChange={setContainer} placeholder="Journal of ..." />
          <Field label="発行年" value={year} onChange={setYear} placeholder="2025" />
          <Field label="DOI" value={doi} onChange={setDoi} placeholder="10.1145/xxxxxxx" />
          <Field label="arXiv ID" value={arxivId} onChange={setArxivId} placeholder="2402.03239" />
          <Field label="URL" value={url} onChange={setUrl} />
        </div>
        <div style={{ marginTop: 12 }}>
          <Field
            label="著者（; または改行区切り）"
            value={authors}
            onChange={setAuthors}
            textarea
            placeholder={"福島 岳\nYamada Taro"}
          />
        </div>

        <hr className="sep" />
        <div className="subhead">業績登録（authorship）</div>
        <div className="row">
          <Checkbox label="自分の業績として登録" checked={claim} onChange={setClaim} />
          {claim && (
            <>
              <SelectField label="CV区分" value={outputCategory} onChange={setOutputCategory} options={OUTPUT_CATS} />
              <Checkbox label="主要業績" checked={isFeatured} onChange={setIsFeatured} />
            </>
          )}
        </div>

        <div className="toolbar">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "追加中…" : "論文を追加"}
          </button>
        </div>
        <Message msg={msg} />
      </form>

      <div className="list">
        {items.length === 0 && <div className="empty">まだ論文がありません。</div>}
        {items.map(({ item, ref }) => (
          <div className="card" key={item.uri}>
            <div>
              <div className="title">{ref?.value.title ?? "（参照解決できず）"}</div>
              <div className="meta">
                {ref?.value.type && <span className="tag">{ref.value.type}</span>}
                {[ref?.value.containerTitle, ref?.value.issued?.year].filter(Boolean).join(" · ")}
              </div>
            </div>
            <button className="btn danger small" onClick={() => removeItem(item.uri)}>
              外す
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
