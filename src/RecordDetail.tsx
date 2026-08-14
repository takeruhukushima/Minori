import { useEffect, useState } from "react";
import { useI18n } from "./i18n";

const LABELS: Record<string, [string, string]> = {
  "$type": ["レコード種別", "Record type"],
  createdAt: ["作成日時", "Created at"],
  updatedAt: ["更新日時", "Updated at"],
  addedAt: ["追加日時", "Added at"],
  title: ["タイトル", "Title"],
  name: ["名称", "Name"],
  description: ["説明", "Description"],
  institution: ["機関", "Institution"],
  organization: ["組織", "Organization"],
  company: ["組織名", "Organization name"],
  contributors: ["著者・貢献者", "Authors and contributors"],
  reference: ["文献参照", "Publication reference"],
  collection: ["プロジェクト参照", "Project reference"],
  uri: ["AT URI", "AT URI"],
  cid: ["CID", "CID"],
};

export interface RecordDetailData {
  title: string;
  uri?: string;
  cid?: string;
  value: unknown;
}

export function RecordDetailDialog({
  detail,
  onClose,
  onEdit,
  onDelete,
}: {
  detail: RecordDetailData | null;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => Promise<void>;
}) {
  const { text } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
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

  async function remove() {
    if (!onDelete || !detail || !confirm(text(`「${detail.title}」をPDSから削除しますか？`, `Delete "${detail.title}" from the PDS?`))) return;
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
            <div className="detail-eyebrow">{text("公開レコードの詳細", "Public record details")}</div>
            <h2 id="record-detail-title">{detail.title}</h2>
          </div>
          <button className="btn ghost small" type="button" onClick={onClose} aria-label={text("詳細を閉じる", "Close details")}>
            {text("閉じる", "Close")}
          </button>
        </header>
        <div className="detail-content">
          <DetailObject value={completeValue} />
          {error && <div className="msg err">{error}</div>}
          {(onEdit || onDelete) && (
            <div className="toolbar detail-actions">
              {onEdit && <button className="btn ghost" type="button" onClick={() => { onEdit(); onClose(); }}>{text("フォームで編集", "Edit in form")}</button>}
              {onDelete && <button className="btn danger" type="button" disabled={busy} onClick={remove}>{text("削除", "Delete")}</button>}
            </div>
          )}
          <details className="raw-record">
            <summary>{text("JSON（未加工）", "Raw JSON")}</summary>
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
  const { text } = useI18n();
  return (
    <dl className="detail-fields">
      {Object.entries(value).map(([key, item]) => (
        <div className="detail-field" key={key}>
          <dt>
            {LABELS[key] ? text(...LABELS[key]) : humanize(key)} <code>{key}</code>
          </dt>
          <dd><DetailValue value={item} /></dd>
        </div>
      ))}
    </dl>
  );
}

function DetailValue({ value }: { value: unknown }) {
  const { text } = useI18n();
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
  if (typeof value === "boolean") return <span>{value ? text("はい (true)", "Yes (true)") : text("いいえ (false)", "No (false)")}</span>;
  const displayValue = String(value);
  if (/^https?:\/\//.test(displayValue)) return <a href={displayValue} target="_blank" rel="noreferrer">{displayValue}</a>;
  return <span className="detail-value">{displayValue}</span>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function humanize(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (char) => char.toUpperCase());
}
