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

## 4. 処理ロジック (Processing Logic)

### A. 楽曲評価フロー (Rate Logic)
1.  **Spotify認証 & データ補完:**