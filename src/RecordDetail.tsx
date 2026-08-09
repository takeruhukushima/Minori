import { useEffect, useState } from "react";

const LABELS: Record<string, string> = {
  "$type": "レコード種別",
  createdAt: "作成日時",
  updatedAt: "更新日時",
  addedAt: "追加日時",
  title: "タイトル",
  name: "名称",
  description: "説明",
  institution: "機関",
  organization: "組織",
  company: "組織名",
  contributors: "著者・貢献者",
  reference: "文献参照",
  collection: "プロジェクト参照",
  uri: "AT URI",
  cid: "CID",
};

export interface RecordDetailData {
  title: string;
  uri?: string;
  cid?: string;
  value: unknown;
  editableValue?: Record<string, unknown>;
}

export function RecordDetailDialog({
  detail,
  onClose,
  onSave,
  onDelete,
}: {
  detail: RecordDetailData | null;
  onClose: () => void;
  onSave?: (value: Record<string, unknown>) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setEditing(false);
    setError("");
    const editableValue = detail?.editableValue ?? detail?.value;
    setDraft(isObject(editableValue) ? JSON.stringify(editableValue, null, 2) : "");
  }, [detail]);
  useEffect(() => {
    if (!detail) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [detail, onClose]);

  if (!detail) return null;
  const completeValue = {
    ...(detail.uri ? { uri: detail.uri } : {}),
    ...(detail.cid ? { cid: detail.cid } : {}),
    ...(isObject(detail.value) ? detail.value : { value: detail.value }),
  };

  async function save() {
    if (!onSave) return;
    setError("");
    try {
      const value: unknown = JSON.parse(draft);
      if (!isObject(value)) throw new Error("レコードはJSONオブジェクトで入力してください。");
      setBusy(true);
      await onSave(value);
      onClose();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!onDelete || !detail || !confirm(`「${detail.title}」をPDSから削除しますか？`)) return;
    setError("");
    try {
      setBusy(true);
      await onDelete();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="detail-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="detail-header">
          <div>
            <div className="detail-eyebrow">公開レコードの詳細</div>
            <h2 id="record-detail-title">{detail.title}</h2>
          </div>
          <button className="btn ghost small" type="button" onClick={onClose} aria-label="詳細を閉じる">
            閉じる
          </button>
        </header>
        <div className="detail-content">
          {editing ? (
            <label className="detail-editor">
              <span>レコードJSON</span>
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} spellCheck={false} />
            </label>
          ) : <DetailObject value={completeValue} />}
          {error && <div className="msg err">{error}</div>}
          {(onSave || onDelete) && (
            <div className="toolbar detail-actions">
              {onSave && (editing ? (
                <>
                  <button className="btn" type="button" disabled={busy} onClick={save}>保存する</button>
                  <button className="btn ghost" type="button" disabled={busy} onClick={() => setEditing(false)}>キャンセル</button>
                </>
              ) : <button className="btn ghost" type="button" onClick={() => setEditing(true)}>編集</button>)}
              {onDelete && <button className="btn danger" type="button" disabled={busy} onClick={remove}>削除</button>}
            </div>
          )}
          <details className="raw-record">
            <summary>Raw JSON</summary>
            <pre>{JSON.stringify(completeValue, null, 2)}</pre>
          </details>
        </div>
      </section>
    </div>
  );
}

export function RecordCardShell({
  children,
  onOpen,
  className = "card",
}: {
  children: React.ReactNode;
  onOpen: () => void;
  className?: string;
}) {
  return (
    <div
      className={`${className} record-card`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      {children}
    </div>
  );
}

function DetailObject({ value }: { value: Record<string, unknown> }) {
  return (
    <dl className="detail-fields">
      {Object.entries(value).map(([key, item]) => (
        <div className="detail-field" key={key}>
          <dt>
            {LABELS[key] ?? humanize(key)} <code>{key}</code>
          </dt>
          <dd><DetailValue value={item} /></dd>
        </div>
      ))}
    </dl>
  );
}

function DetailValue({ value }: { value: unknown }) {
  if (value === null) return <span className="detail-null">null</span>;
  if (value === undefined) return <span className="detail-null">undefined</span>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="detail-null">[]</span>;
    return (
      <ol className="detail-array">
        {value.map((item, index) => <li key={index}><DetailValue value={item} /></li>)}
      </ol>
    );
  }
  if (isObject(value)) return <DetailObject value={value} />;
  if (typeof value === "boolean") return <span>{value ? "はい (true)" : "いいえ (false)"}</span>;
  const text = String(value);
  if (/^https?:\/\//.test(text)) return <a href={text} target="_blank" rel="noreferrer">{text}</a>;
  return <span className="detail-value">{text}</span>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function humanize(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (char) => char.toUpperCase());
}
