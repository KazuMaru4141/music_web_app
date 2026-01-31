import { NextRequest, NextResponse } from 'next/server';
import spotifyApi from '@/lib/spotify';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
    const url = req.nextUrl;
    const code = url.searchParams.get('code');

    if (!code) {
        return NextResponse.json({ error: 'No code provided' }, { status: 400 });
    }

    try {
        const data = await spotifyApi.authorizationCodeGrant(code);
        const { access_token, refresh_token, expires_in } = data.body;

        // Set tokens in cookies
        const cookieStore = await cookies();

        cookieStore.set('spotify_access_token', access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: expires_in,
            path: '/',
        });

        if (refresh_token) {
            cookieStore.set('spotify_refresh_token', refresh_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                path: '/',
            });
        }

        // Redirect to home
        return NextResponse.redirect(new URL('/', req.url));

    } catch (error) {
        console.error('Error getting tokens:', error);
        return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
    }
}
