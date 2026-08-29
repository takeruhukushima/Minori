import { useState } from "react";
import { cvHref } from "../hashRoute";
import { LocaleSwitcher, useI18n } from "../i18n";
import { normalizeHandle } from "../public/identity";
import { searchMinoriUsers, type MinoriUser } from "../public/discovery";
import { pickLanguageText } from "../languageText";
import { safeUrl } from "../public/sanitize";

export function Discover() {
  const { locale, text } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MinoriUser[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setStatus("loading");
    setError("");
    try {
      setResults(await searchMinoriUsers(query));
      setStatus("done");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus("error");
    }
  }

  function openExactHandle() {
    const handle = normalizeHandle(query);
    if (handle) location.href = cvHref(handle);
  }

  return (
    <div className="app discover-page">
      <div className="topbar">
        <a className="brand" href={import.meta.env.BASE_URL || "/"}>
          <span className="brand-mark" aria-hidden="true">M</span><span>Minori</span>
        </a>
        <LocaleSwitcher />
      </div>

      <header className="discover-header">
        <span className="section-label">{text("公開CV", "PUBLIC CVS")}</span>
        <h1>{text("研究者を探す", "Find researchers")}</h1>
        <p>{text(
          "名前またはBlueskyハンドルで検索します。検索結果には、PDS上に公開CVを持つユーザーだけを表示します。",
          "Search by name or Bluesky handle. Results only include users with a public CV on their PDS.",
        )}</p>
      </header>

      <form className="panel discover-search" onSubmit={search}>
        <label className="field">
          <span>{text("名前またはハンドル", "Name or handle")}</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="takerufukushima.bsky.social" autoFocus />
        </label>
        <div className="toolbar">
          <button className="btn" type="submit" disabled={status === "loading" || !query.trim()}>
            {status === "loading" ? text("検索中…", "Searching...") : text("検索", "Search")}
          </button>
          <button className="btn ghost" type="button" disabled={!query.trim()} onClick={openExactHandle}>
            {text("このハンドルを直接開く", "Open exact handle")}
          </button>
        </div>
      </form>

      {status === "error" && <p className="msg err">{error}</p>}
      {status === "done" && results.length === 0 && (
        <div className="panel empty">{text("公開CVを持つユーザーが見つかりませんでした。ハンドルが分かる場合は直接開けます。", "No users with a public CV were found. If you know the handle, you can open it directly.")}</div>
      )}
      {results.length > 0 && (
        <section aria-labelledby="discover-results-title">
          <h2 id="discover-results-title">{text("検索結果", "Results")} <span className="tag">{results.length}</span></h2>
          <div className="discover-results">
            {results.map((user) => {
              const profile = user.profile.value ?? {};
              const name = pickLanguageText(profile.displayName, locale) || user.displayName || user.handle;
              const headline = pickLanguageText(profile.headline, locale) || user.description;
              const avatar = safeUrl(user.avatar);
              return (
                <a className="discover-user" href={cvHref(user.handle)} key={user.did}>
                  {avatar ? <img src={avatar} alt="" /> : <span className="discover-avatar">{name.slice(0, 1).toUpperCase()}</span>}
                  <span className="discover-user-copy">
                    <strong>{name}</strong>
                    <small>@{user.handle}</small>
                    {headline && <span>{headline}</span>}
                  </span>
                </a>
              );
            })}
          </div>
        </section>
      )}

      <p className="center-note">{text(
        "完全な全件一覧には、PDSを継続的に索引するAppViewが必要です。現在は検索候補を各PDSで検証しています。",
        "A complete directory requires an AppView that continuously indexes PDS records. Currently, search candidates are verified against each PDS.",
      )}</p>
    </div>
  );
}
