import { NextRequest, NextResponse } from 'next/server';
import spotifyApi from '@/lib/spotify';
import { getUserPlayCounts } from '@/lib/lastfm';
import { getTrackRating, getAlbumTrackRatings, checkIfAlbumSaved } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('spotify_access_token')?.value;
    const refreshToken = cookieStore.get('spotify_refresh_token')?.value;

    const { searchParams } = new URL(req.url);
    const minimal = searchParams.get('minimal') === 'true';

    if (!accessToken && !refreshToken) {
        return NextResponse.json({ is_playing: false, message: 'Not authenticated' }, { status: 401 });
    }
    if (accessToken) spotifyApi.setAccessToken(accessToken);
    if (refreshToken) spotifyApi.setRefreshToken(refreshToken);

    try {
        if (!accessToken && refreshToken) {
            const data = await spotifyApi.refreshAccessToken();
            spotifyApi.setAccessToken(data.body.access_token);
        }

        const currentTrack = await spotifyApi.getMyCurrentPlayingTrack();

        if (!currentTrack.body || !currentTrack.body.item) {
            return NextResponse.json({ is_playing: false });
        }

        const item = currentTrack.body.item as SpotifyApi.TrackObjectFull;

        if (minimal) {
            return NextResponse.json({
                id: item.id,
                name: item.name,
                artist: item.artists[0].name,
                album: item.album.name,
                album_id: item.album.id,
                image: item.album.images[0]?.url,
                is_playing: currentTrack.body.is_playing,
                progress_ms: currentTrack.body.progress_ms,
                duration_ms: item.duration_ms,
            });
        }

        // --- 並列処理 ---

        // 1. 依存関係のないリクエストを定義
        const artistPromise = spotifyApi.getArtist(item.artists[0].id)
            .catch(e => { console.error('Spotify Artist Error', e); return null; });

        const lastFmPromise = getUserPlayCounts(item.artists[0].name, item.album.name, item.name)
            .catch(e => { console.error('LastFM Error', e); return null; });

        const albumTracksPromise = spotifyApi.getAlbumTracks(item.album.id)
            .catch(e => { console.error('Spotify Album Tracks Error', e); return null; });

        const isAlbumSavedPromise = checkIfAlbumSaved(item.album.id)
            .catch(e => { console.error('DB Saved Check Error', e); return false; });

        const topTracksPromise = spotifyApi.getArtistTopTracks(item.artists[0].id, 'JP')
            .catch(e => { console.error('Spotify Top Tracks Error', e); return null; });

        const artistAlbumsPromise = spotifyApi.getArtistAlbums(item.artists[0].id, { include_groups: 'album', limit: 10, country: 'JP' })
            .catch(e => { console.error('Spotify Artist Albums Error', e); return null; });

        // 2. 一斉にスタート！
        const [
            artistData,
            stats,
            albumRes,
            isAlbumSaved,
            topTracksRes,
            albumsRes
        ] = await Promise.all([
            artistPromise,
            lastFmPromise,
            albumTracksPromise,
            isAlbumSavedPromise,
            topTracksPromise,
            artistAlbumsPromise
        ]);

        // 3. 取得したデータを使って計算
        const genres = artistData?.body?.genres || [];

        const albumTracks = albumRes?.body?.items || [];
        const albumTrackIds = albumTracks.map(t => t.id);

        // レーティング取得（Supabaseへのアクセスをまとめる）
        // エラーが発生しても再生画面は表示できるようにする
        const [rating, albumRatings] = await Promise.all([
            getTrackRating(item, albumTracks).catch(e => {
                console.error('Failed to get/save track rating:', e);
                return 3; // Default to 3 if failed (New default)
            }),
            getAlbumTrackRatings(albumTrackIds).catch(e => {
                console.error('Failed to get album ratings:', e);
                return {}; // Default to empty object
            })
        ]);

        // Force update the current track's rating in the album list to match the authoritative rating
        // This fixes the race condition where getAlbumTrackRatings might return 0 before getTrackRating auto-saves 3
        if (item.id) {
            albumRatings[item.id] = rating;
        }

        const albumTracksWithRatings = albumTracks.map(t => ({
            id: t.id,
            name: t.name,
            uri: t.uri,
            rating: (albumRatings as Record<string, number>)[t.id] || 0
        }));

        // スコア計算
        const trackPoints: Record<number, number> = { 1: 0, 2: 10, 3: 60, 4: 80, 5: 100 };
        let totalPoints = 0;
        albumTracksWithRatings.forEach(t => {
            totalPoints += trackPoints[t.rating] || 0;
        });
        const albumScore = albumTracks.length > 0 ? (totalPoints / albumTracks.length) : 0;

        // 整形
        const topTracks = topTracksRes?.body?.tracks.slice(0, 5).map(t => ({
            id: t.id,
            name: t.name,
            uri: t.uri,
            album_name: t.album.name,
            album_image: t.album.images[0]?.url,
            popularity: t.popularity
        })) || [];

        const artistAlbums = albumsRes?.body?.items.map((a: SpotifyApi.AlbumObjectSimplified) => ({
            id: a.id,
            name: a.name,
            image: a.images[0]?.url,
            release_date: a.release_date,
            total_tracks: a.total_tracks
        })) || [];

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
            album_id: item.album.id,
            release_date: item.album.release_date,
            duration_ms: item.duration_ms,
            progress_ms: currentTrack.body.progress_ms,
            is_playing: currentTrack.body.is_playing,
            stats: stats,
            rating: rating,
            genre: genres.length > 0 ? genres[0] : 'Unknown',
            album_tracks: albumTracksWithRatings,
            album_score: parseFloat(albumScore.toFixed(1)),
            is_album_saved: isAlbumSaved,
            top_tracks: topTracks,
            artist_albums: artistAlbums
        };

        return NextResponse.json(trackData);

    } catch (error) {
        console.error("Error fetching current track:", error);
        return NextResponse.json({ is_playing: false, error: 'Failed to fetch' }, { status: 500 });
    }
}
