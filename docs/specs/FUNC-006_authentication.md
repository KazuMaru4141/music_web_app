# FUNC-006: 認証とセッション管理 (Authentication & Session)

## 1. 機能概要 (Overview)
**機能ID:** FUNC-006
**名称:** Spotify OAuth 認証およびセッション管理機能
**目的:** ユーザーのSpotifyアカウントと連携し、APIアクセスに必要なアクセストークンを安全に管理・更新する。これにより、アプリ内での再生制御やライブラリ操作を可能にする。

## 2. 事前条件 (Pre-conditions)
* Spotify Developer Dashboard にてアプリが登録され、`CLIENT_ID`, `CLIENT_SECRET`, `REDIRECT_URI` が環境変数に設定されていること。
* ユーザーがSpotifyアカウントを所持していること。

## 3. 入力・操作 (Inputs / Triggers)

### A. ログイン開始
* **UIトリガー:** トップ画面またはログイン画面の「Login with Spotify」ボタンをクリック。
* **エンドポイント:** `GET /api/auth/login`

### B. コールバック処理
* **トリガー:** Spotify認証画面での承認後、自動的にリダイレクトされる。
* **エンドポイント:** `GET /api/auth/callback`
* **パラメータ:** `code` (Authorization Code), `state` (CSRF対策用文字列)

## 4. 処理ロジック (Processing Logic)

### A. ログインフロー (Login Flow)
1.  **リダイレクト生成:**
    * `spotify-web-api-node` ライブラリを使用し、必要なスコープ（`user-read-playback-state` 等）を含んだ認証URLを生成する。
    * ユーザーをSpotifyの認証画面へリダイレクトする。

### B. コールバック・トークン取得 (Token Exchange)
1.  **コード検証:**
    * URLクエリパラメータから `code` を取得。存在しない場合はエラーを返す。
2.  **トークン交換:**
    * `spotifyApi.authorizationCodeGrant(code)` を実行し、Spotifyサーバーから `access_token` と `refresh_token` を取得する。
3.  **セッション保存 (Cookie):**
    * 取得したトークンを `NextResponse` の `cookies` に保存する。
    * **設定:**
        * `httpOnly: true` (XSS対策: JSからアクセス不可)
        * `secure: true` (本番環境のみ)
        * `path: '/'`
        * `maxAge`: `access_token` は `expires_in` (通常1時間)、`refresh_token` はより長く設定。
4.  **リダイレクト:**
    * 処理完了後、トップページ (`/`) へリダイレクトする。

### C. トークンリフレッシュ (Token Refresh) - *Middleware / API Side*
* **検知:** 各APIルート（例: `now-playing`）で、Spotify API呼び出しが `401 Unauthorized` を返した場合、またはCookieの期限切れを検知した場合。
* **更新処理:**
    * Cookieから `refresh_token` を読み出す。
    * `spotifyApi.refreshAccessToken()` を実行。
    * 新しい `access_token` を取得し、Cookieを上書き保存する。
    * 元のリクエストを再試行する。

## 5. 出力・結果 (Outputs / Post-conditions)
* **Cookie:** ブラウザに `spotify_access_token`, `spotify_refresh_token` が保存される。
* **画面遷移:** 未認証ユーザーはSpotifyログイン画面へ、認証済みユーザーはアプリのメイン画面へ遷移する。

## 6. 例外処理 (Error Handling / Edge Cases)
* **認証拒否 (Access Denied):**
    * ユーザーがSpotify画面で「キャンセル」を押した場合、コールバックURLに `error` パラメータが付与される。この場合、ログイン画面に戻し「認証がキャンセルされました」と表示する。
* **リフレッシュトークン失効:**
    * 長期間アクセスがなくリフレッシュトークンも無効になった場合、強制的にログアウト処理（Cookie削除）を行い、ログイン画面へリダイレクトさせる。
* **State不一致:**
    * CSRF攻撃の可能性があるため、送出した `state` と戻ってきた `state` が一致しない場合は処理を中断しエラーとする（※現状の実装では簡易化のため省略されているが、本番運用では必須）。