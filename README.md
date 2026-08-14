# Minori

AT Protocol上に学術CVとプロジェクト別の文献を保存する、完全クライアントサイドのReactアプリです。OAuth後の書き込みは利用者自身のPDSへ直接行われ、Minori側にパスワードやデータベースはありません。PDS上のレコードは公開情報です。

## ローカル開発

```sh
pnpm install
pnpm dev
```

`http://localhost:5173` ではAT Protocolのloopback OAuth clientを使います。開発用としてアプリパスワード方式も折りたたみ内に残しています。本番ではアプリパスワードUIと保存済みの開発セッションは無効になります。

`localhost` で開いた場合はRFC 8252に従って同じポートの `127.0.0.1` へ自動移動します。OAuth callbackはReact Strict Mode下でも一度だけ処理されます。

## Cloudflareへデプロイ

OAuth metadataのURLとredirect URLは公開URLに完全一致する必要があります。カスタムドメインを先に決め、次のようにビルド・デプロイします。

```sh
VITE_PUBLIC_URL=https://minori.example.com pnpm deploy
```

このビルドでは `dist/client-metadata.json` が自動生成されます。Cloudflareのカスタムドメインを設定した後、次を確認してください。

- `https://minori.example.com/client-metadata.json` がHTTP 200・`application/json`で返る
- JSON内の `client_id`、`client_uri`、`redirect_uris` が同じ公開URLを指す
- OAuth後にCVプロフィールを保存し、「PDSからの読み戻しを確認しました」と表示される
- ログイン直後の「接続を検証」で、一時レコードの作成・読み戻し・削除がすべて成功する

現在の既定値は `https://minori.takeruf.workers.dev` なので、Git連携ビルドでは変数未設定でもmetadataが生成されます。カスタムドメインへ移行するときだけ `VITE_PUBLIC_URL` で上書きしてください。

## 保存するレコード

- `id.career.profile`（rkey `self`）
- `id.sifa.profile.position`（職歴・現職。Sifaの共有Lexiconを直接利用）
- 学歴、受賞、発表、研究費、委員歴、学協会、授業、学生指導、知財、社会貢献、Works、OSS
- `pub.paper.collection`（プロジェクト）
- `pub.paper.reference`（論文等）と `pub.paper.collectionItem`（所属）
- 任意で `id.career.authorship`（本人の業績主張）

複数レコードを伴う論文追加が途中で失敗した場合、作成済みレコードを逆順に削除します。各主要な保存操作ではPDSから読み戻し、URI/CIDを照合します。

UIは日本語・英語を切り替えられます。CVの表示テキストはUI言語と独立したBCP-47言語variant配列として保存され、`ja`、`en`に限らず任意の言語タグを追加できます。

「Migration」タブは、旧string形式と `und`（言語未判定）variantを具体的な言語variantへ変換するための暫定機能です。値の言語は推測せず、利用者が一括またはフィールドごとに指定します。実行前のJSONバックアップ、書き戻し後の読み戻し検証、同一PDS内のStrongRef修復を行います。attestationのtarget CIDは証明対象の版を固定するため更新しません。通常フォームは新しい `und` の保存を拒否します。

CLIでは環境変数で認証情報を渡し、まずdry-runとバックアップを作成します。

```sh
MINORI_IDENTIFIER=you.example.com \
MINORI_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx \
pnpm migrate:language-variants -- --language ja --output migration.json

# migration.jsonのlanguagesを確認・必要なら候補ごとに修正後
MINORI_IDENTIFIER=you.example.com \
MINORI_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx \
pnpm migrate:language-variants -- --plan migration.json --output migration-applied.json --apply
```

全対象PDSの再スキャンで旧形式、`und` variant、未解決StrongRefが0件になった後、Migrationタブ、CLI、旧形式互換読み取りは削除します。

OAuthは `transition:generic` を使わず、上記UIが書き込むコレクションごとの `repo:<NSID>` 権限だけを要求します。
