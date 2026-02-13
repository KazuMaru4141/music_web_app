# FUNC-002: 関連アーティスト探索 (Related Artists Discovery)

## 1. 機能概要 (Overview)
**機能ID:** FUNC-002
**名称:** AI主導の関連アーティスト探索機能（Dig Deeper）
**目的:** ユーザーが現在聴いている、または興味を持ったアーティストに対し、AI（Gemini）が音楽的に関連性の高いアーティストを推薦し、データベースに蓄積することで、受動的なリスニングから能動的な音楽探索（Digging）へと誘導する。

## 2. 事前条件 (Pre-conditions)
* ユーザーがログイン状態であること。
* 対象となるアーティスト名（またはID）が特定できていること。
* Google Gemini API および Spotify API の認証情報が有効であること。

## 3. 入力・操作 (Inputs / Triggers)

### A. UIによる探索 (UI Trigger)
* **UIトリガー:**
    * `NowPlaying` または `ArtistDetail` 画面で「Dig Deeper（更新）」ボタンをクリック。
    * または、初回アクセス時に自動実行。
* **入力パラメータ (API: `GET /api/player/related-artists`):**
    * `artist`: アーティスト名 (string, 必須)
    * `artist_id`: Spotify Artist ID (string, 任意)
    * `refresh`: 強制更新フラグ (boolean, 文字列 "true" で指定)

### B. キーボードショートカットによる探索 (Keyboard Shortcut Related Discovery)
* **UIトリガー:** `NowPlaying` 画面表示中に、キーボードの `Alt + R` を押下。
* **API:** セクション A と同一のエンドポイント `GET /api/player/related-artists` を使用。`refresh=true` で強制更新を行う。
* **対象コンポーネント:** `components/NowPlaying.tsx`
* **実装方式:** FUNC-001 セクション C と共通の `useEffect` + `window.addEventListener('keydown', ...)` によるグローバルキーイベントリスナー内に処理を追加。

#### B-1. 採用する入力方式

**`Alt + R`** (Mac: `Option + R`) を本機能の入力方式として採用する。

| 操作 | 動作 |
|---|---|
| `Alt + R` | Related タブに切り替え、AI検索（Refresh）を即時実行 |

**採用理由:**
- `R` = **R**elated の頭文字であり直感的に理解できる
- `Alt` 修飾キーとの組み合わせで既存ショートカット（`Alt + 1〜5`, `Alt + S`）と体系が統一される
- 「タブ切り替え」と「AI検索実行」の2アクションを1キーで完結させ、マウス操作の手間を大幅に削減

#### B-2. ガード条件 (Guard Conditions)
FUNC-001 セクション C-2 と同一のガード条件を適用する（テキスト入力中、キーリピート等）。
追加条件として、`trackRef.current?.artist` が存在しない場合（再生中の曲がない場合）は処理を中断する。

#### B-3. 処理フロー (Processing Flow)
1. `window` の `keydown` イベントを検知する。
2. ガード条件（B-2）を評価し、該当すれば処理を中断する。
3. `e.altKey === true` かつ `e.key === 'r'` または `e.key === 'R'` であることを検証する。
4. `e.preventDefault()` でブラウザのデフォルト動作を抑止する。
5. `trackRef.current` から現在再生中のアーティスト情報を取得する。
6. **タブ切り替え:** `setActiveTab('related')` を実行し、Related タブを表示する。
7. **トースト通知:** `"🔍 Searching Related Artists..."` を表示し、処理開始をユーザーに通知する。
8. **AI検索実行:** `fetchRelatedArtists(artistName, artistId, true)` を `refresh=true` で呼び出し、キャッシュを無視してGemini APIによる新規推薦を強制する。
9. API レスポンス受領後、Related タブ内のアーティストカードリストを更新する。

#### B-4. 実装上の依存関係・注意点 (Implementation Notes)

| 項目 | 詳細 |
|---|---|
| **`useCallback` メモ化** | `fetchRelatedArtists` を `useCallback` でメモ化し、`useEffect` の依存配列に安定した参照を含める。 |
| **2アクション同時実行** | `setActiveTab('related')` と `fetchRelatedArtists(..., true)` を連続して呼び出す。React のバッチ更新により、タブ切り替えとローディング表示が同時に反映される。 |
| **強制リフレッシュ** | `refresh=true` を明示的に指定し、DBキャッシュを無視してGemini APIによる新規解析を実行する。これにより毎回新鮮な推薦結果が得られる。 |
| **ローディング表示** | `isRefreshing` ステートが `true` になり、`RefreshCw` アイコンのスピンアニメーションとローディングインジケータが表示される。 |
| **依存配列** | `useEffect` の依存配列に `fetchRelatedArtists` を追加する（`handleRate`, `handleSaveAlbum` と並列）。 |
| **「聴く→評価→保存→ディグる」サイクルの完結** | `Alt + 1〜5`（評価）→ `Alt + S`（保存）→ `Alt + R`（探索）の順に操作することで、キーボードのみで音楽探索の一連のサイクルが完結する。これはアプリの中核的なUXコンセプトである。 |

## 4. 処理ロジック (Processing Logic)
1.  **キャッシュ確認 (Cache Strategy):**
    * `refresh=false` の場合、まず Supabase の `related_artists` テーブルを確認する。
    * 既存の関連データが閾値（例: 10件）以上あれば、APIコールを行わずにDBのデータを即座に返す（高速化）。

2.  **AI解析 (Gemini Analysis):**
    * キャッシュがない、または `refresh=true` の場合、Gemini API にプロンプトを送信。
    * プロンプトの役割: 「熟練の音楽キュレーター」として、ターゲットアーティストの音楽性（ジャンル、ムード、楽器構成、ボーカルスタイル）を深く分析し、音楽的に最も関連性の高いアーティストを10組選出する。
    * **選定ガイドライン:**
        * **音楽的類似性 (Vibes & Sound) 最優先:** 単なるジャンル一致ではなく、「雰囲気が似ている」「ファン層が重なる」アーティストを選定。
        * **文脈の整合性:** 同名の別アーティストとの混同を防ぐため、活動年代・国・シーン（例: 90s UK Rock, Japanese City Pop）を考慮。
        * **多様性:** 定番のフォロワーだけでなく、「隠れた名アーティスト（Underrated）」や意外性のある（しかし音楽的に繋がりのある）アーティストを包含。
        * **除外ルール:** 名前が似ているだけ、あるいは全く異なるジャンルのアーティストは絶対に含めない。
    * **推薦理由の品質:** 「〜のようなギターサウンド」「〜に通じる哀愁」など、音楽的な特徴に触れた具体的な理由を記述させる。
    * 応答形式: JSON配列（名前、推薦理由）。

3.  **データ補完 (Spotify Enrichment):**
    * Gemini が返したアーティスト名リストをループ処理する。
    * 各アーティストについて Spotify Search API をコールし、正確な `id`, `image_url`, `genres`, `spotify_url` を取得する。

4.  **データ永続化 (Persistence):**
    * **Artists Table:** 取得したアーティスト情報を `artists` テーブルに `UPSERT`（なければ挿入、あれば更新）。
    * **Related Table:** 起点アーティストと推薦アーティストのペアを `related_artists` テーブルに保存。この際、Geminiが生成した `reason`（推薦理由）も保存する。

5.  **レスポンス:**
    * 保存された最新のアーティストリスト（画像付き）をフロントエンドに返却する。

## 5. 出力・結果 (Outputs / Post-conditions)
* **UI変化:**
    * ローディングインジケータ（Spinning Icon）が表示される。
    * 完了後、アーティストカードのリストが更新表示される（画像、名前、推薦理由、Spotifyリンク）。
* **データ変化:**
    * `artists` テーブルに新規アーティストが増える。
    * `related_artists` テーブルに関連性が記録される（グラフ構造の構築）。

## 6. 例外処理 (Error Handling / Edge Cases)
* **Gemini API エラー:**
    * AIからの応答が不正なJSONだった場合、エラーログを出力し、Spotifyの `Get Related Artists` API をフォールバックとして使用する（※将来実装予定）か、空リストを返してUIに「見つかりませんでした」と表示する。
* **Spotify API 429 (Rate Limit):**
    * 短時間に大量の検索を行った場合、一時的に処理を中断し、取得できた分だけを返す。
* **アーティスト特定不能:**
    * Geminiが架空のバンド名を返した場合、Spotify検索でヒットしないため、その結果は静かに破棄（Skip）し、DBには保存しない。