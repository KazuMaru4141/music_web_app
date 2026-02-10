sequenceDiagram
    autonumber
    actor User as User (Browser)
    participant API as API (Next.js)
    participant DB as Supabase
    participant Gemini as Gemini API
    participant Spotify as Spotify API

    Note over User, API: ユーザーが「Dig Deeper」ボタンをクリック<br>または関連タブを開く

    User->>API: GET /related-artists?artist=TheUsed&refresh=true/false
    
    %% 1. DB確認 (Cache Check) - rectでグループ化
    rect rgb(240, 248, 255)
        Note right of API: Cache Check (DB確認)
        API->>DB: SELECT related_artists WHERE source_id = ...
        DB-->>API: 既存データ (Cached Data)
    end

    alt 十分なデータがある AND refresh=false
        API-->>User: DBのデータを返却 (Source: database)
    
    else データ不足 OR refresh=true
        Note right of API: Cache Miss / Dig Deeper (新規開拓)

        %% 2. Gemini解析 (AI Analysis)
        API->>Gemini: generateContent("The Usedに似ているアーティストを10組教えて")
        Gemini-->>API: アーティスト名リスト (JSON)<br>["MCR", "Taking Back Sunday", ...]

        %% 3. 詳細データ補完と保存
        loop 各アーティストについて (saveRelatedArtists)
            
            %% 重複チェック
            API->>DB: SELECT artists WHERE name = ...
            DB-->>API: 結果 (存在するか?)

            opt DBに存在しない場合 (Data Missing)
                API->>Spotify: searchArtists(Name)
                Spotify-->>API: ID, ImageURL, Genres, SpotifyURL
                
                alt Spotifyで見つかった
                    API->>DB: UPSERT artists (Spotify ID, Image...)
                else 見つからない
                    API->>DB: INSERT artists (UUID...)
                end
            end

            %% 関連情報の保存
            API->>DB: UPSERT related_artists (Relation & Reason)
        end

        %% 4. 保存したデータの再取得
        API->>DB: SELECT related_artists (画像付きの最新データ)
        DB-->>API: リッチなアーティストリスト

        API-->>User: 最新データを返却 (Source: gemini)
    end