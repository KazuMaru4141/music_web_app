# ADR 0001: StreamlitからNext.js (TypeScript) への移行によるアプリケーション基盤の刷新

## Status
Accepted

## Context
本プロジェクトの初期開発フェーズ（PoC: Proof of Concept）では、Pythonのみで迅速に構築可能な **Streamlit** を採用していた。しかし、アプリケーションの用途が「データの可視化」から「インタラクティブな音楽レーティングアプリ」へと移行するにつれて、以下の技術的制約がブロッキング要素（阻害要因）となっていた。

1. **同期処理によるUXの低下 (Interaction Latency)**
   Streamlitはユーザーの操作ごとにスクリプト全体をサーバー側で再実行するアーキテクチャである。そのため、楽曲のレーティングを行うたびに画面全体の再描画（リロード）が発生し、数秒の待ち時間が生じていた。これは「次々に曲を聴いて評価する」というアプリのコア体験を著しく損なうものであった。

2. **UI/UXカスタマイズの限界**
   モバイル利用を前提とした際、Streamlitの標準ウィジェットではボタン配置や情報の密度（Density）を自由に制御できない。特にスマートフォンでの片手操作（スワイプや親指範囲内のタップ）に最適化されたUIを構築することが困難であった。

## Decision
アプリケーションフレームワークを **Next.js (React)** に変更し、言語を **TypeScript** へと移行する。
また、スタイリングには **Tailwind CSS** を採用する。

## Consequences
### Positive (メリット)
* **非同期処理によるUX向上**: Reactのクライアントサイドレンダリング（SPA的な挙動）により、レーティング送信などの処理をバックグラウンドで行えるようになった。これにより画面リロードなしで即座に次の曲へ遷移でき、シームレスな操作体験が実現した。
* **モバイルファーストなUI設計**: コンポーネント単位でDOM構造やスタイルを完全に制御できるため、スマートフォン画面においても情報密度が高く、かつ操作しやすいUI（Bottom NavigationやFloating Action Button等）を実装可能になった。
* **フルスタック機能の統合**: Next.jsのAPI Routes（Route Handlers）を利用することで、フロントエンドとバックエンド（Spotify API/Supabase連携）を単一のプロジェクトで型安全に管理できるようになった。

### Negative (デメリット・コスト)
* **開発・学習コストの増大**: Python単一言語での開発から、TypeScript, React, JSX, CSS (Tailwind) といったWeb標準技術スタックへの習得・実装コストが発生する。
* **状態管理の複雑化**: StreamlitのシンプルなSession Stateと比較し、ReactのState管理（Props drillingの回避、Server/Client Componentの分離など）には高度な設計が求められる。

## References
* [Next.js Documentation](https://nextjs.org/docs)
* [Streamlit Architecture](https://docs.streamlit.io/get-started/fundamentals/main-concepts)