# FUNC-005: AIキュレーター/コメント生成 (AI Curator)

## 1. 機能概要 (Overview)
**機能ID:** FUNC-005
**名称:** AI楽曲解説生成機能 (Curator Agent)
**目的:** 再生中の楽曲や特定のアーティストに対して、AI (Gemini) が音楽評論家のような視点で「聴きどころ」や「背景」を解説するテキストを生成する。これにより、ユーザーは楽曲への理解を深め、より豊かな音楽体験を得ることができる。

## 2. 事前条件 (Pre-conditions)
* ユーザーがアプリケーションを利用中であり、対象となる楽曲（トラック名、アーティスト名）が特定されていること。
* Google Gemini API のAPIキーがサーバー環境変数 (`GOOGLE_GEMINI_KEY`) に設定されていること。

## 3. 入力・操作 (Inputs / Triggers)

### A. 自動生成 (Auto Generation) - *Future Scope*
* **トリガー:** 楽曲再生開始時、または詳細ページ表示時。
* **条件:** DBに該当楽曲の解説キャッシュが存在しない場合のみ実行（コスト削減のため）。

### B. 手動生成 (Manual Generation) - *Current Implementation*
* **UIトリガー:** `Curator` コンポーネント（NowPlaying画面内）の "Ask Curator" や "Generate Commentary" ボタンをクリック。
* **入力パラメータ (API: `POST /api/curator/generate`):**
    * `artistName`: アーティスト名 (string, 必須)
    * `trackName`: 曲名 (string, 必須)
    * `context`: 追加のコンテキスト情報（例: アルバム名、ジャンルなど。任意）

## 4. 処理ロジック (Processing Logic)

1.  **リクエスト受信 & 検証:**
    * クライアントから送信された `artistName`, `trackName` が空でないか確認する。

2.  **プロンプト構築 (Prompt Engineering):**
    * 以下のテンプレートに基づき、Geminiへの指示を作成する。
    * **役割:** 「あなたは知識豊富な音楽評論家です。」
    * **タスク:** 「以下の曲について、その音楽的特徴、歌詞のテーマ、アーティストのキャリアにおける位置づけを簡潔に（200文字以内で）解説してください。」
    * **対象:** Artist: `${artistName}`, Track: `${trackName}`
    * **制約:** 「トーンは敬体（です・ます）で、情熱的かつ客観的に。」

3.  **AI生成実行 (Gemini API Call):**
    * `GoogleGenerativeAI` クライアントを使用し、`generateContent` メソッドを呼び出す。
    * エラー発生時（APIダウン、制限超過など）は、適切なエラーメッセージを返す。

4.  **レスポンス整形:**
    * AIからの応答テキストから不要な記号（Markdownのコードブロック等）を除去し、プレーンテキストまたは整形済みHTMLとしてクライアントに返す。

5.  **キャッシュ/保存 (Future Improvement):**
    * *現状は都度生成だが、将来的には生成結果を `liner_notes` または `songs` テーブルの `commentary` カラムに保存し、次回以降はDBから取得するロジックを追加すべきである。*

## 5. 出力・結果 (Outputs / Post-conditions)
* **UI表示:**
    * 生成中はローディングアニメーション（「AIが考え中...」など）を表示。
    * 完了後、テキストエリアや吹き出しコンポーネントに解説文が表示される。
* **データ:**
    * （現状）特になし（オンメモリ）。
    * （将来）DBに解説文が永続化される。

## 6. 例外処理 (Error Handling / Edge Cases)
* **API Quota Exceeded:**
    * Gemini APIの無料枠制限等に達した場合、503 または 429 エラーを返し、UI側で「現在キュレーターは休憩中です（アクセス集中）」等のメッセージを表示する。
* **Inappropriate Content:**
    * AIが不適切な内容（Safety Filterに引っかかる等）を生成した場合、生成を拒否し、汎用的なエラーメッセージを返す。
* **Unknown Song:**
    * AIが曲を知らない（ハルシネーションの可能性）場合、「申し訳ありません、この曲に関する詳細な情報は持ち合わせていません。」といった当たり障りのない回答を返すよう、プロンプトで制御（または事後チェック）する。