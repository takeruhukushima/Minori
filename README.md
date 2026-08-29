# Minori

AT Protocol上に学術CVとプロジェクト別の文献を保存する、完全クライアントサイドのReactアプリです。OAuth後の書き込みは利用者自身のPDSへ直接行われ、Minori側にパスワードやデータベースはありません。PDS上のレコードは公開情報です。

## 公開CVビュー

未ログインの第三者が、handleまたはDIDを指定してResearchmap風の公開学術CVを閲覧できます。取得は閲覧者のブラウザから直接PDSへ行われ、新しいサーバー・AppView・キャッシュDBは追加しません。

```text
# 研究者CVのroot
https://<host>/#/username.bsky.social

# 公開CV検索
https://<host>/#/discover

# CV内セクション（描画後に該当anchorへスクロール）
https://<host>/#/username.bsky.social/publications
https://<host>/#/username.bsky.social/collections

# 文献リスト詳細
https://<host>/#/username.bsky.social/collections/<collection-rkey>
```

- handle → DID → PDS を解決し、公開XRPCで各コレクションを取得します（`src/public/identity.ts`, `publicClient.ts`）。
- UI言語（日本語/英語）とCVコンテンツ言語（BCP-47 variant）は独立して切り替えられます。
- 目次とanchorは取得できたレコードカテゴリから動的生成し、空セクションは表示しません。
- 公開CV検索はBlueskyの検索候補を各PDSで検証し、`id.career.profile`を持つユーザーだけを表示します。完全な全件一覧にはAppViewによる継続的な索引が必要です。
- 印刷CSSでA4相当のCVを出力できます。編集画面のトップバーに「公開CVを表示」導線があります。

### 提供モード

- **公式版（GitHub Pages）**: 共通URLの `#/<handle>` から任意の研究者CVを動的表示します。PDS更新後の再デプロイは不要です。`.github/workflows/pages-deploy.yml` がビルドとデプロイを行い、`VITE_BASE`（`/<repo>/`）と `VITE_PUBLIC_URL` はリポジトリから自動導出されるのでForkでもそのまま動きます。
- **セルフホスト版（Astro 静的生成）**: 研究者がリポジトリをForkまたはTemplate利用し、自分のPDSからビルド時に取得した一枚の静的CV（JS無効でも表示可・SEO対応）を自分のGitHub Pagesへデプロイします。手順は [`self-host/README.md`](./self-host/README.md) を参照してください。

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

新規保存では具体的なBCP-47言語タグが必須で、`und`（言語未判定）は拒否されます。既存レコードの編集でCIDが変わった場合、同じPDS内のStrongRefを再走査して更新します。attestationのtarget CIDは証明対象の版を固定するため更新しません。

OAuthは `transition:generic` を使わず、上記UIが書き込むコレクションごとの `repo:<NSID>` 権限だけを要求します。
