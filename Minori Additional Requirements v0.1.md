# Minori 追加機能要件定義書 v0.4

- 文書状態: MVP追加実装用（公式版＋セルフホスト版）
- 作成日: 2026-08-28
- 対象機能: 個人向け公開学術CVビュー

## 1. 概要

既存のMinoriに、利用者のPDS上に保存された学術CV、職歴・現職、業績、プロジェクト別文献等を、未ログインの閲覧者へResearchmap風に表示する公開CVビューを追加する。

Minoriは引き続き個人研究者の学術情報を扱う。企業、自治体、団体およびプロジェクトの公式HP・LPを扱うTsumikiとは、目的、Lexicon、テンプレートおよびコードを分離する。

公式Minoriでは共通URLから任意の研究者CVを動的表示する。独自ドメイン、静的HTML、詳細なSEOまたは独自デザインが必要な研究者は、MinoriリポジトリをForkまたはGitHub Templateとして利用し、自分のGitHub Pagesへセルフホストできる。

## 2. 現行仕様として維持する事項

- 完全クライアントサイドのReactアプリである。
- OAuth後の書き込みは利用者自身のPDSへ直接行う。
- Minori側にパスワードまたはコンテンツデータベースを置かない。
- PDS上の対象Recordは公開情報である。
- localhostではAT Protocolのloopback OAuth clientを利用する。
- 本番ではアプリパスワードUIと保存済み開発セッションを無効にする。
- OAuth callbackはReact Strict Mode下でも一度だけ処理する。
- OAuthは`transition:generic`を使わず、書込対象コレクションごとの権限だけを要求する。
- 保存後はPDSから読み戻し、URIとCIDを照合する。
- 複数Record操作の途中失敗時は、作成済みRecordを逆順に削除する。
- UI言語とCVコンテンツの言語variantを分離する。
- 新規保存時は具体的なBCP-47言語タグを必須とし、`und`を拒否する。
- 同一PDS内のStrongRef更新と、attestation target CID固定の現行挙動を維持する。

## 3. 目的

- Minoriへ一度入力した情報を、個人の公開学術CVとして閲覧可能にする。
- Researchmapに近い情報密度を持ちながら、本人のPDSを公開情報の正本とする。
- ログインしていない第三者がhandleまたはDIDを指定して閲覧できるようにする。
- 編集画面と公開表示画面の責務を明確に分離する。
- 新しいサーバー、AppViewまたはコンテンツDBを追加しない。
- 共通URLで利用できる公開CVと、研究者自身が所有・改造できるセルフホストCVを同一コードベースから提供する。

## 4. Tsumikiとの境界

- Minoriは個人の学術CVだけを扱う。
- MinoriはTsumikiの単一公開Collectionである`site.tsumiki.content`を読み書きしない。
- TsumikiはMinori固有のRecordを読み書きしない。
- 組織HP用のHero、求人、施設、支援制度、自由LPブロックはMinoriへ追加しない。
- Minoriの公開CVテーマをTsumikiテンプレートとして扱わない。
- Tsumikiの汎用`#site`、`#section`、`#item`モデルをMinoriへ流用しない。Minoriでは学術的な相互運用性を持つ既存Lexiconを正本として維持する。
- 将来の相互参照は別要件とし、本追加実装には含めない。

## 5. 対象範囲

### 5.1 追加する機能

- 未ログインで利用できる公開CVビュー
- handleまたはDIDによる対象研究者の指定
- PDSからの公開Record動的取得
- CVセクションごとの一覧表示
- プロジェクト別の文献表示
- 日本語・英語のUI切替
- BCP-47 variantに基づくCV表示言語切替
- 印刷用レイアウト
- 公開CV URLのコピー
- データ取得状態、空状態、エラー状態の表示
- 既存Recordカテゴリから一枚のCV rootとページ内anchorを動的生成
- リポジトリのForkまたはTemplate利用による個人CVのセルフホスト
- 設定ファイルによる研究者handleまたはDIDの固定
- Astro等による静的CVページの生成
- 独自ドメイン向けcanonical、OGP、sitemap、robots.txt、Person JSON-LD生成
- GitHub Actionsによる手動・定期再ビルド

### 5.2 対象外

- Tsumikiとの統合
- 独自ドメインの自動発行・設定代行
- AppViewによる研究者横断検索
- 複数研究者の比較
- 研究者ランキング、引用指標の独自算出
- 非公開Record、下書き、共同編集
- PDFファイルのサーバー生成
- OAuthなしでの編集
- 外部サービスへの自動同期
- 新たな業績データベース
- Minori公式リポジトリから利用者リポジトリを自動生成・管理する機能

ブラウザの印刷機能によるPDF保存は許容するが、MVPの正式成果物はHTML表示と印刷用CSSとする。

## 6. 利用する既存Record

公開CVビューは、現行Minoriが既に扱う以下のRecordを利用する。

```text
id.career.profile
id.sifa.profile.position
pub.paper.collection
pub.paper.reference
pub.paper.collectionItem
id.career.authorship（存在する場合）
```

加えて、現行実装が扱う以下のカテゴリを表示対象とする。

- 学歴
- 職歴・現職
- 受賞
- 発表
- 研究費
- 委員歴
- 学協会
- 授業
- 学生指導
- 知的財産
- 社会貢献
- Works
- OSS

実際のコレクションNSIDは現行Minori実装を正とし、本要件書の一般名から新しい重複Lexiconを作らない。

## 7. 新規Lexicon方針

MVPの公開CV表示だけのために、新規Recordを必須にしない。既存Recordから既定順序で表示する。

Tsumikiは`site.tsumiki.content`一つのCollection内で汎用sectionとitemを表現するが、Minoriには適用しない。Minoriの学歴、職歴、論文、研究費等は単なる表示セクションではなく、他アプリとの相互運用対象となる学術データであるため、既存の意味的Lexiconを維持する。

表示順、非表示セクション、強調項目、テーマ等をPDSへ保存したくなった場合は、共有Lexiconである`id.career.*`や`pub.paper.*`へUI都合のフィールドを追加しない。Minoriがauthorityを持つドメインを確定した後、Minori固有のpresentation設定Lexiconを別途定義する。

その将来Recordの責務は表示設定だけとし、CV本文や業績を複製しない。

## 8. 画面とURL

### 8.1 画面

1. 既存の編集画面
2. 公開CV検索・入口画面
3. 一枚構成の公開CV表示画面
4. CV内のプロジェクト別文献セクション
5. 印刷表示

### 8.2 公式版URL

公式版はTsumikiと同じHash Router規則を採用する。CVは一枚のrootページとして表示し、末尾のanchorはその中のセクションを表す。

```text
# Minoriトップ
https://example.github.io/Minori/

# 研究者CVのroot
https://example.github.io/Minori/#/username.bsky.social

# CV内セクション
https://example.github.io/Minori/#/username.bsky.social/publications
https://example.github.io/Minori/#/username.bsky.social/projects
https://example.github.io/Minori/#/username.bsky.social/awards
```

正式な文法:

```text
/{base}/#/<handle>
/{base}/#/<handle>/<anchor>
```

- `<anchor>`は別ページではなく、一枚のCV内のセクションIDである。
- handle、DID、PDSの解決後に全CVセクションを描画する。
- anchorがある場合は描画完了後に該当sectionへスクロールする。
- Query方式の`?handle=`、`/cv/?handle=`および個別projectページURLは採用しない。
- 直接アクセスと再読込時にもGitHub Pagesで404にならない。

### 8.3 提供モード

#### Officialモード

- 既存Minoriの公開URLを利用する。
- hash URLのhandleまたはDIDから任意の研究者CVを動的表示する。
- PDS更新後の再デプロイは不要とする。
- 共有URLをコピーできる。
- 記事・業績単位の完全なSEOと利用者独自ドメインは保証しない。

#### Self-hostモード

- 研究者がMinoriリポジトリをForkするか、GitHub Templateから新しいリポジトリを作る。
- 設定ファイルで本人のhandleまたはDIDを固定する。
- 研究者自身のGitHub Pagesへデプロイする。
- 必要に応じて研究者自身が独自ドメインを設定する。
- ビルド時にPDSからCV Recordを取得し、一枚の静的HTMLへ全セクションを生成する。
- PDS更新後はGitHub Actionsで再ビルドする。
- 表示テーマやセクション構成を研究者自身が変更できる。

概念設定例:

```ts
export default {
  handle: "researcher.example.com",
  siteUrl: "https://researcher.example.com",
  deploymentMode: "static",
  locale: "ja"
}
```

- Forkは上流Minoriの改善を追従したい利用者向けとする。
- Use this templateは独自CVとして大きく改造したい利用者向けとする。
- GitリポジトリにはCV本文を正本として保存せず、PDSから取得する。
- 単一研究者のCV生成にAppViewを要求しない。

### 8.4 セルフホスト版URL

```text
https://researcher.example.com/
https://researcher.example.com/#publications
https://researcher.example.com/#projects
https://researcher.example.com/#works
```

一枚の静的HTML、rootのcanonical URL、および通常のfragment anchorを生成する。セルフホスト版ではhandleをURLへ含めない。

## 9. 公開CVの構成

### 9.1 ヘッダー

- 氏名
- 氏名の言語variant
- 現職・所属
- 顔写真またはプロフィール画像（存在する場合）
- 自己紹介
- 研究分野・キーワード
- 所在地または連絡先（公開Recordに存在する場合のみ）
- 外部リンク
- AT Protocol handle

連絡先等の表示は、対象Recordが公開情報であることを前提とする。UI側で推測または補完しない。

### 9.2 標準セクション順

1. プロフィール
2. 現職
3. 学歴・職歴
4. 研究プロジェクト
5. 論文・文献
6. 発表
7. 受賞
8. 研究費
9. 知的財産
10. Works・OSS
11. 学協会・委員歴
12. 授業・学生指導
13. 社会貢献

空のセクションは表示しない。

### 9.3 論文・文献

- `pub.paper.reference`を基本情報とする。
- 著者、題名、出版年、媒体、DOI、URL等、存在するフィールドだけを表示する。
- `pub.paper.collectionItem`を介してプロジェクト別に分類する。
- 同一referenceを複数collectionに所属させられる。
- collection内の順序情報があれば尊重し、なければ出版日の降順とする。
- `id.career.authorship`がある場合は、本人の業績主張として区別可能な表示にする。
- attestationの存在を、論文内容自体の正しさの保証として誇張しない。

## 10. データ取得

1. URLからhandleまたはDIDを取得する。
2. handleの場合はDIDへ解決する。
3. DID DocumentからPDS endpointを取得する。
4. 必要なcollectionを公開XRPCで取得する。
5. ページネーションがある場合は全件または設定上限まで継続取得する。
6. StrongRef、AT URI、collectionItemを解決して表示モデルへ正規化する。
7. 選択言語に応じてvariantを解決する。

取得は閲覧者のブラウザから行う。Minori側サーバー、AppView、キャッシュDBを追加しない。

大量のRecordによって描画を阻害しないよう、collectionごとに取得中状態を表示し、可能であれば段階的に描画する。

セルフホスト版では同じ取得・正規化ロジックをビルド時にも再利用し、静的表示モデルを生成する。ビルド時取得に失敗した場合はデプロイを失敗させ、直前の正常な公開成果物を維持する。

## 11. 言語

- UI言語とCVコンテンツ言語を別々に管理する。
- UIは日本語と英語を提供する。
- CVはRecordに存在する任意のBCP-47言語variantを選択できる。
- 表示言語の解決順は、閲覧者が選択した言語、プロフィール既定言語、利用可能な最初の具体的言語とする。
- 選択言語に値がない項目は、fallbackしたことが分かる一貫した規則で別variantを表示する。
- `und`を新規生成しない。

## 12. 表示と操作

- Researchmapのように情報量を保ちつつ、モバイルで読めるレイアウトとする。
- セクションへの目次を表示する。
- 目次項目とHTMLの`id`を既存Recordカテゴリから動的生成する。
- 公式版の目次URLは`/{base}/#/<handle>/<anchor>`とする。
- 長いセクションは折りたたみまたは件数制限と「すべて表示」を利用できる。
- DOI、外部URL、ORCID等は安全な外部リンクとして表示する。
- URLコピー操作を提供する。
- 印刷時はナビゲーション、編集導線、不要な操作ボタンを隠す。
- 印刷時にセクション見出しと項目が不自然に分断されないCSSを設定する。
- 取得中、対象なし、部分取得失敗、全体取得失敗を区別する。

## 13. 編集画面からの導線

- ログイン中の利用者に「公開CVを表示」を提供する。
- 現在のhandleを付与した公開CV URLを生成する。
- 保存成功後、公開CVを新しいタブで確認できる。
- 公開CVはPDSから再取得し、未保存のフォーム値を表示しない。
- 公開CVに反映されない場合、対象Record、URI、CIDおよび取得エラーを確認できる。

## 14. セキュリティとプライバシー

- 公開Recordだけを未認証で取得する。
- OAuth tokenを公開CV URL、ログ、エラー表示へ含めない。
- Record内のリッチテキストまたは外部入力由来文字列を安全に描画する。
- `javascript:`等の危険なURL schemeを拒否する。
- 外部リンクには適切な`rel`属性を付ける。
- 公開CVに表示される情報がPDS上の公開情報であることを編集画面で明示する。
- 公開CVビューはRecordにない情報を推測、補完または第三者APIから自動取得しない。

## 15. 性能と障害時挙動

- 初回表示ではプロフィールと現職を優先取得する。
- 他セクションは並列取得できる。
- 同一表示中の重複Record取得を避ける。
- 一部collectionの取得失敗でCV全体を表示不能にしない。
- PDSが応答しない場合は再試行操作を提供する。
- 無効Recordは安全に除外し、開発モードで理由を確認できるようにする。
- ブラウザメモリまたは短時間キャッシュは許容するが、永続的なMinori側CVデータベースは作らない。

## 15A. セルフホスト版SEO

- 氏名とプロフィールからページtitleとmeta descriptionを生成する。
- canonical URLを設定する。
- Open GraphおよびTwitter Card相当のメタデータを生成する。
- root CVに対するsitemap.xmlとrobots.txtを生成する。
- schema.orgのPerson、ScholarlyArticle等、Recordから根拠を持って生成できるJSON-LDを出力する。
- JavaScriptを実行しなくても主要プロフィールと業績を読める静的HTMLを生成する。
- DOI等の外部識別子を正規URLとして安全に反映する。
- PDS Blob画像をOGPに利用できない場合の既定画像を提供する。

## 16. 受入条件

1. 未ログイン状態でhandleを入力し、対象者の公開CVを表示できる。
2. handleからDIDとPDSを解決できる。
3. `id.career.profile`と`id.sifa.profile.position`を表示できる。
4. 現行Minoriが保存する主要カテゴリをセクション別に表示できる。
5. `pub.paper.collection`、`reference`、`collectionItem`からプロジェクト別文献を復元できる。
6. 空のセクションを表示しない。
7. 日本語・英語のUIを切り替えられる。
8. UI言語とは独立してCVの言語variantを切り替えられる。
9. PDS上のRecord更新後、Minoriを再デプロイせず、公開CVの再読込で変更が反映される。
10. 公開CV URLをコピーできる。
11. ブラウザ印刷でA4相当の読みやすいCVを出力できる。
12. 一部collectionの取得に失敗しても、取得済みセクションを表示できる。
13. OAuth tokenまたは秘密情報が公開URLへ含まれない。
14. TsumikiのRecordまたはUIへ依存しない。
15. MinoriリポジトリをForkまたはTemplate利用し、本人のhandleを設定してGitHub Pagesへデプロイできる。
16. セルフホスト版がPDSからプロフィール、業績一覧、プロジェクトセクションを含む一枚の静的CVを生成できる。
17. 独自ドメイン設定時にcanonical、OGP、sitemap、Person JSON-LDがそのドメインを指す。
18. セルフホスト版は未ログインかつJavaScript無効でも主要CVを表示できる。
19. PDS更新後、GitHub Actionsを再実行すると静的CVが更新される。
20. 単一研究者のセルフホストCVにAppViewを必要としない。
21. `/#/username.bsky.social/publications`へ直接アクセスまたは再読込しても404にならず、描画後にpublicationsセクションへ移動する。
22. 公式版に`?handle=`または`/cv/?handle=`形式の公開URLが残っていない。
23. CVの目次とanchorが取得したRecordカテゴリから動的生成される。

## 17. 実装順

### Phase 1: 公開読取基盤

- 公開CVルート
- `/#/<handle>/<anchor>` Hash Router
- handle、DID、PDS解決
- 公開Record取得クライアント
- 読込、空、エラー状態

### Phase 2: 基本CV

- profile
- position
- 学歴・職歴
- 多言語variant解決

### Phase 3: 業績

- reference一覧
- collectionとcollectionItemの結合
- プロジェクト別文献
- authorship表示

### Phase 4: 全カテゴリ

- 受賞、発表、研究費、委員歴、学協会
- 授業、学生指導、知財、社会貢献
- Works、OSS

### Phase 5: 公開品質

- 目次、レスポンシブ
- 印刷CSS
- URLコピー
- 部分障害耐性
- アクセシビリティ

### Phase 6: セルフホストCV

- セルフホスト設定ファイル
- handleまたはDID固定ビルド
- 一枚の静的CV生成
- canonical、OGP、sitemap、robots.txt、JSON-LD
- Fork／Use this template向けREADME
- `workflow_dispatch`と定期実行による再ビルド
- GitHub Pages独自ドメイン設定手順

## 18. 実装前に確認する事項

- 現行Minoriリポジトリ内の各カテゴリの正確なNSIDとフィールド
- profileに保存される既定言語と公開連絡先の仕様
- positionの並び順と現在職判定
- reference、collection、collectionItemの参照形式
- authorshipとattestationの表示上の意味
- GitHub Pages本番URL、base pathおよびHash Routerの動作
- 現行UIへ追加する導線の位置
- Minoriが現在React/Vite構成のまま静的CVを生成するか、Astroを同一リポジトリへ導入するか
- セルフホスト版設定ファイルの正式名称と配置
- ForkとTemplateのどちらを既定導線にするか
- 定期再ビルドの既定頻度
