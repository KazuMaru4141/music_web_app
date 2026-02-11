# FUNC-004: 再生状態の同期と制御 (Now Playing & Control)

## 1. 機能概要 (Overview)
**機能ID:** FUNC-004
**名称:** 再生状態のリアルタイム同期と制御機能
**目的:** Spotifyで再生中の楽曲情報をアプリ上に表示し、再生・一時停止・スキップなどの操作を提供する。また、ポーリング（定期取得）により、スマホやPCなど他デバイスでの操作をアプリに反映させる。

## 2. 事前条件 (Pre-conditions)
* ユーザーがSpotify認証済みでログインしていること。
* ユーザーのいずれかのデバイス（スマホ、PC等）でSpotifyが起動していること（Active Deviceが存在すること）。

## 3. 入力・操作 (Inputs / Triggers)

### A. ユーザー操作 (UI Triggers)
* **再生/一時停止:** 画面下部中央の Play/Pause ボタンをクリック。
* **スキップ:** Next / Previous ボタンをクリック。
* **初期ロード:** ページ読み込み時 (`useEffect`)。

### B. システムトリガー (System Triggers)
* **ポーリング:** 15秒ごとに `pollTrack` 関数が自動実行される。
* **トラック変更検知:** ポーリングの結果、前回のトラックIDと異なる場合に詳細取得がトリガーされる。

## 4. 処理ロジック (Processing Logic)

### A. 再生情報の取得 (Polling Strategy)
1.  **軽量ポーリング (Lightweight Polling):**
    * 15秒間隔で `GET /api/player/now-playing?minimal=true` をコール。
    * Spotify API から現在再生中の曲を取得。
    * **判定:**
        * `is_playing` が前回と異なる → 再生状態アイコンを更新。
        * `item.id` (Track ID) が前回と同じ → 処理終了（無駄なDBアクセスを防ぐ）。
        * `item.id` が前回と異なる → **B. 詳細情報の取得** へ移行。

2.  **B. 詳細情報の取得 (Full Data Fetch):**
    * `GET /api/player/now-playing` (minimalなし) をコール。
    * サーバーサイドで以下の処理を並列実行 (`Promise.all`)：
        * Spotify: トラック詳細、アルバム収録曲、アーティスト情報、トップソング。
        * Last.fm: 再生回数 (Scrobble Counts) の取得。
        * Supabase: アルバム保存状態 (`is_album_saved`)、楽曲レート (`rating`) の取得。
    * **スコア計算:** アルバム内のトラック評価値から平均スコア (`album_score`) を算出。
    * クライアントの `track` ステートを更新し、画面全体を再描画。

### B. 再生制御 (Playback Control)
1.  **Optimistic UI (楽観的更新):**
    * Play/Pauseボタンが押された瞬間、APIレスポンスを待たずにUIのアイコンを切り替える（体感速度の向上）。
2.  **APIコール:**
    * `POST /api/player/control` に `{ action: 'play'|'pause'|'next'|'previous' }` を送信。
    * サーバー側で Active Device ID を特定し、Spotify API を実行。
    * 特定デバイスへの命令が失敗した場合、汎用的な再生コマンドへフォールバックする。
3.  **状態の再同期:**
    * 操作完了後、Spotify側の状態反映を待つため、意図的な遅延（Play/Pauseは1000ms、Skipは300ms）を置いてから **B. 詳細情報の取得** を再実行する。

## 5. 出力・結果 (Outputs / Post-conditions)
* **UI表示:**
    * アルバムアート、曲名、アーティスト名、各種バッジ（ジャンル、スコア）が表示される。
    * 再生プログレスバー（現状は数値のみ）やアイコンが更新される。
* **トースト通知:**
    * エラー時（デバイスが見つからない等）にアラートまたはトーストを表示。

## 6. 例外処理 (Error Handling / Edge Cases)
* **No Active Device (404):**
    * Spotifyがどの端末でも開かれていない場合、APIは 404 を返す。
    * UI側で「Spotifyを起動してください」等のメッセージを表示する（現状はアラート）。
* **Token Expired (401):**
    * アクセストークン切れの場合、サーバーサイドでリフレッシュトークンを使って再取得を試みる。
    * それでも失敗した場合はログイン画面へのリンクを表示する。
* **API Rate Limit (429):**
    * ポーリング間隔を15秒と長めに設定し、かつ変更がない場合は詳細取得をスキップすることで制限回避を図る。
* **Parallel Fetch Failure:**
    * Last.fm や Supabase の取得が失敗しても、メインのSpotify再生情報は表示できるよう、`Promise.all` 内で個別に `catch` して `null` を返す設計とする。