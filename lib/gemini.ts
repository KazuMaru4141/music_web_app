import { GoogleGenerativeAI } from '@google/generative-ai';
import spotifyApi from './spotify';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// Genre Prompts Configuration
export const GENRE_PROMPTS: Record<string, { description: string; mood: string }> = {
    "DeepDive_PowerPop": {
        "description": "Fountains of WayneやWeezerのような、歪んだギターとキャッチーなメロディ、切ないハーモニーを持つパワーポップ。",
        "mood": "Energetic, Catchy, Melodic"
    },
    "DeepDive_MellowPop": {
        "description": "夜に聴きたくなるような、落ち着いたテンポで美しいメロディを持つポップス。アコースティックとエレクトロニカの融合。",
        "mood": "Chill, Emotional, Night drive"
    },
    "DeepDive_BeautifulEmo": {
        "description": "美しい旋律と感情的なボーカルが特徴のエモ・ロック。激しさよりも美しさを重視。",
        "mood": "Emotional, Beautiful, Rock"
    },
    "DeepDive_Dance": {
        "description": "歌モノのハウスミュージックや、メロディアスなダンスミュージック。",
        "mood": "Dance, Melodic House, Groovy"
    },
    "DeepDive_JanglePop": {
        "description": "Belle and SebastianやCamera Obscuraのように、ストリングスや管楽器を取り入れた室内楽的（Chamber Pop）な上品さと、Sunwichのような陽だまりのような温かさを併せ持つギターポップ。Rickenbackerのクリーントーン。",
        "mood": "Sunny, Twee, Orchestral Pop, Nostalgic"
    },
    "DeepDive_IndieRock": {
        "description": "Death Cab for Cutieのように、内省的で文学的な歌詞と、クリーンなギターのアルペジオが美しく絡み合うロック。派手さよりも、楽曲の構成美や感情の揺れ動きを重視したサウンド。",
        "mood": "Introspective, Storytelling, Clean Guitars, Melancholic"
    },
    "DeepDive_MelodicDeathMetal": {
        "description": "Children of Bodomのようなネオクラシカルで煌びやかなキーボードと速弾きギター、またはArch Enemyのような攻撃的だが一度聴いたら耳に残るキャッチーなギターリフを持つメロデス。叙情と暴虐の融合。",
        "mood": "Neoclassical, Technical, Aggressive but Catchy, Shredding"
    },
    "DeepDive_IndiePop": {
        "description": "ロックよりも「歌心」や「かわいらしさ」を重視したインディーサウンド。シンセサイザーやアコースティック楽器を使い、親しみやすくキャッチーなメロディ。",
        "mood": "Sweet, Catchy, Lo-fi"
    },
    "DeepDive_PopPunk": {
        "description": "3コード進行、速いテンポ、そして一度聴いたら忘れないキャッチーなサビ。青春感や疾走感のあるパンクロック。Green DayやBlink-182の系譜。",
        "mood": "High Energy, Youthful, Anthemic"
    },
    "DeepDive_MelodicHardcore": {
        "description": "ハードコア・パンクの疾走感に、泣きのメロディを乗せたスタイル。90年代のスケートパンクや、Hi-STANDARDのような哀愁のある速いパンク。",
        "mood": "Fast, Emotional, Skate Punk"
    },
    "DeepDive_ThrashMetal": {
        "description": "攻撃的なスピード、刻むギターリフ（ザクザク感）、複雑な展開が特徴のメタル。MetallicaやSlayerのルーツを感じさせつつ、鋭利なサウンド。",
        "mood": "Aggressive, Fast, Technical Riffs"
    }
};

export interface RecommendationParams {
    genre: string;
    melancholy: number;
    energy: number;
    obscurity: number;
}

export interface RecommendedArtist {
    artist_name: string;
    reason: string;
    representative_track: string;
    representative_album: string;
    spotify_artist_id?: string;
    spotify_album_id?: string;
    album_image_url?: string;
    album_spotify_url?: string;
    spotify_available?: boolean;
}

export async function generateRecommendations(params: RecommendationParams): Promise<RecommendedArtist[]> {
    const genreInfo = GENRE_PROMPTS[params.genre];
    if (!genreInfo) throw new Error("Invalid Genre");

    const vibeInstruction = `
  **【今の気分の微調整】**
  - 哀愁・エモさレベル: ${params.melancholy}%
  - 激しさ・エナジーレベル: ${params.energy}%
  - マニアック度: ${params.obscurity}%
  `;

    const additionalInstruction = params.obscurity > 70 ? `
  **【重要: 選定基準】**
  - メジャーすぎるアーティスト（例: Weezer, Oasisなど）は**絶対に除外**してください。
  - まだあまり知られていない「隠れた名曲」を持つバンドを優先。
  - "Underrated"（過小評価されている）アーティストを選んでください。
  ` : "";

    const prompt = `
  あなたは熟練の音楽キュレーターです。
  以下の条件に基づき、おすすめのアーティストを5組紹介してください。

  **基本ジャンル:**
  ${genreInfo.description}

  **除外ジャンル:** HipHop, Classical
  ${vibeInstruction}${additionalInstruction}
  - 出力形式: JSONフォーマットのみ

  **JSONの構造:**
  [
      {
          "artist_name": "アーティスト名",
          "reason": "選定理由（日本語）",
          "representative_track": "代表曲",
          "representative_album": "おすすめアルバム"
      }
  ]
  `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    console.log("Gemini Raw Response:", responseText); // Debug Log

    // Clean Code Blocks
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    let artists: RecommendedArtist[] = [];

    try {
        artists = JSON.parse(cleanJson);
    } catch (e) {
        console.error("JSON Parse Error", e);
        throw new Error("Failed to parse AI response");
    }

    // Enrich with Spotify Data
    if (spotifyApi.getAccessToken()) {
        const enrichedArtists = await Promise.all(artists.map(async (artist) => {
            try {
                // Search for the artist/album
                const query = `artist:${artist.artist_name} album:${artist.representative_album}`;
                const searchRes = await spotifyApi.searchAlbums(query, { limit: 1 });

                if (searchRes.body.albums?.items[0]) {
                    const album = searchRes.body.albums?.items[0];
                    return {
                        ...artist,
                        album_image_url: album.images[0]?.url,
                        album_spotify_url: album.external_urls.spotify,
                        spotify_album_id: album.id,
                        spotify_artist_id: album.artists[0]?.id
                    };
                }

                // Fallback: Search just by artist if album not found
                const artistRes = await spotifyApi.searchArtists(artist.artist_name, { limit: 1 });
                if (artistRes.body.artists?.items[0]) {
                    const a = artistRes.body.artists?.items[0];
                    return {
                        ...artist,
                        album_image_url: a.images[0]?.url, // Use artist image as fallback
                        album_spotify_url: a.external_urls.spotify,
                        spotify_artist_id: a.id
                    }
                }

            } catch (error) {
                console.warn(`Failed to enrich ${artist.artist_name}`, error);
            }
            return artist;
        }));
        return enrichedArtists;
    }

    return artists;
}

// Related Artists Interface
export interface RelatedArtist {
    name: string;
    reason: string;
}

// Get Related Artists using Gemini
export async function getRelatedArtists(artistName: string): Promise<RelatedArtist[]> {
    const prompt = `
あなたは音楽の専門家です。
「${artistName}」に音楽的に似ているアーティストを5組挙げてください。

各アーティストについて、以下のJSON形式で出力してください。
説明以外の出力は不要です。
[
    {
        "name": "アーティスト名",
        "reason": "類似している理由（日本語、1文で簡潔に）"
    }
]

注意:
- 音楽スタイル、時代、ジャンル、影響関係などを考慮してください
- メジャーなアーティストだけでなく、隠れた名アーティストも含めてください
- 同じレーベル、同じシーン、同じプロデューサーなどの関連性も考慮
`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    console.log("Gemini Related Artists Response:", responseText);

    // Clean Code Blocks
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
        const artists: RelatedArtist[] = JSON.parse(cleanJson);
        return artists.slice(0, 5); // Ensure max 5 artists
    } catch (e) {
        console.error("JSON Parse Error for Related Artists", e);
        throw new Error("Failed to parse AI response for related artists");
    }
}
