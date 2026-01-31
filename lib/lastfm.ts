const API_KEY = process.env.LASTFM_API_KEY!;
const USERNAME = process.env.LASTFM_USERNAME!;
const BASE_URL = 'http://ws.audioscrobbler.com/2.0/';

async function fetchLastFm(method: string, params: Record<string, string> = {}) {
    const url = new URL(BASE_URL);
    url.searchParams.append('method', method);
    url.searchParams.append('api_key', API_KEY);
    url.searchParams.append('user', USERNAME);
    url.searchParams.append('format', 'json');

    for (const [key, value] of Object.entries(params)) {
        url.searchParams.append(key, value);
    }

    const res = await fetch(url.toString());
    return res.json();
}

export async function getUserPlayCounts(artist?: string, album?: string, track?: string) {
    const stats = {
        artist: 0,
        album: 0,
        track: 0,
        today: 0, // Difficult to calculate accurately via simple API without iterating
        total: 0
    };

    try {
        // Overall
        const userInfo = await fetchLastFm('user.getinfo');
        stats.total = parseInt(userInfo.user?.playcount || '0');

        if (artist) {
            const artistInfo = await fetchLastFm('artist.getinfo', { artist, username: USERNAME });
            stats.artist = parseInt(artistInfo.artist?.stats?.userplaycount || '0');
        }

        if (artist && album) {
            const albumInfo = await fetchLastFm('album.getinfo', { artist, album, username: USERNAME });
            stats.album = parseInt(albumInfo.album?.userplaycount || '0');
        }

        if (artist && track) {
            const trackInfo = await fetchLastFm('track.getinfo', { artist, track, username: USERNAME });
            stats.track = parseInt(trackInfo.track?.userplaycount || '0');
        }

        // Calculate Today's Plays
        // Midnight of today in User's timezone? Or UTC? Last.fm uses UTC generally or user setting.
        // We will simple compare with local midnight roughly or UTC midnight.
        // Better: Use `from` timestamp.
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const fromTimestamp = Math.floor(now.getTime() / 1000).toString();

        const recent = await fetchLastFm('user.getrecenttracks', {
            limit: '200',
            from: fromTimestamp
        });

        stats.today = parseInt(recent.recenttracks?.['@attr']?.total || '0');

    } catch (e) {
        console.error("LastFM Error:", e);
    }

    return stats;
}
