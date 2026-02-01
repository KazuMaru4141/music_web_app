import { NextRequest, NextResponse } from 'next/server';
import spotifyApi, { SpotifyTrack } from '@/lib/spotify';
import { getUserPlayCounts } from '@/lib/lastfm';
import { getTrackRating, getAlbumTrackRatings, checkIfAlbumSaved } from '@/lib/google-sheets';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('spotify_access_token')?.value;
    const refreshToken = cookieStore.get('spotify_refresh_token')?.value;

    if (!accessToken && !refreshToken) {
        return NextResponse.json({ is_playing: false, message: 'Not authenticated' }, { status: 401 });
    }

    // Set tokens
    if (accessToken) spotifyApi.setAccessToken(accessToken);
    if (refreshToken) spotifyApi.setRefreshToken(refreshToken);

    try {
        // Refresh token if needed (simplistic check, ideally handled via middleware or interceptor)
        if (!accessToken && refreshToken) {
            const data = await spotifyApi.refreshAccessToken();
            spotifyApi.setAccessToken(data.body.access_token);
            // Note: We should ideally update the cookie here too, but Next.js Route Handlers
            // require setting cookies on the Response object explicitly.
        }

        const currentTrack = await spotifyApi.getMyCurrentPlayingTrack();

        if (!currentTrack.body || !currentTrack.body.item) {
            return NextResponse.json({ is_playing: false });
        }

        const item = currentTrack.body.item as SpotifyApi.TrackObjectFull;

        // Fetch Artist for Genres (Track objects don't have them, Artist objects do)
        const artistData = await spotifyApi.getArtist(item.artists[0].id);
        const genres = artistData.body.genres;

        // Fetch Last.fm stats
        const stats = await getUserPlayCounts(
            item.artists[0].name,
            item.album.name,
            item.name
        );

        const rating = await getTrackRating(item);

        // Fetch Album Tracks
        const albumRes = await spotifyApi.getAlbumTracks(item.album.id);
        const albumTracks = albumRes.body.items;
        const albumTrackIds = albumTracks.map(t => t.id);

        // Fetch Ratings for all tracks in album
        const albumRatings = await getAlbumTrackRatings(albumTrackIds);

        const albumTracksWithRatings = albumTracks.map(t => ({
            id: t.id,
            name: t.name,
            uri: t.uri,
            rating: albumRatings[t.id] || 0
        }));

        // Calculate Album Score (Streamlit Logic)
        const trackPoints: Record<number, number> = { 1: 0, 2: 10, 3: 60, 4: 80, 5: 100 };
        let totalPoints = 0;
        albumTracksWithRatings.forEach(t => {
            totalPoints += trackPoints[t.rating] || 0;
        });
        const albumScore = albumTracks.length > 0 ? (totalPoints / albumTracks.length) : 0;

        // Check if album is saved
        const isAlbumSaved = await checkIfAlbumSaved(item.album.id);

        const trackData = {
            id: item.id,
            name: item.name,
            artist: item.artists[0].name,
            artist_url: item.artists[0].external_urls.spotify,
            album: item.album.name,
            album_url: item.album.external_urls.spotify,
            album_type: item.album.album_type,
            image: item.album.images[0]?.url,
            uri: item.uri,
            url: item.external_urls.spotify,
            album_id: item.album.id, // Added for Save Album
            duration_ms: item.duration_ms,
            progress_ms: currentTrack.body.progress_ms,
            is_playing: currentTrack.body.is_playing,
            stats: stats,
            rating: rating,
            genre: genres.length > 0 ? genres[0] : 'Unknown',
            album_tracks: albumTracksWithRatings,
            album_score: parseFloat(albumScore.toFixed(1)),
            is_album_saved: isAlbumSaved
        };

        return NextResponse.json(trackData);

    } catch (error) {
        console.error("Error fetching current track:", error);
        return NextResponse.json({ is_playing: false, error: 'Failed to fetch' }, { status: 500 });
    }
}
