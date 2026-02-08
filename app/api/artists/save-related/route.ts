import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { saveRelatedArtists, ArtistRecommendation } from '@/lib/artist-service'
import { getRelatedArtists } from '@/lib/gemini'
import spotifyApi from '@/lib/spotify'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
    try {
        const { source_artist_id } = await req.json()

        if (!source_artist_id) {
            return NextResponse.json({ error: 'source_artist_id is required' }, { status: 400 })
        }

        // Spotify認証トークンをセット
        const cookieStore = await cookies()
        const accessToken = cookieStore.get('spotify_access_token')?.value
        if (accessToken) {
            spotifyApi.setAccessToken(accessToken)
        }

        // 1. ソースとなるアーティストの名前を取得
        const { data: sourceArtist } = await supabase
            .from('artists')
            .select('name')
            .eq('id', source_artist_id)
            .single()

        if (!sourceArtist) {
            return NextResponse.json({ error: 'Source artist not found' }, { status: 404 })
        }

        // 2. Geminiから関連アーティストを取得
        const geminiArtists = await getRelatedArtists(sourceArtist.name)

        // 3. 共通保存関数を使用
        const recommendations: ArtistRecommendation[] = geminiArtists.map(a => ({
            name: a.name,
            reason: a.reason,
            genres: []
        }))

        const savedArtists = await saveRelatedArtists(source_artist_id, recommendations, supabase)

        return NextResponse.json({
            success: true,
            count: savedArtists.length,
            data: savedArtists
        })

    } catch (error: any) {
        console.error('API Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
