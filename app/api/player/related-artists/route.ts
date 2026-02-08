import { NextRequest, NextResponse } from 'next/server';
import { getRelatedArtists } from '@/lib/gemini';
import { saveRelatedArtists, ArtistRecommendation } from '@/lib/artist-service';
import { supabase } from '@/lib/supabase';

const MIN_RELATED_COUNT = 5; // 最低限表示したい件数

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const artistName = searchParams.get('artist');
    const artistId = searchParams.get('artist_id');

    if (!artistName) {
        return NextResponse.json({ error: 'Artist name is required' }, { status: 400 });
    }

    try {
        // 1. まずDBから関連アーティストを取得（artist_idがある場合）
        let dbArtists: any[] = [];
        if (artistId) {
            const { data: relatedData } = await supabase
                .from('related_artists')
                .select(`
                    target_artist_id,
                    reason,
                    artists:target_artist_id (
                        id,
                        name,
                        genres
                    )
                `)
                .eq('source_artist_id', artistId);

            if (relatedData && relatedData.length > 0) {
                dbArtists = relatedData.map((r: any) => ({
                    name: r.artists?.name || 'Unknown',
                    reason: r.reason || '',
                    id: r.target_artist_id
                }));
            }
        }

        // 2. DBに十分なデータがあれば返す（5件以上）
        if (dbArtists.length >= MIN_RELATED_COUNT) {
            console.log(`DB hit for: ${artistName} (${dbArtists.length} artists)`);
            return NextResponse.json({
                artists: dbArtists,
                source: 'database'
            });
        }

        // 3. DBにない、または足りない場合はGeminiから取得
        console.log(`Fetching related artists from Gemini for: ${artistName}`);
        const geminiArtists = await getRelatedArtists(artistName);

        // 4. Gemini結果を表示用に返す（常に5件表示）
        // 5. バックグラウンドで重複を除いて保存（共通関数を使用）
        if (artistId && geminiArtists.length > 0) {
            const existingNames = new Set(dbArtists.map(a => a.name.toLowerCase()));
            const newArtists = geminiArtists.filter(a => !existingNames.has(a.name.toLowerCase()));

            if (newArtists.length > 0) {
                // 共通の保存関数を使用
                const recommendations: ArtistRecommendation[] = newArtists.map(a => ({
                    name: a.name,
                    reason: a.reason,
                    genres: []
                }));

                saveRelatedArtists(artistId, recommendations, supabase)
                    .then(() => console.log('Background save complete'))
                    .catch(err => console.error('Background save failed:', err));
            }
        }

        return NextResponse.json({
            artists: geminiArtists,
            source: 'gemini'
        });
    } catch (error) {
        console.error('Error fetching related artists:', error);
        return NextResponse.json(
            { error: 'Failed to fetch related artists' },
            { status: 500 }
        );
    }
}
