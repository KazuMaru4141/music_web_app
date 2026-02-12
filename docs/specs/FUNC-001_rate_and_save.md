# FUNC-001: 楽曲評価と保存 (Rate & Save)

## 1. 機能概要 (Overview)
**機能ID:** FUNC-001
**名称:** 楽曲評価およびアルバム保存機能
**目的:** ユーザーが楽曲に対して定量的な評価（1〜5）を行い、お気に入りのアルバムをライブラリ（DB）に「特集（Featured）」として保存する。これにより、個人の音楽嗜好をデータベースに蓄積し、後の推薦アルゴリズムやプレイリスト生成の基盤データとする。

## 2. 事前条件 (Pre-conditions)
* ユーザーがアプリケーションにログインしていること（Spotify認証済み）。
* 操作対象の楽曲またはアルバムの情報（ID, URI等）がフロントエンドで取得できていること。
* 環境変数 `SPOTIFY_LIKED_PLAYLIST_ID` が設定されていること（評価曲をSpotifyプレイリストに追加するため）。

## 3. 入力・操作 (Inputs / Triggers)

### A. 楽曲評価 (Rate Song)
* **UIトリガー:** `NowPlaying` 画面の星型アイコン（1〜5）をクリック。
* **API:** `POST /api/player/like`
* **パラメータ (Body):**
    * `track`: 対象の楽曲オブジェクト (Spotify APIのTrack Object準拠、必須)
    * `rating`: 評価値 (1〜5の整数、必須)

### B. アルバム保存 (Feature Album)
* **UIトリガー:** `NowPlaying` またはアルバム詳細画面のハートアイコンをクリック。
* **API:** `POST /api/player/save-album`
* **パラメータ (Body):**
    * `track`: アルバムIDを含む楽曲オブジェクト、またはアルバム情報そのもの (必須: `track.album_id` または `track.album.id`)

### C. キーボードショートカットによる楽曲評価 (Keyboard Shortcut Rating)
* **UIトリガー:** `NowPlaying` 画面表示中に、キーボードのショートカットキーを押下。
* **API:** 楽曲評価（セクション A）と同一のエンドポイント `POST /api/player/like` を使用。
* **対象コンポーネント:** `components/NowPlaying.tsx`
* **実装方式:** `useEffect` + `window.addEventListener('keydown', ...)` によるグローバルキーイベントリスナー。

#### C-1. 入力パターン定義 (Input Patterns)

| パターン | 修飾キー | 入力キー | 採用判定 | 理由・リスク |
|---|---|---|---|---|
| **A** | `Ctrl` (Mac: `Cmd`) | `1`〜`5` | ❌ 非採用 (デフォルト無効) | Chrome / Edge / Firefox で `Ctrl+1〜9` がタブ切り替えに予約されている。`preventDefault()` ではブラウザネイティブ動作を抑制不可。UXの信頼性を担保できない。 |
| **B** | `Shift` | `1`〜`5` | ✅ 推奨 | ブラウザ標準ショートカットとの競合なし。修飾キー必須のため誤操作リスクが低い。 |
| **C** | なし | `1`〜`5` | ✅ 採用可 (シンプル) | 最も直感的。ただし将来のショートカット拡張時に競合する可能性を考慮する必要がある。 |

> **採用方針:** パターンB (`Shift + 1〜5`) をデフォルトとして採用する。パターンCは設定やコード変更で切り替え可能とする。パターンAはコード上にコメントアウトとして残し、将来の要件変更に備える。

#### C-2. ガード条件 (Guard Conditions)
以下の条件に該当する場合、キーイベントを**無視**する（評価処理を実行しない）:

| 条件 | 判定方法 | 理由 |
|---|---|---|
| テキスト入力中 | `e.target.tagName === 'INPUT'` | 検索ボックス等への文字入力と誤認防止 |
| テキストエリア入力中 | `e.target.tagName === 'TEXTAREA'` | メモ・コメント入力との競合防止 |
| `contentEditable` 要素 | `e.target.isContentEditable === true` | リッチテキスト編集との競合防止 |

#### C-3. 処理フロー (Processing Flow)
1. `window` の `keydown` イベントを検知する。
2. ガード条件（C-2）を評価し、該当すれば処理を中断する。
3. 押下キーが `1`〜`5` の数字であることを検証する。
4. 採用パターンに応じた修飾キーの有無を判定する。
5. 条件合致時、`handleRate(ratingValue)` を呼び出す（セクション A と同一フロー）。
6. **Optimistic UI:** API レスポンスを待たずに星アイコンの表示を即座に更新する。

#### C-4. 実装上の依存関係・注意点 (Implementation Notes)

| 項目 | 詳細 |
|---|---|
| **依存配列** | `useEffect` の依存配列に `handleRate` を含める。 |
| **パフォーマンス最適化** | `handleRate` を `useCallback` でメモ化し、不要なイベントリスナーの再登録を抑制する。 |
| **クリーンアップ** | `useEffect` の return 文で `removeEventListener` を必ず実行し、メモリリークを防止する。 |
| **ブラウザ互換性** | `e.key` プロパティを使用（`e.keyCode` は非推奨）。主要ブラウザ (Chrome, Edge, Firefox, Safari) で動作確認済みであること。 |

## 4. 処理ロジック (Processing Logic)

### A. 楽曲評価フロー (Rate Logic)
1.  **Spotify認証 & データ補完:**