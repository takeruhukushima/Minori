import { useState } from "react";
import { rkeyFromUri, XrpcError } from "./atproto";
import { NSID } from "./lexicons";
import { Repo } from "./repo";
import { Message, Msg, now } from "./ui";

export function PdsDiagnostic({ client }: { client: Repo }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function verify() {
    setBusy(true);
    setMsg(null);
    try {
      await verifyPdsWrite(client);
      setMsg({ kind: "ok", text: "PDSへの作成・読み戻し・削除に成功しました。書き込み接続は正常です。" });
    } catch (error: any) {
      setMsg({
        kind: "err",
        text: `PDS診断に失敗しました: ${error?.message ?? error}${error?.orphanUri ? `（一時レコードが残った可能性があります: ${error.orphanUri}）` : ""}`,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="diagnostic">
      <div>
        <strong>PDS 書き込み診断</strong>
        <div className="hint">一時レコードを作成・読み戻し・削除します。PDS上のデータは公開です。</div>
      </div>
      <button className="btn ghost small" type="button" disabled={busy} onClick={verify}>
        {busy ? "診断中…" : "接続を検証"}
      </button>
      <Message msg={msg} />
    </div>
  );
}

export async function verifyPdsWrite(client: Repo): Promise<void> {
  let uri: string | null = null;
  try {
    const createdAt = now();
    const written = await client.createRecord(NSID.collection, {
      $type: NSID.collection,
      name: "Minori PDS write diagnostic",
      description: "Temporary record created and deleted by Minori's connection diagnostic.",
      purpose: "topic",
      createdAt,
    });
    uri = written.uri;

    const rkey = rkeyFromUri(written.uri);
    const read = await client.getRecord(NSID.collection, rkey);
    if (read.uri !== written.uri || read.cid !== written.cid || read.value.createdAt !== createdAt) {
      throw new Error("読み戻したレコードが書き込み結果と一致しません");
    }

    await client.deleteRecord(NSID.collection, rkey);
    uri = null;
    try {
      await client.getRecord(NSID.collection, rkey);
      throw new Error("診断レコードが削除後もPDSに残っています");
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
