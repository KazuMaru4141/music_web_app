'use client';

import { useState } from 'react';
import { Settings, RefreshCw, Disc, Info } from 'lucide-react';

const GENRES = [
    'DeepDive_PowerPop',
    'DeepDive_MellowPop',
    'DeepDive_BeautifulEmo',
    'DeepDive_Dance',
    'DeepDive_JanglePop',
    'DeepDive_IndieRock',
    'DeepDive_MelodicDeathMetal',
    'DeepDive_IndiePop',
    'DeepDive_PopPunk',
    'DeepDive_MelodicHardcore',
    'DeepDive_ThrashMetal'
];

interface Recommendation {
    artist_name: string;
    reason: string;
    representative_track: string;
    representative_album: string;
    album_image_url?: string;
    album_spotify_url?: string;
}

export default function Curator() {
    const [selectedGenre, setSelectedGenre] = useState('');
    const [melancholy, setMelancholy] = useState(50);
    const [energy, setEnergy] = useState(50);
    const [obscurity, setObscurity] = useState(50);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<Recommendation[]>([]);

    const handleGenerate = async () => {
        if (!selectedGenre) return;
        setLoading(true);
        setResults([]);

        try {
            const res = await fetch('/api/curator/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    genre: selectedGenre,
                    melancholy,
                    energy,
                    obscurity
                })
            });
            const data = await res.json();
            if (data.success) {
                setResults(data.data);
            } else {
                alert(data.error || "Failed to generate");
            }
        } catch (e) {
            console.error(e);
            alert("Error generating recommendations");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gray-900/50 p-6 rounded-3xl border border-gray-800">
            <div className="flex items-center space-x-2 mb-6">
                <Disc className="text-pink-500" />
                <h2 className="text-2xl font-bold">AI Music Curator</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                {/* Controls */}
                <div className="space-y-6">

                    {/* Genre Select */}
                    <div>
                        <label className="block text-gray-400 text-sm mb-2">Select Genre Profile</label>
                        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2">
                            {GENRES.map((g) => (
                                <button
                                    key={g}
                                    onClick={() => setSelectedGenre(g)}
                                    className={`px-3 py-2 rounded-lg text-sm text-left transition ${selectedGenre === g
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                        }`}
                                >
                                    {g.replace('DeepDive_', '')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Sliders */}
                    <div className="space-y-4 p-4 bg-black/20 rounded-xl">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Melancholy (Emo)</span>
                            <span className="text-blue-400">{melancholy}%</span>
                        </div>
                        <input type="range" min="0" max="100" value={melancholy} onChange={(e) => setMelancholy(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />

                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Energy</span>
                            <span className="text-yellow-400">{energy}%</span>
                        </div>
                        <input type="range" min="0" max="100" value={energy} onChange={(e) => setEnergy(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />

                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Obscurity (Deep Dive)</span>
                            <span className="text-purple-400">{obscurity}%</span>
                        </div>
                        <input type="range" min="0" max="100" value={obscurity} onChange={(e) => setObscurity(Number(e.target.value))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer" />
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={loading || !selectedGenre}
                        className={`w-full py-4 rounded-xl font-bold flex items-center justify-center space-x-2 transition ${loading || !selectedGenre
                                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:scale-[1.02] text-white shadow-lg'
                            }`}
                    >
                        {loading ? <RefreshCw className="animate-spin" /> : <Settings />}
                        <span>{loading ? 'Curating...' : 'Generate Recommendations'}</span>
                    </button>
                </div>

                {/* Results */}
                <div className="bg-black/20 rounded-2xl p-4 min-h-[400px]">
                    <h3 className="text-gray-400 font-bold mb-4">Recommendations</h3>
                    {results.length === 0 && !loading && (
                        <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-2">
                            <p>Select a genre and params to start.</p>
                        </div>
                    )}

                    <div className="space-y-4">
                        {results.map((rec, i) => (
                            <div key={i} className="p-4 bg-gray-800/50 rounded-xl hover:bg-gray-800 transition border border-transparent hover:border-gray-700">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-bold text-lg text-white">{rec.artist_name}</h4>
                                        <p className="text-xs text-blue-400 mb-2">{rec.representative_track} • {rec.representative_album}</p>
                                        <p className="text-sm text-gray-400 leading-relaxed">{rec.reason}</p>
                                    </div>
                                </div>
                                {rec.album_spotify_url && (
                                    <div className="mt-3 pt-3 border-t border-gray-700/50">
                                        <a href={rec.album_spotify_url} target="_blank" rel="noreferrer" className="text-xs text-green-400 hover:underline flex items-center space-x-1">
                                            <span>Open on Spotify</span>
                                        </a>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
