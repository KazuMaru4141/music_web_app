import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Save or update a liked song in the songs table
 * Also saves all album tracks if provided
 */
export async function saveLikedSong(track: any, rating: number, albumTracks?: any[]) {
    const now = new Date().toISOString();
    const albumData = typeof track.album === 'object' ? track.album : null;
    const albumId = track.album_id || albumData?.id || '';

    // Check if track already exists
    const { data: existing } = await supabase
        .from('songs')
        .select('id')
        .eq('id', track.id)
        .single();

    if (existing) {
        // Update rating
        const { error } = await supabase
            .from('songs')
            .update({ rating, saved_at: now })
            .eq('id', track.id);

        if (error) throw error;

        // Save album tracks if provided (even on update)
        if (albumTracks && albumTracks.length > 0 && albumId) {
            await saveAlbumTracks(albumTracks, albumId);
        }

        // Update album score
        if (albumId) {
            await updateAlbumScore(albumId);
        }

        return { status: 'updated' };
    } else {
        // NEW SONG CASE

        // 1. First, ensure Album (and Artist) exists to satisfy Foreign Key constraints
        const albumName = albumData?.name || track.album;
        if (albumData && albumData.id) {
            await saveAlbumFromTrack(albumData, track);
        } else if (albumId) {
            await saveMinimalAlbum(albumId, albumName, track);
        }

        // 2. Insert new song
        const spotifyUrl = track.url || track.external_urls?.spotify || '';

        const { error } = await supabase
            .from('songs')
            .insert({
                id: track.id,
                album_id: albumId,
                title: track.name,
                url: spotifyUrl,
                rating,
                saved_at: now,
                created_at: now,
            });

        if (error) throw error;

        // 3. Save all other album tracks if provided
        if (albumTracks && albumTracks.length > 0 && albumId) {
            await saveAlbumTracks(albumTracks, albumId);
        }

        // 4. Update album score
        if (albumId) {
            await updateAlbumScore(albumId);
        }

        return { status: 'added' };
    }
}

/**
 * Save all tracks from an album to songs table (unrated tracks get rating = 0)
 */
async function saveAlbumTracks(albumTracks: any[], albumId: string) {
    const now = new Date().toISOString();

    for (const t of albumTracks) {
        // Check if track already exists
        const { data: existing } = await supabase
            .from('songs')
            .select('id')
            .eq('id', t.id)
            .single();

        if (!existing) {
            // Insert with rating = 0
            await supabase
                .from('songs')
                .insert({
                    id: t.id,
                    album_id: albumId,
                    title: t.name,
                    url: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`,
                    rating: 0,
                    saved_at: now,
                    created_at: now,
                });
        }
    }
}


/**
 * Calculate and update album score based on track ratings
 */
async function updateAlbumScore(albumId: string) {
    // Get album's total tracks count
    const { data: album } = await supabase
        .from('albums')
        .select('total_tracks')
        .eq('id', albumId)
        .single();

    if (!album || !album.total_tracks) return;

    // Get all rated tracks for this album
    const { data: tracks } = await supabase
        .from('songs')
        .select('rating')
        .eq('album_id', albumId);

    // Calculate score using the same logic as UI
    // Divide by total album tracks, not just rated tracks
    const trackPoints: Record<number, number> = { 1: 0, 2: 10, 3: 60, 4: 80, 5: 100 };
    let totalPoints = 0;
    (tracks || []).forEach(t => {
        totalPoints += trackPoints[t.rating] || 0;
    });
    const score = parseFloat((totalPoints / album.total_tracks).toFixed(1));

    // Update album score
    const { error } = await supabase
        .from('albums')
        .update({ score, saved_at: new Date().toISOString() })
        .eq('id', albumId);

    if (error) console.error('Album score update error:', error);
}

/**
 * Save album info extracted from a track object
 */
async function saveAlbumFromTrack(album: any, track: any) {
    const now = new Date().toISOString();
    const artist = album.artists?.[0] || track.artists?.[0];


    // Check if album already exists
    const { data: existing } = await supabase
        .from('albums')
        .select('id')
        .eq('id', album.id)
        .single();

    // Upsert artist first (if exists)
    if (artist) {
        const { data: existingArtist } = await supabase
            .from('artists')
            .select('id')
            .eq('id', artist.id)
            .single();

        const artistData: any = {
            id: artist.id,
            name: artist.name,
            url: artist.external_urls?.spotify || '',
        };
        if (!existingArtist) {
            artistData.created_at = now;
        }

        const { error: artistError } = await supabase
            .from('artists')
            .upsert(artistData, { onConflict: 'id' });

        if (artistError) console.error('Artist upsert error:', artistError);
    }

    // Build album data - only include created_at for new records
    const albumData: any = {
        id: album.id,
        artist_id: artist?.id || null,
        title: album.name,
        image_url: album.images?.[0]?.url || null,
        url: album.external_urls?.spotify || '',
        release_date: album.release_date || null,
        genre: null,
        type: album.album_type || album.type || null,
        total_tracks: album.total_tracks || null,
        album_popularity: album.popularity || null,
        is_featured: false,
        saved_at: now,
    };

    if (!existing) {
        albumData.created_at = now;
    }

    const { data, error } = await supabase
        .from('albums')
        .upsert(albumData, { onConflict: 'id' })
        .select();

    if (error) console.error('Album upsert error:', error);
}

/**
 * Save minimal album info when only flattened track data is available
 */
async function saveMinimalAlbum(albumId: string, albumName: string, track: any) {
    const now = new Date().toISOString();

    // Check if album exists
    const { data: existing } = await supabase
        .from('albums')
        .select('id')
        .eq('id', albumId)
        .single();

    if (!existing) {
        const artist = track.artists?.[0];
        const artistName = track.artist || artist?.name;
        const artistId = artist?.id;

        // Upsert artist if we have the info
        if (artistId && artistName) {
            const { error: artistError } = await supabase
                .from('artists')
                .upsert({
                    id: artistId,
                    name: artistName,
                    url: artist?.external_urls?.spotify || '',
                    created_at: now,
                }, { onConflict: 'id' });

            if (artistError) console.error('Artist upsert error:', artistError);
        }

        // Insert album with available info
        const { error } = await supabase
            .from('albums')
            .insert({
                id: albumId,
                artist_id: artistId || null,
                title: albumName,
                image_url: track.image || null,
                url: `https://open.spotify.com/album/${albumId}`,
                release_date: null,
                genre: null,
                type: null,
                total_tracks: null,
                album_popularity: null,
                is_featured: false,
                saved_at: now,
                created_at: now,
            });

        if (error) console.error('Minimal album insert error:', error);
    }
}

/**
 * Toggle album featured status (heart button clicked)
 */
export async function saveAlbum(album: any) {
    const now = new Date().toISOString();
    const artist = album.artists?.[0];

    // Check current album status
    const { data: existing } = await supabase
        .from('albums')
        .select('is_featured')
        .eq('id', album.id)
        .single();

    const newFeaturedStatus = existing ? !existing.is_featured : true;

    // Upsert artist first (if exists)
    if (artist) {
        const { data: existingArtist } = await supabase
            .from('artists')
            .select('id')
            .eq('id', artist.id)
            .single();

        const artistData: any = {
            id: artist.id,
            name: artist.name,
            url: artist.external_urls?.spotify || '',
        };
        if (!existingArtist) {
            artistData.created_at = now;
        }

        const { error: artistError } = await supabase
            .from('artists')
            .upsert(artistData, { onConflict: 'id' });

        if (artistError) console.error('Artist upsert error:', artistError);
    }

    // Build album data - only include created_at for new records
    const albumData: any = {
        id: album.id,
        artist_id: artist?.id || null,
        title: album.name,
        image_url: album.images?.[0]?.url || null,
        url: album.external_urls?.spotify || '',
        release_date: album.release_date || null,
        genre: (album.genres || []).join(', ') || null,
        type: album.album_type || album.type || null,
        total_tracks: album.total_tracks || null,
        album_popularity: album.popularity || null,
        is_featured: newFeaturedStatus,
        saved_at: now,
    };

    if (!existing) {
        albumData.created_at = now;
    }

    const { data, error } = await supabase
        .from('albums')
        .upsert(albumData, { onConflict: 'id' })
        .select();

    if (error) throw error;
    return { status: newFeaturedStatus ? 'featured' : 'unfeatured', is_featured: newFeaturedStatus };
}

/**
 * Get the rating for a specific track
 */
export async function getTrackRating(track: any, albumTracks?: any[]): Promise<number> {
    const { data, error } = await supabase
        .from('songs')
        .select('rating')
        .eq('id', track.id)
        .single();

    if (error || !data) {
        // Track not found -> Auto-add with default rating 3
        await saveLikedSong(track, 3, albumTracks);
        return 3;
    }

    // Rating 0 means unrated -> treat as default 3 and update DB
    if (data.rating === 0) {
        await saveLikedSong(track, 3, albumTracks);
        return 3;
    }

    return data.rating;
}

/**
 * Get ratings for multiple tracks at once
 */
export async function getAlbumTrackRatings(trackIds: string[]): Promise<Record<string, number>> {
    const { data, error } = await supabase
        .from('songs')
        .select('id, rating')
        .in('id', trackIds);

    if (error) {
        console.error('Error fetching track ratings:', error);
        return {};
    }

    const result: Record<string, number> = {};
    trackIds.forEach(id => {
        const found = data?.find(row => row.id === id);
        result[id] = found?.rating || 0;
    });

    return result;
}

/**
 * Check if an album is featured (saved with heart)
 */
export async function checkIfAlbumSaved(albumId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('albums')
        .select('is_featured')
        .eq('id', albumId)
        .single();

    return !error && data?.is_featured === true;
}
