'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Play, Pause, Plus, SkipBack, SkipForward, ListPlus, CheckCircle2, ChevronRight, User, Disc3, Music, Hash, CalendarDays, Heart } from 'lucide-react';

// Toast notification component
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
    useEffect(() => {
        const timer = setTimeout(onClose, 2000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-pink-500 text-white px-4 py-2 rounded-full shadow-lg z-50 animate-fade-in-up">
            {message}
        </div>
    );
}

export default function NowPlaying() {
    const [track, setTrack] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [controlLoading, setControlLoading] = useState(false);
    const [rating, setRating] = useState(0);
    const [error, setError] = useState('');
    const [queuedTracks, setQueuedTracks] = useState<Set<string>>(new Set());
    const [toast, setToast] = useState<string | null>(null);
    const [autoNext, setAutoNext] = useState(true);

    const showToast = (message: string) => setToast(message);

    const fetchTrack = async () => {
        try {
            const res = await fetch('/api/player/now-playing');
            if (res.status === 401) {
                setError('Please login');
                return;
            }
            const data = await res.json();
            if (data.is_playing === false) {
                setTrack(null);
            } else {
                setTrack(data);
                setRating(data.rating || 0);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleRate = async (star: number) => {
        setRating(star);
        if (!track) return;

        // Optimistic UI update for album tracks and score
        const trackPoints: Record<number, number> = { 1: 0, 2: 10, 3: 60, 4: 80, 5: 100 };
        const updatedAlbumTracks = track.album_tracks?.map((t: any) =>
            t.id === track.id ? { ...t, rating: star } : t
        ) || [];

        let totalPoints = 0;
        updatedAlbumTracks.forEach((t: any) => {
            totalPoints += trackPoints[t.rating] || 0;
        });
        const newAlbumScore = updatedAlbumTracks.length > 0
            ? parseFloat((totalPoints / updatedAlbumTracks.length).toFixed(1))
            : 0;

        setTrack((prev: any) => prev ? {
            ...prev,
            album_tracks: updatedAlbumTracks,
            album_score: newAlbumScore
        } : prev);

        showToast(`Rated ${star} ★`);

        try {
            await fetch('/api/player/like', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ track, rating: star })
            });

            // Auto-next after rating
            if (autoNext) {
                setTimeout(() => handleControl('next'), 500);
            }
        } catch (e) {
            console.error("Failed to rate", e);
        }
    };

    const handleControl = async (action: 'play' | 'pause' | 'next' | 'previous') => {
        if (controlLoading) return;
        setControlLoading(true);

        if (action === 'play' || action === 'pause') {
            setTrack((prev: any) => prev ? { ...prev, is_playing: action === 'play' } : prev);
        }

        try {
            const res = await fetch('/api/player/control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action })
            });

            if (!res.ok) {
                const data = await res.json();
                alert(`Playback Error: ${data.error}`);
                fetchTrack();
                return;
            }

            if (action === 'next' || action === 'previous') {
                setTimeout(fetchTrack, 300);
            } else {
                setTimeout(fetchTrack, 1000);
            }
        } catch (e) {
            console.error("Control failed", e);
            fetchTrack();
        } finally {
            setControlLoading(false);
        }
    };

    const handleSaveAlbum = async () => {
        if (!track) return;
        try {
            const res = await fetch('/api/player/save-album', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ track })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to save');
            }
            const data = await res.json();
            setTrack((prev: any) => prev ? { ...prev, is_album_saved: true } : prev);
            showToast(data.status === 'updated' ? 'Album Updated!' : 'Album Saved!');
        } catch (e: any) {
            console.error("Failed to save album", e);
            alert(`Error: ${e.message}`);
        }
    };

    const handleAddToQueue = async (uri: string) => {
        try {
            const res = await fetch('/api/player/queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uri })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to add to queue');
            }
            setQueuedTracks(prev => new Set(prev).add(uri));
            showToast('Added to Queue!');
            setTimeout(() => {
                setQueuedTracks(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(uri);
                    return newSet;
                });
            }, 2000);
        } catch (e: any) {
            console.error("Failed to add to queue", e);
            alert(`Error: ${e.message}`);
        }
    };

    useEffect(() => {
        fetchTrack();
        const interval = setInterval(fetchTrack, 15000);
        return () => clearInterval(interval);
    }, []);

    if (error === 'Please login') {
        return (
            <div className="p-6 bg-gray-900 rounded-xl text-center">
                <p className="text-gray-400 mb-4">Please login to see player</p>
                <a href="/api/auth/login" className="px-6 py-2 bg-green-600 rounded-full text-white font-bold hover:bg-green-500">
                    Login with Spotify
                </a>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="p-6 bg-gray-900 rounded-xl animate-pulse">
                <div className="h-4 bg-gray-700 w-1/4 mb-4 rounded"></div>
                <div className="h-64 bg-gray-800 rounded-lg mb-4"></div>
            </div>
        );
    }

    if (!track) {
        return (
            <div className="p-6 bg-gray-900 rounded-xl flex flex-col items-center justify-center min-h-[400px]">
                <h2 className="text-xl text-gray-500 font-medium">Not Playing</h2>
                <p className="text-gray-600">Start playing music on Spotify to see it here.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col p-4 md:p-6 bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-2xl md:rounded-3xl border border-gray-700 shadow-2xl max-w-lg mx-auto">
            {/* Toast Notification */}
            {toast && <Toast message={toast} onClose={() => setToast(null)} />}

            {/* ===== TOP SECTION: Track Info + Stats ===== */}
            <div className="flex items-start space-x-3 mb-4">
                {/* Compact Album Art */}
                <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden shadow-lg border border-gray-700/50 shrink-0">
                    <Image
                        src={track.image}
                        alt={track.album}
                        fill
                        className="object-cover"
                    />
                </div>

                {/* Track Info */}
                <div className="flex-1 min-w-0">
                    <h2 className="text-lg md:text-xl font-bold text-white truncate">
                        {track.name}
                    </h2>
                    <a
                        href={track.artist_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm md:text-base text-gray-300 hover:text-pink-400 transition truncate block"
                    >
                        {track.artist}
                    </a>
                    {/* Album row with heart icon */}
                    <div className="flex items-center space-x-2">
                        <a
                            href={track.album_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-gray-500 hover:text-pink-400 transition truncate"
                        >
                            {track.album}
                        </a>
                        <button
                            onClick={handleSaveAlbum}
                            disabled={track.is_album_saved}
                            className={`shrink-0 transition ${track.is_album_saved
                                ? 'text-pink-500 cursor-default'
                                : 'text-gray-500 hover:text-pink-400 hover:scale-110'
                                }`}
                            title={track.is_album_saved ? 'In Library' : 'Add to Library'}
                        >
                            <Heart size={14} fill={track.is_album_saved ? 'currentColor' : 'none'} />
                        </button>
                    </div>

                    {/* Badges - Unified gray/white palette */}
                    <div className="flex flex-wrap gap-1 mt-1">
                        <span className="px-2 py-0.5 bg-gray-700/50 text-gray-300 text-[10px] rounded-full border border-gray-600 capitalize">
                            {track.album_type || 'Album'}
                        </span>
                        <span className="px-2 py-0.5 bg-gray-700/50 text-gray-300 text-[10px] rounded-full border border-gray-600">
                            {track.genre || 'Pop'}
                        </span>
                        {track.album_score !== undefined && (
                            <span className="px-2 py-0.5 bg-pink-900/40 text-pink-400 text-[10px] rounded-full border border-pink-800 font-bold">
                                ★ {track.album_score}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* ===== STATS SECTION: Playback Counts with Icons ===== */}
            <div className="flex items-center justify-between bg-black/30 p-3 rounded-lg mb-4">
                {/* Left: Scrobble counts (basic info) */}
                <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-1.5 text-gray-400">
                        <User size={12} className="text-gray-500" />
                        <span className="font-bold text-white text-sm">{track.stats?.artist || 0}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-gray-400">
                        <Disc3 size={12} className="text-gray-500" />
                        <span className="font-bold text-white text-sm">{track.stats?.album || 0}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 text-gray-400">
                        <Music size={12} className="text-gray-500" />
                        <span className="font-bold text-white text-sm">{track.stats?.track || 0}</span>
                    </div>
                </div>
                {/* Separator */}
                <div className="w-px h-6 bg-gray-700"></div>
                {/* Right: Total & Today (history) */}
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1.5">
                        <Hash size={12} className="text-gray-500" />
                        <span className="font-bold text-white text-sm">{track.stats?.total || 0}</span>
                    </div>
                    <div className="flex items-center space-x-1.5 bg-pink-500/20 px-2 py-1 rounded-full">
                        <CalendarDays size={12} className="text-pink-400" />
                        <span className="font-bold text-pink-400 text-sm">{track.stats?.today || 0}</span>
                    </div>
                </div>
            </div>

            {/* ===== CENTER SECTION: Giant Rating UI ===== */}
            <div className="flex flex-col items-center py-6 bg-gray-800/30 rounded-2xl border border-gray-700/50 mb-4">
                <p className="text-gray-400 text-xs mb-2 uppercase tracking-widest">Rate This Track</p>
                <div className="flex items-center justify-center space-x-2 md:space-x-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            onClick={() => handleRate(star)}
                            className={`text-4xl md:text-5xl transition-all duration-200 transform hover:scale-110 active:scale-95 ${rating >= star
                                ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]'
                                : 'text-gray-600 hover:text-gray-400'
                                }`}
                        >
                            ★
                        </button>
                    ))}
                </div>

                {/* Auto-Next Toggle - Pink accent */}
                <button
                    onClick={() => setAutoNext(!autoNext)}
                    className={`mt-4 flex items-center space-x-2 px-4 py-2 rounded-full text-sm transition ${autoNext
                        ? 'bg-pink-500/20 text-pink-400 border border-pink-500/50'
                        : 'bg-gray-700/50 text-gray-400 border border-gray-600'
                        }`}
                >
                    <span>{autoNext ? '✓' : '○'}</span>
                    <span>Rate & Next</span>
                    <ChevronRight size={14} />
                </button>
            </div>

            {/* ===== BOTTOM SECTION: Centered Playback Controls ===== */}
            <div className="flex items-center justify-center bg-gray-800/40 p-3 rounded-xl border border-gray-700/50">
                {/* Playback Controls - Centered */}
                <div className="flex items-center space-x-4">
                    <button onClick={() => handleControl('previous')} className="text-gray-400 hover:text-white transition">
                        <SkipBack size={20} fill="currentColor" />
                    </button>
                    <button
                        onClick={() => handleControl(track.is_playing ? 'pause' : 'play')}
                        className="w-12 h-12 flex items-center justify-center bg-white hover:bg-gray-200 text-black rounded-full transition shadow-lg"
                    >
                        {track.is_playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                    </button>
                    <button onClick={() => handleControl('next')} className="text-gray-400 hover:text-white transition">
                        <SkipForward size={20} fill="currentColor" />
                    </button>
                </div>
            </div>

            {/* ===== ALBUM TRACKS SECTION ===== */}
            {track.album_tracks && track.album_tracks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-700/50">
                    <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Album Tracks</h4>
                    <div className="space-y-1 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                        {track.album_tracks.map((t: any, index: number) => (
                            <div key={t.id} className={`flex items-center justify-between p-2 rounded-lg transition ${t.id === track.id ? 'bg-pink-500/10 border border-pink-500/20' : 'hover:bg-gray-800/50'}`}>
                                <div className="flex items-center space-x-2 truncate mr-2">
                                    <span className="text-xs text-gray-500 font-mono w-4">{index + 1}</span>
                                    <span className={`text-sm truncate ${t.id === track.id ? 'text-pink-400 font-medium' : 'text-gray-300'}`}>
                                        {t.name}
                                    </span>
                                </div>
                                <div className="flex items-center space-x-1 shrink-0">
                                    <button
                                        onClick={() => handleAddToQueue(t.uri)}
                                        className={`p-1 transition ${queuedTracks.has(t.uri)
                                            ? 'text-pink-400'
                                            : 'text-gray-500 hover:text-pink-400'
                                            }`}
                                        title={queuedTracks.has(t.uri) ? 'Added!' : 'Add to Queue'}
                                        disabled={queuedTracks.has(t.uri)}
                                    >
                                        {queuedTracks.has(t.uri) ? <CheckCircle2 size={14} /> : <ListPlus size={14} />}
                                    </button>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <span
                                            key={star}
                                            className={`text-[10px] ${t.rating >= star ? 'text-yellow-400' : 'text-gray-500'}`}
                                        >
                                            ★
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
