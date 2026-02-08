import { SupabaseClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Gemini APIの初期化
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)

// 共通のインターフェース（exportして他でも使えるように）
export interface ArtistRecommendation {
    name: string
    reason: string
    genres?: string[]
}

/**
 * 関連アーティストをDBに保存する共通関数
 * Geminiの結果やその他のソースから渡されたリストを保存
 */
export async function saveRelatedArtists(
    sourceArtistId: string,
    recommendations: ArtistRecommendation[],
    supabase: SupabaseClient
) {
    console.log(`Saving ${recommendations.length} artists to DB...`)
    const savedArtists = []

    for (const rec of recommendations) {
        // 1. アーティストの存在確認（名前で検索）
        const { data: existing } = await supabase
            .from('artists')
            .select('id')
            .eq('name', rec.name)
            .single()

        let targetId = existing?.id

        if (!targetId) {
            // 2. 新規作成（IDを明示的に生成）
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

            if (error) {
                console.error(`Error saving artist ${rec.name}:`, error)
                continue
            }
            targetId = newArtist.id
        }

        savedArtists.push({ ...rec, id: targetId })
    }

    // 3. 中間テーブルに保存
    if (savedArtists.length > 0) {
        const relationsPayload = savedArtists.map((artist) => ({
            source_artist_id: sourceArtistId,
            target_artist_id: artist.id,
            reason: artist.reason,
        }))

        const { error } = await supabase
            .from('related_artists')
            .upsert(relationsPayload, {
                onConflict: 'source_artist_id, target_artist_id',
                ignoreDuplicates: true
            })

        if (error) {
            console.error('Relation save error:', error)
        } else {
            console.log(`Successfully saved ${savedArtists.length} related artists to DB`)
        }
    }

    return savedArtists
}

/**
 * 指定したアーティストの関連アーティストをGemini APIから取得し、
 * artistsテーブルとrelated_artistsテーブルに保存する関数
 */
export async function fetchAndSaveRelatedArtists(
    sourceArtistName: string,
    sourceArtistId: string,
    supabase: SupabaseClient
) {
    console.log(`Fetching related artists for: ${sourceArtistName} via Gemini`)

    try {
        // 1. Geminiモデルの取得
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

        // 2. プロンプトの作成
        const prompt = `
      あなたは音楽の専門家です。
      アーティスト「${sourceArtistName}」に音楽性が似ている、またはファン層が重なるアーティストを10組挙げてください。
      
      出力は以下のJSON形式のみを返してください。余計な説明は不要です。
      
      [
        {
          "name": "アーティスト名",
          "reason": "なぜ似ているかの簡潔な理由（30文字以内）",
          "genres": ["ジャンル1", "ジャンル2"]
        }
      ]
    `

        // 3. AI生成の実行
        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text()

        // JSON部分だけを抽出・パース
        const jsonString = text.replace(/```json|```/g, '').trim()
        const recommendations: ArtistRecommendation[] = JSON.parse(jsonString)

        if (!recommendations || recommendations.length === 0) {
            console.log('No recommendations found.')
            return []
        }

        // 4. 共通の保存関数を使用
        return await saveRelatedArtists(sourceArtistId, recommendations, supabase)

    } catch (error) {
        console.error('Gemini API Error:', error)
        throw new Error('Failed to fetch related artists from Gemini')
    }
}
