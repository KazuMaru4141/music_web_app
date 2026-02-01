import { NextRequest, NextResponse } from 'next/server';
import spotifyApi from '@/lib/spotify';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
    try {
        const { uri } = await req.json();

        if (!uri) {
            return NextResponse.json({ error: 'Missing track URI' }, { status: 400 });
        }

        const cookieStore = await cookies();
        const accessToken = cookieStore.get('spotify_access_token')?.value;
        const refreshToken = cookieStore.get('spotify_refresh_token')?.value;

        if (accessToken) {
            spotifyApi.setAccessToken(accessToken);
        } else if (refreshToken) {
            spotifyApi.setRefreshToken(refreshToken);
            const data = await spotifyApi.refreshAccessToken();
            spotifyApi.setAccessToken(data.body.access_token);
        } else {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // Add track to queue
        await spotifyApi.addToQueue(uri);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Add to Queue Error:', error);

        const statusCode = error.statusCode || 500;
        const message = error.message || '';

        if (statusCode === 404) {
            return NextResponse.json({
                error: 'No active Spotify device found. Please open Spotify on your phone or computer.'
            }, { status: 404 });
        }

        return NextResponse.json({ error: message || 'Failed to add to queue' }, { status: statusCode });
    }
}
