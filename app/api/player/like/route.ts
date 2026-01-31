import { NextRequest, NextResponse } from 'next/server';
import spotifyApi from '@/lib/spotify';
import { saveLikedSong } from '@/lib/google-sheets';
import { cookies } from 'next/headers';

const PLAYLIST_ID = process.env.SPOTIFY_LIKED_PLAYLIST_ID!;

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { track, rating } = body;

        if (!track || !rating) {
            return NextResponse.json({ error: 'Missing track or rating' }, { status: 400 });
        }

        // Authenticate Spotify (needed to add to playlist)
        const cookieStore = await cookies();
        const accessToken = cookieStore.get('spotify_access_token')?.value;
        const refreshToken = cookieStore.get('spotify_refresh_token')?.value;

        if (accessToken) spotifyApi.setAccessToken(accessToken);
        else if (refreshToken) {
            // handle refresh if implemented properly in a middleware, for now assume valid or generic error
            spotifyApi.setRefreshToken(refreshToken);
            const data = await spotifyApi.refreshAccessToken();
            spotifyApi.setAccessToken(data.body.access_token);
        }

        // 1. Save to Google Sheet
        const sheetResult = await saveLikedSong(track, rating);

        // 2. Add to Spotify Playlist (Only if specifically added, i.e., new or user requested)
        // The Python logic adds to playlist only if it's a NEW entry in the sheet.
        // My saveLikedSong returns { status: 'added' | 'updated' }

        let spotifyResult = 'skipped';
        if (sheetResult.status === 'added') {
            try {
                await spotifyApi.addTracksToPlaylist(PLAYLIST_ID, [track.uri]);
                spotifyResult = 'added';
            } catch (e) {
                console.error("Failed to add to Spotify Playlist", e);
                spotifyResult = 'failed';
            }
        }

        return NextResponse.json({ success: true, sheet: sheetResult.status, spotify: spotifyResult });

    } catch (error) {
        console.error("Like API Error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
