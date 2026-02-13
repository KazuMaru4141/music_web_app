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

#### C-1. 採用する入力方式

**`Alt + 1〜5`** (Mac: `Option + 1〜5`) を本機能の入力方式として採用する。

| 操作 | 動作 |
|---|---|
| `Alt + 1` | ★1 を付与 |
| `Alt + 2` | ★2 を付与 |
| `Alt + 3` | ★3 を付与 |
| `Alt + 4` | ★4 を付与 |
| `Alt + 5` | ★5 を付与 |

**採用理由:**
- ブラウザの標準キーボードショートカットと競合しない
- 記号入力（`!` `"` `#` `$` `%` 等）と競合しない（`Shift + 数字` の問題を回避）
- 修飾キー (`Alt`) を必要とするため、意図しない誤操作のリスクが低い

#### C-1a. 不採用とした入力方式と理由

| 方式 | 不採用理由 |
|---|---|
| `Shift + 1〜5` | 一般的なキーボード配列で `Shift + 1〜5` は `!` `"` `#` `$` `%` 等の記号入力に対応する。ガード条件で `<input>` 等を除外しても、カスタムエディタやフォーカス外の状態で記号を入力しようとした際に、意図せず評価が実行される誤操作リスクが高い。特に Auto-Next 有効時は曲がスキップされる事故に直結する。 |
| `Ctrl + 1〜5` (Mac: `Cmd + 1〜5`) | Chrome / Edge / Firefox において `Ctrl+1〜9` はタブ切り替えに予約されており、`preventDefault()` でもブラウザネイティブ動作を抑制できない。OS・ブラウザの組み合わせによって挙動が異なるため、UXの一貫性を担保できない。 |
| `1〜5` (修飾キーなし) | 操作は最もシンプルだが、将来的にキーボードショートカットを拡張する際に競合するリスクがある。また、修飾キーがないため意図しないキー押下で評価が確定してしまう誤操作リスクが高い。 |

#### C-2. ガード条件 (Guard Conditions)
以下の条件に該当する場合、キーイベントを**無視**する（評価処理を実行しない）:

| 条件 | 判定方法 | 理由 |
|---|---|---|
| テキスト入力中 | `e.target.tagName === 'INPUT'` | 検索ボックス等への文字入力と誤認防止 |
| テキストエリア入力中 | `e.target.tagName === 'TEXTAREA'` | メモ・コメント入力との競合防止 |
| `contentEditable` 要素 | `e.target.isContentEditable === true` | リッチテキスト編集との競合防止 |
| キーリピート | `e.repeat === true` | キー押しっぱなし時にOSが連続送信するイベントを無視し、多重評価を防止 |
| 処理中ロック | `isProcessingRef.current === true` | 前回の評価処理（API通信・Auto-Nextスキップ含む）が完了するまで次の入力を受け付けない |

#### C-3. 処理フロー (Processing Flow)
1. `window` の `keydown` イベントを検知する。
2. ガード条件（C-2）を評価し、該当すれば処理を中断する。
3. 押下キーが `1`〜`5` の数字であることを検証する。
4. `Alt` (Mac: `Option`) キーが押下されていることを判定する。
5. `isProcessingRef` のロックを取得し、処理中フラグを `true` に設定する。
6. 条件合致時、`handleRate(ratingValue)` を呼び出す（セクション A と同一フロー）。
7. **Optimistic UI:** API レスポンスを待たずに星アイコンの表示を即座に更新する。
8. Auto-Next 有効時は API 完了後 500ms 待機してからスキップを実行する。
9. 全処理完了後、500ms の遅延を置いて `isProcessingRef` のロックを解除する。

#### C-4. 実装上の依存関係・注意点 (Implementation Notes)

| 項目 | 詳細 |
|---|---|
| **依存配列** | `useEffect` の依存配列に `handleRate` を含める。 |
| **パフォーマンス最適化** | `handleRate` を `useCallback` でメモ化し、不要なイベントリスナーの再登録を抑制する。さらに `track` や `autoNext` 等の頻繁に更新されるステートは `useRef` 経由で参照し、リスナーの再登録を最小限に抑える。 |
| **クリーンアップ** | `useEffect` の return 文で `removeEventListener` を必ず実行し、メモリリークを防止する。 |
| **ブラウザ互換性** | `e.key` プロパティを使用（`e.keyCode` は非推奨）。`e.altKey` で修飾キー判定を行う。主要ブラウザ (Chrome, Edge, Firefox, Safari) で動作確認済みであること。 |
| **連打防止 (Processing Lock)** | `isProcessingRef` (`useRef<boolean>`) により、評価処理の開始時にロックを取得し、全処理完了後 500ms の遅延を置いて解除する。ロック中の `handleRate` 呼び出しは即座に `return` する。 |
| **キーリピート防止** | `e.repeat` プロパティを検査し、キー押しっぱなしによる連続イベント発火を無視する。これにより OS のキーリピート設定に依存した多重実行を防止する。 |
| **Auto-Next 挙動** | キーボードショートカットによる評価時も Auto-Next 設定に従う。スキップは `await` で待機してから実行し、処理中ロックと組み合わせることで重複スキップを防止する。トースト通知に「Skipping...」等のメッセージを明記し、ユーザーが次に何が起きるか理解できるようにする。 |
| **視覚フィードバック** | キーボード操作は「押した感」がないため、評価確定時に星アイコンを一瞬拡大するアニメーション（Flash Effect）を追加し、操作の視認性を向上させる。 |

### D. キーボードショートカットによるアルバム保存 (Keyboard Shortcut Save Album)
* **UIトリガー:** `NowPlaying` 画面表示中に、キーボードの `Alt + S` を押下。
* **API:** アルバム保存（セクション B）と同一のエンドポイント `POST /api/player/save-album` を使用。
* **対象コンポーネント:** `components/NowPlaying.tsx`
* **実装方式:** セクション C と共通の `useEffect` + `window.addEventListener('keydown', ...)` によるグローバルキーイベントリスナー内に処理を追加。

#### D-1. 採用する入力方式

**`Alt + S`** (Mac: `Option + S`) を本機能の入力方式として採用する。

| 操作 | 動作 |
|---|---|
| `Alt + S` | アルバムを保存（トグル）。保存済みの場合は保存解除。 |

**採用理由:**
- `S` = **S**ave の頭文字であり直感的に理解できる
- `Alt` 修飾キーとの組み合わせで既存ショートカット（`Alt + 1〜5`）と体系が統一される
- ブラウザの標準キーボードショートカットと競合しない

#### D-2. ガード条件 (Guard Conditions)
セクション C-2 と同一のガード条件を適用する（テキスト入力中、キーリピート等）。
ただし、Processing Lock (`isProcessingRef`) は不要（Save 処理は独立しており、連打しても副作用は限定的）。

#### D-3. 処理フロー (Processing Flow)
1. `window` の `keydown` イベントを検知する。
2. ガード条件（D-2）を評価し、該当すれば処理を中断する。
3. `e.altKey === true` かつ `e.key === 's'` または `e.key === 'S'` であることを検証する。
4. `e.preventDefault()` でブラウザのデフォルト動作（ファイル保存ダイアログ等）を抑止する。
5. `handleSaveAlbum()` を呼び出す。内部で `trackRef.current` から最新のトラック情報を取得する。
6. API レスポンスに基づき、`track.is_album_saved` ステートを更新する。
7. 結果に応じたトースト通知を表示する:
    * 保存時: `"Album Saved! ❤️"`
    * 解除時: `"Album Removed 💔"`

#### D-4. 実装上の依存関係・注意点 (Implementation Notes)

| 項目 | 詳細 |
|---|---|
| **`useCallback` メモ化** | `handleSaveAlbum` を `useCallback` でメモ化し、`useEffect` の依存配列に安定した参照を含める。 |
| **`trackRef` 経由の状態参照** | `handleSaveAlbum` 内ではクロージャの `track` ではなく `trackRef.current` を使用し、最新のトラック情報を安全に参照する。これにより `useCallback` の依存配列を空にでき、リスナーの再登録を抑制する。 |
| **トグル動作** | 同一のショートカットで保存/解除を切り替える。APIの返却値 `data.is_featured` で現在の状態を判定する。 |
| **依存配列** | `useEffect` の依存配列に `handleSaveAlbum` を追加する（`handleRate`, `fetchRelatedArtists` と並列）。 |

## 4. 処理ロジック (Processing Logic)

### A. 楽曲評価フロー (Rate Logic)
1.  **Spotify認証 & データ補完:**