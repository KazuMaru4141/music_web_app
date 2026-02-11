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
* **UIトリガー:**
    * `NowPlaying` または `ArtistDetail` 画面で「Dig Deeper（更新）」ボタンをクリック。
    * または、初回アクセス時に自動実行。
* **入力パラメータ (API: `GET /api/player/related-artists`):**
    * `artist`: アーティスト名 (string, 必須)
    * `artist_id`: Spotify Artist ID (string, 任意)
    * `refresh`: 強制更新フラグ (boolean, 文字列 "true" で指定)

## 4. 処理ロジック (Processing Logic)
1.  **キャッシュ確認 (Cache Strategy):**
    * `refresh=false` の場合、まず Supabase の `related_artists` テーブルを確認する。
    * 既存の関連データが閾値（例: 10件）以上あれば、APIコールを行わずにDBのデータを即座に返す（高速化）。

2.  **AI解析 (Gemini Analysis):**
    * キャッシュがない、または `refresh=true` の場合、Gemini API にプロンプトを送信。
    * プロンプト: 「${artistName}に音楽的に似ているアーティストを10組挙げてください」
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