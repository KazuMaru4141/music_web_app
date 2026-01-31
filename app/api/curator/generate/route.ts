import { NextRequest, NextResponse } from 'next/server';
import { generateRecommendations, RecommendationParams } from '@/lib/gemini';
import spotifyApi from '@/lib/spotify';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
    try {
        const body: RecommendationParams = await req.json();

        // Auth Setup for Spotify Enrichment
        const cookieStore = await cookies();
        const accessToken = cookieStore.get('spotify_access_token')?.value;
        const refreshToken = cookieStore.get('spotify_refresh_token')?.value;

        if (accessToken) {
            spotifyApi.setAccessToken(accessToken);
        } else if (refreshToken) {
            spotifyApi.setRefreshToken(refreshToken);
            try {
                const data = await spotifyApi.refreshAccessToken();
                spotifyApi.setAccessToken(data.body.access_token);
            } catch (e) {
                console.warn("Failed to refresh token in curator", e);
            }
        }

        // Basic validation
        if (!body.genre) {
            return NextResponse.json({ error: 'Genre is required' }, { status: 400 });
        }

        // Call Gemini Logic
        const recommendations = await generateRecommendations({
            genre: body.genre,
            melancholy: body.melancholy || 50,
            energy: body.energy || 50,
            obscurity: body.obscurity || 50
        });

        return NextResponse.json({ success: true, data: recommendations });

    } catch (error: any) {
        console.error("Curator API Error:", error);
        return NextResponse.json({
            error: 'Failed to generate recommendations',
            details: error.message
        }, { status: 500 });
    }
}
