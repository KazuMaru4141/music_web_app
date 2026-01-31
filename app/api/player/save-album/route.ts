import { NextRequest, NextResponse } from 'next/server';
import { saveAlbum } from '@/lib/google-sheets';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { track } = body;

        if (!track) {
            return NextResponse.json({ error: 'Missing track info' }, { status: 400 });
        }

        // Authentication logic to get full album
        const { cookies } = await import('next/headers');
        const spotifyApi = (await import('@/lib/spotify')).default;
        const cookieStore = await cookies();
        const accessToken = cookieStore.get('spotify_access_token')?.value;
        if (accessToken) spotifyApi.setAccessToken(accessToken);

        const albumId = track.album_id;

        if (!albumId) {
            return NextResponse.json({ error: 'Missing Album ID' }, { status: 400 });
        }

        const albumData = await spotifyApi.getAlbum(albumId);
        const result = await saveAlbum(albumData.body);

        return NextResponse.json({ success: true, status: result.status });

    } catch (error) {
        console.error("Save Album API Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
