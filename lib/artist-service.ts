import { SupabaseClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Gemini APIの初期化
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)

interface ArtistRecommendation {
    name: string
    reason: string
    genres: string[]
}

/**
 * 指定したアーティストの関連アーティストをGemini APIから取得し、
 * artistsテーブルとrelated_artistsテーブルに保存する関数
 */
export async function fetchAndSaveRelatedArtists(
    sourceArtistName: string, // IDではなく名前を受け取るように変更
    sourceArtistId: string,   // DB保存用にIDも受け取る
    supabase: SupabaseClient
) {
    console.log(`Fetching related artists for: ${sourceArtistName} via Gemini`)

    try {
        // 1. Geminiモデルの取得
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

        // 2. プロンプトの作成 (JSONで返すように指示)
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

        // JSON部分だけを抽出・パース (Markdownのコードブロック除去)
        const jsonString = text.replace(/```json|```/g, '').trim()
        const recommendations: ArtistRecommendation[] = JSON.parse(jsonString)

        if (!recommendations || recommendations.length === 0) {
            console.log('No recommendations found.')
            return []
        }

        // 4. 保存処理 (アーティスト情報の保存)
        const savedArtists = []

        for (const rec of recommendations) {
            // 既に同じ名前のアーティストがいるか確認
            const { data: existing } = await supabase
                .from('artists')
                .select('id')
                .eq('name', rec.name)
                .single()

            let targetId = existing?.id

            if (!targetId) {
                // 存在しなければ新規作成
                const { data: newArtist, error } = await supabase
                    .from('artists')
                    .insert({
                        name: rec.name,
                        genres: rec.genres,
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

        // 5. 中間テーブル `related_artists` に関係性を保存
        const relationsPayload = savedArtists.map((artist) => ({
            source_artist_id: sourceArtistId,
            target_artist_id: artist.id,
            reason: artist.reason,
        }))

        const { error: relationError } = await supabase
            .from('related_artists')
            .upsert(relationsPayload, {
                onConflict: 'source_artist_id, target_artist_id',
                ignoreDuplicates: true
            })

        if (relationError) throw relationError

        console.log(`Successfully saved ${savedArtists.length} related artists via Gemini.`)
        return savedArtists

    } catch (error) {
        console.error('Gemini API Error:', error)
        throw new Error('Failed to fetch related artists from Gemini')
    }
}
