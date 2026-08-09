# 学術CV + 文献管理 lexicon 設計メモ

- 文献: `pub.paper.*` — `lexicons/pub/paper/` (5 records)
- CV:  `id.career.*` — `lexicons/id/career/` (16 records、researchmap 全セクション対応)

すべて JSON 検証済み。

---

## 0. 名前空間について（先に読むこと）

NSID の権威セグメントは**実際に保有するドメイン**でなければなりません。

- `pub.paper.*` → `paper.pub` の保有が前提
- `id.career.*` → `career.id` の保有が前提

さらに lexicon 解決は `_lexicon.<domain>` の DNS TXT を引くため、
**ドメインを手放した時点で名前空間が孤児になります。** 数十年保持する前提の
資産です。`paper.pub` / `career.id` はまず押さえられているはずなので、
現実的な代案は**自分の1ドメインに2本のブランチを生やす**こと:

```
com.example.paper.reference
com.example.career.authorship
```

1ドメイン・DNS設定1箇所で済み、名前空間とバージョンの分離は保たれます。
本ファイル群は `pub.paper` / `id.career` で書いてあるので、
確定した prefix に一括置換してください（`$type` と `ref` の両方）。

意味論の注意: `reference` は書籍・データセット・ソフトウェアも扱うので
`paper` はやや狭い。実務上は9割が論文なので許容と判断しています。

---

## 1. 全体構造

```
  id.career.*  (CV, 16 records)
      │
      │  id.career.authorship だけが下を参照する
      ↓
  pub.paper.*  (文献, 5 records)      ← 単体で完結。CV を一切知らない
```

**依存は片方向。** 文献管理だけ使いたい人（学生・非研究者・ライター）は
CV lexicon を実装しなくていい。逆に CV の publication セクションは
文献レコードを必要とする。

- Lexicon: 2つ（名前空間もバージョンも分離）
- AppView / 認証 / インデックス / ホスティング: 1つ
- リリース順: 文献 → CV

---

## 2. なぜ BibTeX をスキーマにしないか

保存は **CSL-JSON 相当**、`.bib` は出力形式のひとつ。

### BibTeX をそのままスキーマにすると壊れる箇所

| 問題 | 具体例 |
|---|---|
| 著者が単一文字列 | `author = {山田 太郎 and van der Berg, Jan Jr.}` を毎回パース。`and` が区切りか名前の一部か、`von`/`Jr` の扱い、CJK に姓名の区切りがない |
| LaTeX エスケープが値に埋まる | `{\"o}`, `--`, `$\alpha$`, `{DNA}`。公開レコードに入れると LaTeX 以外の全消費者で文字化け |
| BibTeX / biblatex の分裂 | `journal`↔`journaltitle`、`address`↔`location`、`year`+`month`↔`date` |
| エントリ型が実質無限 | biblatex だけで50種近く、スタイルごとの独自拡張あり |
| 日付が表現できない | 「in press」「forthcoming」「ca. 1750」「2019–2021」 |
| citekey がローカル | プロジェクト内でしか一意でなく、ネットワーク上の同一性判定に使えない |

### CSL-JSON を正にする利点

- Zotero / Mendeley / pandoc / citeproc / Better BibTeX の共通交換形式。
  Zotero がネイティブ出力できる = 移行コストが低い
- 名前が構造化オブジェクト（family / given / literal / particle）で
  CJK 名も組織名も壊れない
- 部分・近似・範囲・非数値の日付を表現できる
- Crossref / DataCite / arXiv / OpenAlex → CSL-JSON は解決済み
- 10,000超の CSL スタイルが使え、`.bib` は citeproc/pandoc でロスなく出る
  （逆向きはロスあり）

### BibTeX ユーザの実害3点は個別に潰してある

1. **`citeKey` を導出せず永続保存。** 再生成すると原稿中の `\cite{}` が
   全部壊れるため、一度書いたら不変扱い
2. **`containerTitleShort`（ISO 4 略誌名）を別フィールドで保持。**
   フルネームからの機械導出は不正確で、略誌名必須の投稿先が多い
3. **`bibtexExtra` を escape hatch として用意。** ただし description に
   「頻用するならスキーマの欠陥なので issue を立てろ」と明記

これで `.bib` は決定論的に生成できます。同じレコードから常に同じ
citekey・同じフィールドの `.bib` が出る。

---

## 3. `pub.paper.*`（文献）

| NSID | rkey | 役割 |
|---|---|---|
| `pub.paper.defs` | — | contributor / date / identifier / sourceInfo / bibtexField |
| `pub.paper.reference` | tid | 書誌1件。**著者性は主張しない** |
| `pub.paper.collection` | tid | 名前付きリスト（執筆中の論文 / 積読 / 講義 / SR） |
| `pub.paper.collectionItem` | tid | reference ↔ collection の所属 |
| `pub.paper.readingStatus` | **any** | 未読・読了・優先度・評価・メモ |

### 設計判断

**`reference` は「誰かの著作の記述」であり「自分の業績」ではない。**
著者性の主張は `id.career.authorship` に分離。これで文献 lexicon は
引用する人にも業績を出す人にも同じ形になり、同じ論文を二重に持たずに済む。

**アカウント間の重複は正しい挙動。** atproto では各ユーザが自分のコピーを
所有する。AppView 側で正規化 DOI をキーに work へクラスタリングする。
中央マスタを持とうとしないこと。

**所属を配列にせず別レコードにした理由:** (a) 実用的な文献数で 1MB の
レコード上限に当たる、(b) 1件追加ごとに全体を書き直す、(c) 共同編集で
write が衝突する。`app.bsky.graph.listitem` と同型。

**`readingStatus` の rkey は対象 reference の rkey を流用する規約。**
`key: "any"` はそのため。「1文献1状態」が構造的に保証され、
参照が scan でなく getRecord になる。

**`collectionItem.sections`** が地味に効く。「related work で引く」を
記録すると平坦な文献リストがアウトラインになり、「まだどこにも
引用していない文献」が機械的に出せる。

**注釈は自作しない。** ハイライト・傍注は既存の注釈アプリに任せ、
`readingStatus.note` を肥大化させない。

---

## 4. `id.career.*`（CV）

### 4.1 Sifa を再定義しないこと

`id.sifa.*` は MIT ライセンスで「誰でも上に乗れる共有標準」と公式に
宣言されており、設計も真面目です。`id.sifa.org.employmentAttestation` は
対象 position を strongRef（AT-URI + CID）で版ごとピン留めし、組織参照は
フリーテキストでなく Wikidata Q-ID / ROR / LEI の URI を使う規約になっている。

したがって **`position` はここで定義していません。**

- 現職・肩書き・職歴・インターン → `id.sifa.profile.position` を使う
- `dossier` の `sectionSpec.source` が NSID 文字列なのはこのため。
  他名前空間のレコードをそのままセクションとして引ける
- 日付形式（`YYYY` / `YYYY-MM` / `YYYY-MM-DD` のフリーフォーム文字列）と
  組織参照規約は **Sifa に合わせてある**。ここを揃えないと相互運用の意味がない
- 2026-08-09時点で `id.sifa.profile.education` の公開を権威DID
  `did:plc:2f2ahswozqy4v5lvu676375y` のPDS上で確認済み。ただしSifa版には
  学位論文・指導教員・「単位取得退学」等の学術CV固有フィールドがないため、
  現フェーズでは `id.career.education` を学術拡張として維持する。将来は共通部分を
  Sifaへ寄せ、拡張レコードからstrongRefで補足する方式を検討する

### 4.2 レコード一覧（全16種、すべて v1）

| NSID | rkey | 役割 | researchmap 対応セクション |
|---|---|---|---|
| `id.career.defs` | — | organization / personRef / scope / fieldCode / money / sectionSpec | — |
| `id.career.profile` | **self** | 宣言レコード。学位・研究者番号・J-GLOBAL ID・researchmap会員ID | 基本情報 / 研究キーワード / 研究分野 |
| `id.career.education` | tid | 学歴・学位・学位論文・指導教員 | 学歴 |
| `id.career.authorship` | tid | **CV↔文献の唯一の接点** | 論文 / MISC / 書籍等出版物 |
| `id.career.presentation` | tid | 講演・ポスター・パネル・チュートリアル | 講演・口頭発表等 |
| `id.career.openSourceContribution` | tid | OSS・公開データ・ドキュメント | Works（ソフトウェア系） |
| `id.career.work` | tid | 提言・報告書・データベース・作品・展示 | Works（作品等） |
| `id.career.grant` | tid | 競争的資金・受託研究・共同研究 | 共同研究・競争的資金等の研究課題 |
| `id.career.award` | tid | 受賞 | 受賞 |
| `id.career.service` | tid | 査読・編集・PC・学会役員・審議会 | 委員歴 / 学術貢献活動 |
| `id.career.membership` | tid | 学協会への所属 | 所属学協会 |
| `id.career.teaching` | tid | 担当科目 | 担当経験のある科目(授業) |
| `id.career.supervision` | tid | 学生指導 | （researchmap に対応なし） |
| `id.career.patent` | tid | 産業財産権 | 産業財産権 |
| `id.career.outreach` | tid | 社会貢献・メディア | 社会貢献活動 / メディア報道 |
| `id.career.attestation` | tid | 第三者証明 | （researchmap に対応なし） |
| `id.career.dossier` | tid | CV の出し分け定義 | （出力側） |

（`position` は `id.sifa.profile.position` を使うため意図的に不在。researchmap の「経歴」がこれに当たる）

researchmap 側にあって本設計にないセクションはありません。逆に
`supervision` と `attestation` は researchmap にない拡張です。

### 4.3 形でまとめる方針

ポスターと口頭発表を別レコードにすると、ほぼ同一のスキーマが増え、
消費側が二重実装を強いられるだけです。`presentation` に `type` enum で
吸収しています。`service` も同様に査読・編集・PC・役員を1つに畳んである。

### 4.4 researchmap 準拠のために入れたもの

実在の researchmap プロフィール（名古屋大学 井藤彰教授、論文171件・MISC336件・
資金33件）と突き合わせて設計しました。国際スキーマがどれも表現できず、
日本の業績票では必須になるもの:

| フィールド | 理由 |
|---|---|
| **`authorship.outputCategory`** | **論文 / MISC / 書籍等出版物 の振り分け。最重要（後述）** |
| `authorship.contributionType` | 単著 / 共著 / 編者 / 分担執筆 / 翻訳 / 監修。researchmap の「担当」 |
| `authorship.venueType` に `proceedingsAbstract` / `bulletin` / `commentary` | 予稿集・紀要・解説記事。国際語彙に存在しない |
| `authorship.isFeatured` | 主要な業績フラグ。「選択業績」を二重管理せずに出せる |
| `education.status = creditsCompletedNoDegree` | 単位取得退学。標準的かつ非懲罰的な結果だが国際スキーマにない |
| `grant.fundingType` | 受託研究・共同研究・寄附金を競争的資金と区別。評価上の重みが違う |
| `grant.partnerOrganizations` | 参画企業・機関。「株式会社クラレ」を personRef に押し込むと ROR が失われる |
| `grant.role = hostResearcher` | 受入研究者。学振の正式な役割で英語圏に対応物がない |
| `service.type = academyMember / governmentCommittee` | 日本学術会議 連携会員、審議会委員。researchmap の「委員歴」 |
| `outreach.roles`（**配列**） | researchmap は「パネリスト, 司会, 企画, 運営参加・支援」を1件に複数持つ |
| `work.kind = policyRecommendation / committeeReport` | 提言・報告。学術会議等の正式な成果物型 |
| `patent.applicationNumber` 単独で成立 | 特願番号は登録の何年も前から CV に載る |
| `profile.kakenId` / `jglobalId` / `researchmapMemberId` / `degrees` | 申請書に必ず要る識別子群 |
| `fieldCode.scheme = kakenhi / researchmap` | 審査区分・分科細目、researchmap 独自の研究分野階層 |
| `defs#scope` (international/national/…) | 国際/国内の区別 |
| `presentation.language` | 国内学会（和文）と国際発表の分離 |
| `identifier.scheme = ncid / naid / jglobal` | 和文文献は DOI 被覆率が低い |
| `reference.originalTitle` | 英文CVに和文業績を載せるとき原題が要る |
| `sectionSpec.numbered` / `reverseNumbering` | 業績票は番号付きが原則 |

#### `outputCategory` が最重要な理由

**論文とMISCの振り分けは、参照の型からも掲載誌からも導出できません。**
本人の判断です。同じ「和文の解説記事」を論文に入れる人と MISC に入れる人が
いるし、予稿集アブストラクトも同様。井藤先生のプロフィールでは
**論文171件に対して MISC336件** で、MISC のほうが倍あります。

ここを機械推論しようとすると数百件を静かに誤分類します。だから
`pub.paper.reference.type` は CSL 語彙に厳密に留め（「これは何か」）、
振り分けは `id.career.authorship.outputCategory` に置きました
（「CVのどこに載るか」）。**引用のための型と、業績票のための分類は別物**、
というのがこの分離の要点です。文献 lexicon が引用専用ユーザにも
使えるままなのはこのおかげでもあります。

### 4.5 `work` と `openSourceContribution` の境界

researchmap の Works にはソフトウェア・データベース・提言・報告・作品が
同居しています。1レコードに畳むと、リポジトリ/パッケージ/ライセンスの
フィールドが展示会レコードで死に、会場/会期のフィールドがライブラリで死ぬ。

**判定基準: ソースリポジトリかパッケージレジストリのエントリがあれば
`openSourceContribution`、なければ `work`。** description に明記済みです。

### 4.6 特に効く3つ

**`authorship` の分離。** 設計の中心です。「reference は誰の著作でも同じ形」
「authorship は自分の repo にある主張」に分けたことで、文献 lexicon が
CV から独立し、かつ authorship 自体が独立に検証可能なオブジェクトになる。

**`attestation` = 共著者・機関による相互証明。** Sifa の
employmentAttestation と同じパターンで、共著者が「この DID は確かに
この論文の著者だ」と署名付きで宣言できる。**atproto でやる意味が一番
はっきり出るのはここ**で、自己申告CVが検証できないという根本問題に
中央機関なしで答えられる。`assertion` に `disputes` を含めてあるのは
意図的です — 肯定しかできない証明レイヤーは検証システムではなく評判システムです。
strongRef が CID をピン留めするので、対象を編集すると証明は自動的に無効になる。

**`dossier` = CV の出し分け。** 研究者は用途別に CV を持ち替えます
（学振 / 教員公募 / 産業向け / 業績票 / 二行の略歴）。「どのセクションを
どの順で、どのフィルタ・どの言語で出すか」をレコード化すると、
同じ下敷きから全部生成できる。`locale` ひとつで和文CVと英文CVが
同じレコード集合から出る。既存サービスにない差別化点です。

---

## 5. AppView

- **取り込み**: Jetstream で対象コレクションのみ購読 → Postgres に投影。
  Firehose 全量は不要
- **work クラスタリング**: DOI を小文字化・prefix 除去して正規化。
  DOI 不在は (正規化タイトル + 第一著者姓 + 年) のファジーキー
- **検証バッジ**: `authorship` を Crossref / DataCite / ORCID と突合し、
  さらに `attestation` の有無を見る。三段階 —
  未検証 / 外部レジストリ一致 / 共著者証明あり
- **書き出し**: `.bib`（BibTeX / biblatex 両方）、CSL-JSON、RIS、
  LaTeX CV（moderncv / awesome-cv）、Typst、JSON Resume、
  researchmap 一括登録形式、科研費業績様式。**逆向き（researchmap → PDS）の
  インポータを最初に書くこと**: 既存研究者は業績を全部 researchmap に入れて
  あるので、そこからの一括取り込みができないと誰も移らない。
  **この出力の充実が獲得の主戦場**です。移行コストが直接下がる
- **書き込み**: atproto OAuth でユーザの PDS に直接。AppView は代理書き込みしない
- **流入**: Zotero → CSL-JSON → PDS の CLI を最初に作る。
  Zotero 側から atproto に publish するプラグインには既に先行事例があるので、
  導線設計の参考にする
- **入れないもの**: h-index、被引用数。即座に陳腐化し出典で値が違うので、
  レコードではなく実行時に外部から引く

---

## 6. プライバシー（最初に明文化すること）

atproto は現状すべて公開です。学術用途では以下が実害になります。

| 項目 | 問題 | 本設計での対応 |
|---|---|---|
| 積読リスト | 何を読んでいるかで研究方向と投稿戦略が漏れる | ローカル専用モードを用意し、PDS に上げるかを明示的に選ばせる |
| 査読 | 匿名性が制度の本質 | `service` は**学会名と件数のみ**。対象論文のフィールドは存在せず、今後も追加しない |
| 学生氏名 | 権力差のある関係で第三者情報を公開する | `supervision.student` は DID 参照が基本。氏名は既定で空、明示的操作を要求 |
| 不採択の申請 | 出したくない人が多い | `grant.status` で表現可能だが、書かない選択を推奨と明記 |
| 査読中の論文 | 投稿先が特定される | `peerReviewStatus = underReview` は description で「採択まで作らない」を推奨 |
| 金額 | 開示義務がない場合が多い | `amountDisclosure` + 「隠すなら値ごと省く」と明記 |

`disclosure` / `amountDisclosure` は**プライバシー機能ではなく表示ヒント**
だと description に書いてあります。公開 PDS に書いた時点で公開です。
ここを曖昧にすると研究者コミュニティで一発で信用を失います。

---

## 7. 進め方

1. NSID prefix を確定し、全ファイルを一括置換（`id` と `ref` の両方）
2. `lexicon.garden` で既存 NSID との衝突確認。特に `id.sifa.*` の
   education 有無（`did:plc:2f2ahswozqy4v5lvu676375y`）
3. **Zotero → CSL-JSON → 自分の PDS に書く CLI を作る。AppView 不要。**
   `paper push` / `paper pull --collection foo > refs.bib` が動けば
   個人的な要件（執筆用書誌管理＋積読）は満たせる
3b. **researchmap インポータ**を書き、井藤先生のプロフィールを丸ごと
   変換してみる。171+336+33件が損失なく入るかが本設計の実地テストになる。
   落ちたフィールドがそのまま v1.1 の課題リストになります
4. Sifa に「学術拡張を足したい、無理なら別名前空間で規約だけ揃えたい」と接触
5. atproto.science コミュニティに設計を出す
6. AppView は 3〜5 の反応を見てから

**3 を 4・5 より先にやること。** 動くものがないと議論が抽象論になります。

### 凍結前に叩くべき点

- `authorship` の粒度。日本では筆頭・責任著者・等貢献に加え、
  業績票で「査読の有無」を分野ごとに違う基準で書かされる
- `service.type` の粒度が分野で合っているか（生命科学と CS で違う）
- `presentation.scope` と `language` の二重管理が冗長でないか

## 技術スタック
数字を確認してきました。**プロジェクト数そのものより、共有クォータのほうが問題です。**

## プロジェクト数

Workers は**アカウントあたり100個**（有料500）。ここは普通まず当たりません。

ただし実際には「アカウントのプロジェクト数のソフトリミットに達しました。作成するにはサポートに連絡してください」というエラーに当たる報告があります。100より手前で止められて、サポート申請すれば通る、という運用のようです。

## 本当に食い合うのはここ

**100,000リクエスト/日はアカウント全体で共有**です。プロジェクトごとではありません。Pages Functions へのリクエストも Workers の同じ枠を消費します（Functions 5万 + Workers 5万で1日分を使い切る、と公式が例示している）。

つまり**既存プロジェクトが動的処理をしていると、新規プロジェクトはその残りを分け合う**ことになります。

同様にアカウント共有なのが:

| 項目 | 無料枠 | 備考 |
|---|---|---|
| Workers リクエスト | 100,000/日 | **アカウント全体** |
| **Cron Trigger** | **5個/アカウント** | 有料は250 |
| D1 ストレージ | 5GB | 全DB合計 |
| DO Duration | 13,000 GB-s/日 | アカウント全体 |

**Cron Trigger が5個しかない**のは要注意です。既存プロジェクトで使っていると、新規プロジェクトの定期処理が置けません。

## 前回の訂正

**「Cron型 ingest なら無料でいける」と言いましたが、これは間違いでした。**

Cron Trigger の CPU 時間は無料プランで **10ms**、有料でようやく30秒（1時間未満間隔）です。HTTPリクエストと同じ10ms制限がかかる。Jetstream からのバックログを10msで捌くのは不可能です。

つまり**ingest は無料プランではどう組んでも無理**、というのが正しい結論です。常駐DOなら枠の83%を食い、Cronなら CPU で死ぬ。AppView が要る段階になったら $5/月 か VPS、で確定です。

## 一方で、フェーズ1は本当にタダです

決定的なのがこれ。**静的アセットへのリクエストは無料・無制限**です。Functions を起動しないリクエストは静的とみなされ、カウントされません。

なので:

```
Astro を完全静的ビルド
  ├ ビルド時に listRecords して自分のCVを生成
  └ 編集画面は oauth-client-browser で直接PDSへ
→ Workers リクエスト消費: ほぼゼロ
→ Cron Trigger 消費: 0
→ D1: 使わない
```

**既存プロジェクトのクォータを一切食いません。** Pages のビルド回数（500/月）だけ共有ですが、個人プロジェクトなら余裕です。

ついでに、SSR にすると `subrequests 50/request` が効いてきます。CVページを SSR で組んで listRecords を17コレクション分ファンアウトすると、ページ1枚でその制限に近づく。**静的ビルドにする理由がここにもあります。**

## まとめ

- プロジェクト数(100)は気にしなくていい。ソフトリミットに当たったらサポート申請
- 気にすべきは **100k req/日** と **Cron 5個**、どちらもアカウント共有
- フェーズ1（個人利用・静的・PDS直読み）なら**どの共有クォータも消費しない**ので、既存プロジェクトへの影響ゼロ
- AppView を作る段になったら Cloudflare 無料は選択肢から外れる。その時に VPS か $5/月を判断

個人利用前提で進めるなら、当面 Cloudflare の枠は一切考えなくて大丈夫です。まず CLI ですね。

バックエンド（他のユーザの一覧ページや検索ページなど）は初めは必要ない。
