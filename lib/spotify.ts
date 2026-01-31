import SpotifyWebApi from 'spotify-web-api-node';

const scopes = [
    'user-read-private',
    'user-read-email',
    'user-read-playback-state',
    'user-modify-playback-state',
    'user-read-currently-playing',
    'user-read-recently-played',
    'playlist-modify-public',
    'playlist-modify-private',
    'playlist-read-private',
    'playlist-read-collaborative',
].join(',');

const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI,
});

export const LOGIN_URL = spotifyApi.createAuthorizeURL(scopes.split(','), 'state');

export default spotifyApi;

// Helper interfaces
export interface SpotifyTrack {
    id: string;
    name: string;
    artist: string;
    album: string;
    image: string;
    uri: string;
    url: string;
    duration_ms: number;
    progress_ms?: number;
    is_playing?: boolean;
}
