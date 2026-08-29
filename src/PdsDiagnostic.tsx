import { useState } from "react";
import { rkeyFromUri, XrpcError } from "./atproto";
import { NSID } from "./lexicons";
import { Repo } from "./repo";
import { Message, Msg, now } from "./ui";
import { useI18n } from "./i18n";

export function PdsDiagnostic({ client }: { client: Repo }) {
  const { text } = useI18n();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function verify() {
    setBusy(true);
    setMsg(null);
    try {
      await verifyPdsWrite(client, text);
      setMsg({ kind: "ok", text: text("PDSへの作成・読み戻し・削除に成功しました。書き込み接続は正常です。", "Creating, reading, and deleting a PDS record succeeded. The write connection is working.") });
    } catch (error: any) {
      setMsg({
        kind: "err",
        text: `${text("PDS診断に失敗しました", "PDS diagnostic failed")}: ${error?.message ?? error}${error?.orphanUri ? text(`（一時レコードが残った可能性があります: ${error.orphanUri}）`, ` (A temporary record may remain: ${error.orphanUri})`) : ""}`,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="diagnostic">
      <div>
        <strong>{text("PDS 書き込み診断", "PDS write diagnostic")}</strong>
        <div className="hint">{text("一時レコードを作成・読み戻し・削除します。PDS上のデータは公開です。", "Creates, reads, and deletes a temporary record. Data on your PDS is public.")}</div>
      </div>
      <button className="btn ghost small" type="button" disabled={busy} onClick={verify}>
        {busy ? text("診断中…", "Checking...") : text("接続を検証", "Verify connection")}
      </button>
      <Message msg={msg} />
    </div>
  );
}

export async function verifyPdsWrite(
  client: Repo,
  text: (ja: string, en: string) => string = (ja) => ja,
): Promise<void> {
  let uri: string | null = null;
  try {
    const createdAt = now();
    const written = await client.createRecord(NSID.collection, {
      $type: NSID.collection,
      name: [{ language: "en", value: "Minori PDS write diagnostic" }],
      description: [{ language: "en", value: "Temporary record created and deleted by Minori's connection diagnostic." }],
      purpose: "topic",
      createdAt,
    });
    uri = written.uri;

    const rkey = rkeyFromUri(written.uri);
    const read = await client.getRecord(NSID.collection, rkey);
    if (read.uri !== written.uri || read.cid !== written.cid || read.value.createdAt !== createdAt) {
      throw new Error(text("読み戻したレコードが書き込み結果と一致しません", "The record read from the PDS does not match the write result"));
    }

    await client.deleteRecord(NSID.collection, rkey);
    uri = null;
    try {
      await client.getRecord(NSID.collection, rkey);
      throw new Error(text("診断レコードが削除後もPDSに残っています", "The diagnostic record remains on the PDS after deletion"));
    } catch (error) {
      if (!isRecordMissing(error)) throw error;
    }
  } catch (error) {
    if (uri) {
      try {
        await client.deleteRecord(NSID.collection, rkeyFromUri(uri));
        uri = null;
      } catch {
        // Preserve the URI on the error so a failed cleanup is actionable.
      }
    }
    const result = error instanceof Error ? error : new Error(String(error));
    if (uri) Object.assign(result, { orphanUri: uri });
    throw result;
  }
}

function isRecordMissing(error: unknown): boolean {
  if (error instanceof XrpcError) {
    const code = typeof error.data === "object" && error.data ? (error.data as any).error : undefined;
    return (error.status === 400 || error.status === 404) && code === "RecordNotFound";
  }
  if (typeof error !== "object" || !error) return false;
  const candidate = error as { status?: number; error?: string; message?: string };
  return (
    (candidate.status === 400 || candidate.status === 404) &&
    (candidate.error === "RecordNotFound" || /record.*not found|could not find record/i.test(candidate.message ?? ""))
  );
}
