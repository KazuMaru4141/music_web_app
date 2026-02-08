import { NextRequest, NextResponse } from 'next/server';
import { getRelatedArtists } from '@/lib/gemini';
import { saveRelatedArtists, ArtistRecommendation } from '@/lib/artist-service';
import { supabase } from '@/lib/supabase';
import spotifyApi from '@/lib/spotify'; // 追加
import { cookies } from 'next/headers'; // 追加

const MIN_RELATED_COUNT = 5;

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const artistName = searchParams.get('artist');
    const artistId = searchParams.get('artist_id'); // Source IDが必要

    if (!artistName) {
        return NextResponse.json({ error: 'Artist name is required' }, { status: 400 });
    }

    // ★追加: Spotify認証情報のセット（これがないと検索できません）
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
                // DBの形式をフロントエンド用に整形
                dbArtists = relatedData.map((r: any) => ({
                    name: r.artists?.name || 'Unknown',
                    reason: r.reason || '',
                    id: r.target_artist_id,
                    image: r.artists?.image_url, // 画像が表示可能に！
                    url: r.artists?.url
                }));
            }
        }

        // 2. DBに十分なデータがあればそれを返す（高速！）
        if (dbArtists.length >= MIN_RELATED_COUNT) {
            console.log(`DB hit for: ${artistName}`);
            return NextResponse.json({
                artists: dbArtists,
                source: 'database'
            });
        }

        // 3. DBになければGeminiから取得
        console.log(`Fetching related artists from Gemini for: ${artistName}`);
        const geminiArtists = await getRelatedArtists(artistName);

        // 4. バックグラウンドで保存（Spotify検索含む）
        // artistId（Source ID）がある場合のみ保存可能
        if (artistId && geminiArtists.length > 0) {
            // 既存のものと被らないようにフィルタリング（簡易的）
            const existingNames = new Set(dbArtists.map(a => a.name.toLowerCase()));
            const newArtists = geminiArtists.filter(a => !existingNames.has(a.name.toLowerCase()));

            if (newArtists.length > 0) {
                const recommendations: ArtistRecommendation[] = newArtists.map(a => ({
                    name: a.name,
                    reason: a.reason,
                    genres: []
                }));

                // 保存処理を実行 (awaitすることで確実に保存してからレスポンスを返すことも可能)
                // ユーザー体験のために非同期にするなら await を外してください
                await saveRelatedArtists(artistId, recommendations, supabase);
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
