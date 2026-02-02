import { NextRequest, NextResponse } from 'next/server';
import { getRelatedArtists, RelatedArtist } from '@/lib/gemini';

// In-memory cache to minimize Gemini API calls
const cache = new Map<string, { artists: RelatedArtist[], timestamp: number }>();
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const artistName = searchParams.get('artist');

    if (!artistName) {
        return NextResponse.json({ error: 'Artist name is required' }, { status: 400 });
    }

    const cacheKey = artistName.toLowerCase().trim();

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`Cache hit for: ${artistName}`);
        return NextResponse.json({
            artists: cached.artists,
            cached: true
        });
    }

    try {
        // Fetch from Gemini
        console.log(`Fetching related artists from Gemini for: ${artistName}`);
        const artists = await getRelatedArtists(artistName);

        // Store in cache
        cache.set(cacheKey, { artists, timestamp: Date.now() });

        return NextResponse.json({
            artists,
            cached: false
        });
    } catch (error) {
        console.error('Error fetching related artists:', error);
        return NextResponse.json(
            { error: 'Failed to fetch related artists' },
            { status: 500 }
        );
    }
}
