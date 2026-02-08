import { NextRequest, NextResponse } from 'next/server';
import { getRelatedArtists } from '@/lib/gemini';
import { saveRelatedArtists, ArtistRecommendation } from '@/lib/artist-service';
import { supabase } from '@/lib/supabase';
import spotifyApi from '@/lib/spotify';
import { cookies } from 'next/headers';

const MIN_RELATED_COUNT = 5;

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const artistName = searchParams.get('artist');
    const artistId = searchParams.get('artist_id');
    // ★追加: 強制更新フラグを取得
    const forceRefresh = searchParams.get('refresh') === 'true';

    if (!artistName) {
        return NextResponse.json({ error: 'Artist name is required' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const accessToken = cookieStore.get('spotify_access_token')?.value;
    if (accessToken) {
        spotifyApi.setAccessToken(accessToken);
    } else {
        console.warn('No access token found, Spotify search might fail.');
    }

    try {
        // 1. まずDBから関連アーティストを取得
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
                        image_url, 
                        url
                    )
                `)
                .eq('source_artist_id', artistId);

            if (relatedData && relatedData.length > 0) {
                dbArtists = relatedData.map((r: any) => ({
                    name: r.artists?.name || 'Unknown',
                    reason: r.reason || '',
                    id: r.target_artist_id,
                    image: r.artists?.image_url,
                    url: r.artists?.url // Spotify URL
                }));
            }
        }

        // 2. DBに十分なデータがあり、かつ「更新」でなければそれを返す
        // ★修正: forceRefresh が false の場合のみキャッシュを返す
        if (!forceRefresh && dbArtists.length >= MIN_RELATED_COUNT) {
            console.log(`DB hit for: ${artistName}`);
            return NextResponse.json({
                artists: dbArtists,
                source: 'database'
            });
        }

        // 3. DBにない、または「更新」の場合はGeminiから取得
        console.log(`Fetching related artists from Gemini for: ${artistName} (Refresh: ${forceRefresh})`);

        const geminiArtists = await getRelatedArtists(artistName);

        // 4. Spotify検索して保存 → enrichedな結果（id, image, url付き）を取得
        let enrichedArtists: any[] = [];
        if (artistId && geminiArtists.length > 0) {
            // 既存のものと被らないようにフィルタリング
            const existingNames = new Set(dbArtists.map(a => a.name.toLowerCase()));
            const newArtists = geminiArtists.filter(a => !existingNames.has(a.name.toLowerCase()));

            if (newArtists.length > 0) {
                const recommendations: ArtistRecommendation[] = newArtists.map(a => ({
                    name: a.name,
                    reason: a.reason,
                    genres: []
                }));

                // ★重要: saveRelatedArtistsはSpotify検索済みのid付きリストを返す
                const savedArtists = await saveRelatedArtists(artistId, recommendations, supabase);

                // DB形式に変換（image, url取得のため再度DBから読み込む）
                const { data: freshData } = await supabase
                    .from('related_artists')
                    .select(`
                        target_artist_id,
                        reason,
                        artists:target_artist_id (
                            id,
                            name,
                            image_url,
                            url
                        )
                    `)
                    .eq('source_artist_id', artistId);

                if (freshData && freshData.length > 0) {
                    enrichedArtists = freshData.map((r: any) => ({
                        name: r.artists?.name || 'Unknown',
                        reason: r.reason || '',
                        id: r.target_artist_id,
                        image: r.artists?.image_url,
                        url: r.artists?.url
                    }));
                }
            }
        }

        // enrichedデータがあればそれを返す、なければ既存DB + Geminiの名前だけ
        const resultArtists = enrichedArtists.length > 0 ? enrichedArtists : [...dbArtists, ...geminiArtists];

        return NextResponse.json({
            artists: resultArtists,
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
