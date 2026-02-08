import { supabase } from '@/lib/supabase'
import SaveRelatedButton from '@/components/SaveRelatedButton'
import Link from 'next/link'

export default async function ArtistDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: artistId } = await params

    // 1. アーティスト情報を取得 (DBに存在する場合)
    const { data: artist } = await supabase
        .from('artists')
        .select('*')
        .eq('id', artistId)
        .single()

    // 2. 既に関連付けられているアーティストを取得
    const { data: relatedData } = await supabase
        .from('related_artists')
        .select(`
      target_artist_id,
      artists:target_artist_id (
        id,
        name,
        image_url,
        genres
      )
    `)
        .eq('source_artist_id', artistId)

    // データ整形 (型をあわせる)
    const relatedArtists = relatedData?.map((r: any) => r.artists) || []

    return (
        <div className="p-8 max-w-4xl mx-auto">
            {/* ヘッダー部分 */}
            <div className="flex items-center justify-between mb-8 border-b pb-4">
                <div>
                    <h1 className="text-3xl font-bold">{artist?.name || `ID: ${artistId}`}</h1>
                    {artist?.genres && (
                        <p className="text-gray-500 text-sm mt-1">{artist.genres.join(', ')}</p>
                    )}
                </div>

                {/* 保存ボタンコンポーネント */}
                <SaveRelatedButton artistId={artistId} />
            </div>

            {/* 関連アーティストリスト表示エリア */}
            <h2 className="text-xl font-semibold mb-4">
                🔗 関連アーティスト ({relatedArtists.length})
            </h2>

            {relatedArtists.length === 0 ? (
                <p className="text-gray-500">まだ関連データがありません。「保存」ボタンを押してください。</p>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {relatedArtists.map((relArtist: any) => (
                        <Link
                            key={relArtist.id}
                            href={`/artists/${relArtist.id}`}
                            className="block p-4 border rounded hover:bg-gray-50 transition"
                        >
                            <div className="font-bold">{relArtist.name}</div>
                            <div className="text-xs text-gray-500 truncate">
                                {relArtist.genres?.slice(0, 2).join(', ')}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}
