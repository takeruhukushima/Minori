import { useState } from "react";
import { useI18n } from "../i18n";
import { applyMigration, MigrationResult, MigrationScan, scanLegacyRecords } from "../migration";
import { Repo } from "../repo";
import { Message, Msg } from "../ui";

export function MigrationTab({ client }: { client: Repo }) {
  const { text } = useI18n();
  const [scan, setScan] = useState<MigrationScan | null>(null);
  const [languages, setLanguages] = useState<Record<string, string>>({});
  const [bulkLanguage, setBulkLanguage] = useState("");
  const [busy, setBusy] = useState(false);
  const [backedUp, setBackedUp] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  async function runScan() {
    setBusy(true);
    setMsg(null);
    setResult(null);
    try {
      const next = await scanLegacyRecords(client);
      setScan(next);
      setLanguages({});
      setBackedUp(false);
      setMsg({
        kind: "ok",
        text: next.candidates.length || next.staleReferences
          ? text(`${next.candidates.length}件の旧形式フィールドと${next.staleReferences}件の古いStrongRefを検出しました。`, `Found ${next.candidates.length} legacy fields and ${next.staleReferences} stale StrongRefs.`)
          : text("旧形式フィールドはありません。migrationは完了しています。", "No legacy fields remain. Migration is complete."),
      });
    } catch (error: any) {
      setMsg({ kind: "err", text: `${text("スキャン失敗", "Scan failed")}: ${error?.message ?? error}` });
    } finally {
      setBusy(false);
    }
  }

  function applyBulkLanguage() {
    const language = bulkLanguage.trim();
    if (!scan || !language) return;
    setLanguages(Object.fromEntries(scan.candidates.map((candidate) => [candidate.id, language])));
  }

  function downloadBackup() {
    if (!scan) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      did: client.did,
      records: scan.records,
      candidates: scan.candidates,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `minori-language-migration-${client.did.replace(/:/g, "-")}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setBackedUp(true);
  }

  async function migrate() {
    if (!scan) return;
    const missing = scan.candidates.filter((candidate) => !languages[candidate.id]?.trim());
    if (missing.length) {
      setMsg({ kind: "err", text: text("すべてのフィールドに言語タグを指定してください。", "Assign a language tag to every field.") });
      return;
    }
    if (!backedUp) {
      setMsg({ kind: "err", text: text("実行前にバックアップをダウンロードしてください。", "Download a backup before applying the migration.") });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const migrationResult = await applyMigration(client, scan, languages);
      setResult(migrationResult);
      const verified = await scanLegacyRecords(client);
      setScan(verified);
      setLanguages({});
      setMsg({
        kind: migrationResult.unresolvedReferences ? "err" : "ok",
        text: migrationResult.unresolvedReferences
          ? text(`migrationは完了しましたが、${migrationResult.unresolvedReferences}件のStrongRefが未解決です。`, `Migration completed, but ${migrationResult.unresolvedReferences} StrongRefs remain unresolved.`)
          : text("migrationと読み戻し検証が完了しました。", "Migration and read-back verification completed."),
      });
    } catch (error: any) {
      setMsg({ kind: "err", text: `${text("migration失敗。再スキャンして再開できます", "Migration failed. Rescan to resume")}: ${error?.message ?? error}` });
    } finally {
      setBusy(false);
    }
  }

  const allAssigned = !!scan && scan.candidates.every((candidate) => languages[candidate.id]?.trim());

  return (
    <section className="panel migration-panel">
      <h2>{text("言語variant migration", "Language Variant Migration")}</h2>
      <p className="hint">
        {text(
          "旧stringフィールドを対等なBCP-47言語variantへ一度だけ変換します。値の言語は自動判定しません。id.sifaの職歴は外部Lexiconのため対象外です。",
          "This one-time operation converts legacy string fields into equal BCP-47 language variants. Languages are never inferred. External id.sifa employment records are excluded.",
        )}
      </p>
      <p className="hint">
        {text(
          "CIDが変わるため同じPDS内のStrongRefを修復します。attestationのtarget CIDは意図的に書き換えず、対象レコードには再証明が必要です。",
          "Because CIDs change, StrongRefs in this PDS are repaired. Attestation target CIDs are intentionally left pinned, so migrated targets must be re-attested.",
        )}
      </p>
      <div className="toolbar">
        <button className="btn" type="button" disabled={busy} onClick={runScan}>
          {busy ? text("処理中…", "Working...") : text("PDSをスキャン", "Scan PDS")}
        </button>
        {scan && <button className="btn ghost" type="button" onClick={downloadBackup}>{text("JSONバックアップ", "Download JSON backup")}</button>}
      </div>

      {scan && (scan.candidates.length > 0 || scan.staleReferences > 0) && (
        <>
          {scan.candidates.length > 0 && <div className="migration-bulk">
            <label className="field">
              <span>{text("全候補へBCP-47タグを設定", "Set BCP-47 tag for all candidates")}</span>
              <input value={bulkLanguage} onChange={(event) => setBulkLanguage(event.target.value)} placeholder="ja / en / en-GB" />
            </label>
            <button className="btn ghost" type="button" onClick={applyBulkLanguage}>{text("一括適用", "Apply to all")}</button>
          </div>}
          {scan.candidates.length > 0 && <div className="migration-list">
            {scan.candidates.map((candidate) => (
              <div className="migration-row" key={candidate.id}>
                <div>
                  <code>{candidate.collection}</code>
                  <div className="meta">{candidate.sourcePath}</div>
                  <div>{candidate.value}</div>
                </div>
                <label className="field">
                  <span>BCP-47</span>
                  <input
                    value={languages[candidate.id] ?? ""}
                    onChange={(event) => setLanguages((current) => ({ ...current, [candidate.id]: event.target.value }))}
                    placeholder="ja"
                  />
                </label>
              </div>
            ))}
          </div>}
          <div className="toolbar">
            <button className="btn" type="button" disabled={busy || !allAssigned || !backedUp} onClick={migrate}>
              {text("migrationを実行", "Apply migration")}
            </button>
            {!backedUp && <span className="hint">{text("先にバックアップが必要です。", "A backup is required first.")}</span>}
          </div>
        </>
      )}
      {result && (
        <p className="hint">
          {text(
            `${result.migrated}レコードを変換、StrongRefを${result.repaired}回更新。`,
            `Migrated ${result.migrated} records and performed ${result.repaired} StrongRef updates.`,
          )}
        </p>
      )}
      <Message msg={msg} />
    </section>
  );
}
