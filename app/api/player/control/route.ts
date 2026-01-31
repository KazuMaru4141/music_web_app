import { NextRequest, NextResponse } from 'next/server';
import spotifyApi from '@/lib/spotify';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
    try {
        const { action } = await req.json();
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

        // Get active device ID if possible
        const devices = await spotifyApi.getMyDevices();
        const activeDevice = devices.body.devices.find(d => d.is_active);
        const deviceId = activeDevice?.id ?? undefined;

        switch (action) {
            case 'play':
                try {
                    // Try targeting the active device first
                    await spotifyApi.play({ device_id: deviceId });
                } catch (e: any) {
                    console.warn('Play with deviceId failed, attempting generic play...', e.message);
                    // Fallback: Just try play() which resumes on the current session
                    await spotifyApi.play();
                }
                break;
            case 'pause':
                try {
                    await spotifyApi.pause({ device_id: deviceId });
                } catch (e: any) {
                    console.warn('Pause with deviceId failed, attempting generic pause...', e.message);
                    await spotifyApi.pause();
                }
                break;
            case 'next':
                await spotifyApi.skipToNext({ device_id: deviceId });
                break;
            case 'previous':
                await spotifyApi.skipToPrevious({ device_id: deviceId });
                break;
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Playback Control Error:', error);
        if (error.body) {
            console.error('Spotify Error Body:', JSON.stringify(error.body, null, 2));
        }

        // Handle Spotify specific error messages
        const message = error.message || '';
        const statusCode = error.statusCode || 500;

        if (statusCode === 403) {
            return NextResponse.json({
                error: 'Spotify action is restricted. 1. Access http://localhost:3000/api/auth/login to re-authenticate with correct scopes. 2. Ensure your Spotify is NOT in Private Session and a device is active.'
            }, { status: 403 });
        }

        if (statusCode === 404) {
            return NextResponse.json({
                error: 'No active Spotify device found. Please open Spotify on your phone or computer.'
            }, { status: 404 });
        }

        return NextResponse.json({ error: message || 'Failed to control playback' }, { status: statusCode });
    }
}
