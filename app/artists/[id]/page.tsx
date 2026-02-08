import { supabase } from '@/lib/supabase'
import ArtistDetailView from '@/components/ArtistDetailView'
import { notFound } from 'next/navigation'

export default async function ArtistDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: artistId } = await params

    // 1. アーティスト情報を取得
    const { data: artist, error } = await supabase
        .from('artists')
        .select('*')
        .eq('id', artistId)
        .single()

    if (error || !artist) {
        return notFound()
    }

    // 2. 関連アーティストと「理由」を取得
    const { data: relatedData } = await supabase
        .from('related_artists')
        .select(`
            target_artist_id,
            reason,
            artists:target_artist_id (
                id,
                name,
                image_url,
                genres
            )
        `)
        .eq('source_artist_id', artistId)

    // データ整形
    const relatedArtists = relatedData
        ?.map((r: any) => ({
            ...r.artists,
            reason: r.reason
        }))
        .filter((a: any) => a && a.id) || []

    return (
        <ArtistDetailView
            artist={artist}
            relatedArtists={relatedArtists}
            artistId={artistId}
        />
    )
}
