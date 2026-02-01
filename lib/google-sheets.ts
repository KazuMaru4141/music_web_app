import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Helper to get authenticated sheets client dynamically
async function getSheetsClient() {
    const key = process.env.GOOGLE_PRIVATE_KEY || '';

    // Clean key (remove start/end quotes if present, handle newlines)
    const cleanedKey = key
        .replace(/^['"]|['"]$/g, '')
        .replace(/\\n/g, '\n')
        .replace(/"/g, '');

    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            private_key: cleanedKey,
        },
        scopes: SCOPES,
    });

    return google.sheets({ version: 'v4', auth });
}

const SHEET_ID_LIKED = process.env.SHEET_ID_LIKED_SONGS!;
const SHEET_ID_ALBUMS = process.env.SHEET_ID_OLD_ALBUMS!;

// Sheet Names (Auto-detected from diagnostic)
const SHEET_NAME_LIKED = 'シート1'; // ID: 0, Standard default
const SHEET_NAME_ALBUMS = 'シート1 '; // ID: 376641996, Note the trailing space!

export async function saveLikedSong(track: any, rating: number) {
    const today = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Check if already exists (Simplified logic: always append for now or need read first)
    // For efficiency in serverless, ideally we append. unique check requires reading column.

    // Reading Track IDs (Column F -> index 5)
    const sheets = await getSheetsClient();
    const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID_LIKED,
        range: `${SHEET_NAME_LIKED}!F:F`,
    });

    const trackIds = readRes.data.values?.flat() || [];
    const rowIndex = trackIds.indexOf(track.id);

    if (rowIndex !== -1) {
        // Update existing
        // Row is rowIndex + 1 (1-based)
        // Rating is Column I -> index 8
        const range = `${SHEET_NAME_LIKED}!I${rowIndex + 1}`;
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID_LIKED,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[rating.toString()]] },
        });
        return { status: 'updated' };
    } else {
        // Append new
        // Handle both full Spotify Track object and our flattened frontend TrackData
        const albumName = typeof track.album === 'string' ? track.album : track.album.name;
        // In frontend data 'artist' is string, in Spotify 'artists' is array
        const artistName = track.artist || track.artists?.[0]?.name || '';
        const imageUrl = track.image || track.album?.images?.[0]?.url || '';
        const spotifyUrl = track.url || track.external_urls?.spotify || '';
        const albumId = track.album_id || track.album?.id || '';

        const values = [[
            today,
            track.name,
            albumName,
            artistName,
            imageUrl,
            track.id,
            "", // Source
            spotifyUrl,
            rating.toString(),
            albumId
        ]];

        await sheets.spreadsheets.values.append({
            spreadsheetId: SHEET_ID_LIKED,
            range: `${SHEET_NAME_LIKED}!A:A`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values },
        });
        return { status: 'added' };
    }
}

export async function saveAlbum(album: any) {
    const today = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Read Album IDs (Column G -> index 6)
    const sheets = await getSheetsClient();
    const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID_ALBUMS,
        range: `${SHEET_NAME_ALBUMS}!G:G`,
    });

    const albumIds = readRes.data.values?.flat() || [];
    const rowIndex = albumIds.indexOf(album.id);

    if (rowIndex !== -1) {
        // Update Featured to TRUE (Column W -> index 22)
        const range = `${SHEET_NAME_ALBUMS}!W${rowIndex + 1}`;
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID_ALBUMS,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [['TRUE']] },
        });
        return { status: 'updated' };
    } else {
        // Append
        const values = [[
            today,
            "", // User?
            album.name,
            album.artists[0].name,
            album.images[0]?.url || '',
            "", // Artist Img (Need extra fetch usually)
            album.id,
            album.external_urls.spotify,
            album.artists[0].id,
            "", // Artist URL
            album.total_tracks,
            0, 0, "", "",
            album.popularity || 0,
            "",
            album.album_type,
            album.release_date,
            (album.genres || []).join(', '),
            "", "", "TRUE" // Featured
        ]];

        await sheets.spreadsheets.values.append({
            spreadsheetId: SHEET_ID_ALBUMS,
            range: `${SHEET_NAME_ALBUMS}!A:A`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values },
        });
        return { status: 'added' };
    }
}

export async function getTrackRating(track: any): Promise<number> {
    const sheets = await getSheetsClient();

    // Read Track IDs (Col F) to find the row
    const idRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID_LIKED,
        range: `${SHEET_NAME_LIKED}!F:F`,
    });

    const trackIds = idRes.data.values?.flat() || [];
    const rowIndex = trackIds.indexOf(track.id);

    if (rowIndex === -1) {
        // Track not found -> Auto-add with default rating 3
        console.log(`[AutoSave] Track ${track.id} not found. Adding with rating 3.`);
        await saveLikedSong(track, 3);
        return 3;
    }

    // Read Rating (Col I) at that specific row
    // Row is 1-based, so index + 1
    const ratingRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID_LIKED,
        range: `${SHEET_NAME_LIKED}!I${rowIndex + 1}`,
    });

    const ratingStr = ratingRes.data.values?.[0]?.[0];
    return ratingStr ? parseInt(ratingStr, 10) : 0;
}

export async function getAlbumTrackRatings(trackIds: string[]): Promise<Record<string, number>> {
    const sheets = await getSheetsClient();

    // Read all Track IDs (Col F) and Ratings (Col I)
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID_LIKED,
        range: `${SHEET_NAME_LIKED}!F:I`,
    });

    const rows = res.data.values || [];
    const ratingsMap: Record<string, number> = {};

    // Create a map of all rated songs for quick lookup
    rows.forEach(row => {
        const id = row[0]; // Col F (Relative to start of range)
        const rating = row[3]; // Col I (Relative to start of range)
        if (id && rating) {
            ratingsMap[id] = parseInt(rating, 10);
        }
    });

    // Filter to only requested IDs (optional, but clean)
    const result: Record<string, number> = {};
    trackIds.forEach(id => {
        result[id] = ratingsMap[id] || 0;
    });

    return result;
}

export async function checkIfAlbumSaved(albumId: string): Promise<boolean> {
    const sheets = await getSheetsClient();
    const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID_ALBUMS,
        range: `${SHEET_NAME_ALBUMS}!G:G`,
    });

    const albumIds = readRes.data.values?.flat() || [];
    return albumIds.includes(albumId);
}
