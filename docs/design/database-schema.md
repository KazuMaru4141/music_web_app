erDiagram
    %% --- エンティティ定義 ---

    ARTISTS {
        string id PK "Spotify Artist ID"
        string name "アーティスト名"
        string image_url "画像URL"
        jsonb genres "ジャンル一覧 (JSONB)"
        geography origin "出身地 (PostGIS/緯度経度)"
        vector embedding "AI用ベクトルデータ (1536次元等)"
        timestamp created_at
    }

    ALBUMS {
        string id PK "Spotify Album ID"
        string artist_id FK "アーティストID"
        string title "アルバム名"
        string image_url
        date release_date "リリース日"
        int total_tracks
        boolean is_saved
        timestamp created_at
    }

    SONGS {
        string id PK "Spotify Track ID"
        string album_id FK "アルバムID"
        string artist_id FK "アーティストID"
        string title "曲名"
        string artist_name "アーティスト名 (検索用/非正規化)"
        string album_name "アルバム名 (検索用/非正規化)"
        string preview_url
        int duration_ms
        int rate "ユーザー評価 (1-5)"
        text comment "ユーザーの一言メモ"
        vector embedding "歌詞/雰囲気のベクトルデータ"
        timestamp created_at
    }

    RELATED_ARTISTS {
        bigint id PK "自動増分ID"
        string source_artist_id FK "元アーティストID"
        string target_artist_id FK "関連アーティストID"
        text reason "Geminiによる推薦理由"
        float similarity "類似度スコア (0.0-1.0)"
        timestamp created_at
    }

    %% --- リレーションシップ定義 ---

    ARTISTS ||--o{ ALBUMS : "releases"
    ALBUMS ||--o{ SONGS : "contains"
    ARTISTS ||--o{ SONGS : "performs"

    %% 関連アーティスト (自己結合)
    ARTISTS ||--o{ RELATED_ARTISTS : "source"
    ARTISTS ||--o{ RELATED_ARTISTS : "target"