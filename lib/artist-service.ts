import { SupabaseClient } from '@supabase/supabase-js'
import spotifyApi from '@/lib/spotify' // Spotify APIを追加

// Geminiからの返り値の型定義
export interface ArtistRecommendation {
    name: string
    reason: string
    genres?: string[]
}

/**
 * 関連アーティストをDBに保存する共通関数
 * Spotify IDを優先して使用します
 */
export async function saveRelatedArtists(
    sourceArtistId: string,
    recommendations: ArtistRecommendation[],
    supabase: SupabaseClient
) {
    console.log(`Saving ${recommendations.length} artists to DB...`)
    const savedArtists = []

    for (const rec of recommendations) {
        // 1. まずDBに存在するか確認（名前で検索）
        const { data: existing } = await supabase
            .from('artists')
            .select('id')
            .eq('name', rec.name)
            .single()

        let targetId = existing?.id

        // 2. DBになければ、Spotifyで検索してIDを取得する
        if (!targetId) {
            try {
                // Spotify APIで検索 (1件だけ取得)
                // ※呼び出し元でアクセストークンがセットされている前提
                const searchRes = await spotifyApi.searchArtists(rec.name, { limit: 1 })
                const hit = searchRes.body.artists?.items[0]

                if (hit) {
                    // ★ここが重要: UUIDではなくSpotify IDをそのまま `id` に使う
                    console.log(`Found in Spotify: ${rec.name} -> ${hit.id}`)

                    const { data: newArtist, error } = await supabase
                        .from('artists')
                        .upsert({
                            id: hit.id, // Spotify IDを主キーにする
                            name: hit.name,
                            url: hit.external_urls.spotify,
                            image_url: hit.images[0]?.url, // 画像も自動で保存！
                            genres: hit.genres || rec.genres || [],
                        })
                        .select('id')
                        .single()

                    if (!error && newArtist) {
                        targetId = newArtist.id
                    } else {
                        console.error(`Error upserting artist ${rec.name}:`, error)
                    }
                } else {
                    // Spotifyでも見つからない場合（レアケース）
                    console.warn(`Not found in Spotify: ${rec.name}. Using UUID.`)
                    const newId = crypto.randomUUID()
                    const { data: newArtist, error } = await supabase
                        .from('artists')
                        .insert({
                            id: newId,
                            name: rec.name,
                            genres: rec.genres || [],
                        })
                        .select('id')
                        .single()

                    if (!error && newArtist) targetId = newArtist.id
                }
            } catch (e) {
                console.error(`Spotify search failed for ${rec.name}:`, e)
            }
        }

        // 3. IDが確定したらリストに追加
        if (targetId) {
            savedArtists.push({ ...rec, id: targetId })
        }
    }

    // 4. 中間テーブル（関連性）に保存
    if (savedArtists.length > 0) {
        const relationsPayload = savedArtists.map((artist) => ({
            source_artist_id: sourceArtistId,
            target_artist_id: artist.id,
            reason: artist.reason,
        }))

        // 重複を無視して保存 (onConflict)
        const { error } = await supabase
            .from('related_artists')
            .upsert(relationsPayload, {
                onConflict: 'source_artist_id, target_artist_id',
                ignoreDuplicates: true
            })

        if (error) {
            console.error('Relation save error:', error)
        } else {
            console.log(`Successfully saved ${savedArtists.length} related artists`)
        }
    }

    return savedArtists
}

// 互換性のために残す場合（使用しないなら削除可）
export async function fetchAndSaveRelatedArtists(
    sourceArtistName: string,
    sourceArtistId: string,
    supabase: SupabaseClient,
    getRelatedArtistsFn: (name: string) => Promise<ArtistRecommendation[]>
) {
    const recommendations = await getRelatedArtistsFn(sourceArtistName)
    return await saveRelatedArtists(sourceArtistId, recommendations, supabase)
}
