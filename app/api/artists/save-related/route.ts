import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fetchAndSaveRelatedArtists } from '@/lib/artist-service'

export async function POST(req: NextRequest) {
    try {
        const { source_artist_id } = await req.json()

        if (!source_artist_id) {
            return NextResponse.json({ error: 'source_artist_id is required' }, { status: 400 })
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

        // 2. Geminiロジックの実行 (名前とIDを渡す)
        const savedArtists = await fetchAndSaveRelatedArtists(sourceArtist.name, source_artist_id, supabase)

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
