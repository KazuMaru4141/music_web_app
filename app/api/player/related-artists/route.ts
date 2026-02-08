import { NextRequest, NextResponse } from 'next/server';
import { getRelatedArtists, RelatedArtist } from '@/lib/gemini';
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
        // 5. バックグラウンドで重複を除いて保存
        if (artistId && geminiArtists.length > 0) {
            const existingNames = new Set(dbArtists.map(a => a.name.toLowerCase()));
            const newArtists = geminiArtists.filter(a => !existingNames.has(a.name.toLowerCase()));

            if (newArtists.length > 0) {
                saveRelatedArtistsToDb(artistId, newArtists).catch(err => {
                    console.error('Background save error:', err);
                });
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

// DBに保存するヘルパー関数
async function saveRelatedArtistsToDb(sourceArtistId: string, artists: RelatedArtist[]) {
    console.log(`Saving ${artists.length} new related artists to DB for source: ${sourceArtistId}`);

    const savedArtists = [];

    for (const artist of artists) {
        // 既存アーティストを名前で検索
        const { data: existing } = await supabase
            .from('artists')
            .select('id')
            .eq('name', artist.name)
            .single();

        let targetId = existing?.id;

        if (!targetId) {
            // 存在しなければ新規作成（IDを明示的に生成）
            const newId = crypto.randomUUID();
            const { data: newArtist, error } = await supabase
                .from('artists')
                .insert({ id: newId, name: artist.name })
                .select('id')
                .single();

            if (error) {
                console.error(`Error saving artist ${artist.name}:`, error);
                continue;
            }
            targetId = newArtist.id;
        }

        savedArtists.push({ id: targetId, reason: artist.reason });
    }

    // 中間テーブルに保存
    if (savedArtists.length > 0) {
        const relationsPayload = savedArtists.map((artist) => ({
            source_artist_id: sourceArtistId,
            target_artist_id: artist.id,
            reason: artist.reason,
        }));

        const { error: relationError } = await supabase
            .from('related_artists')
            .upsert(relationsPayload, {
                onConflict: 'source_artist_id, target_artist_id',
                ignoreDuplicates: true
            });

        if (relationError) {
            console.error('Error saving relations:', relationError);
        } else {
            console.log(`Successfully saved ${savedArtists.length} new related artists to DB`);
        }
    }
}
