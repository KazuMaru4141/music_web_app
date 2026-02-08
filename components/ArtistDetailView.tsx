'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import SaveRelatedButton from '@/components/SaveRelatedButton'

interface Artist {
    id: string
    name: string
    genres: string[] | null
    image_url: string | null
}

interface RelatedArtist {
    id: string
    name: string
    genres: string[] | null
    image_url: string | null
    reason?: string | null
}

interface ArtistDetailViewProps {
    artist: Artist
    relatedArtists: RelatedArtist[]
    artistId: string
}

export default function ArtistDetailView({ artist, relatedArtists, artistId }: ArtistDetailViewProps) {
    return (
        <div className="min-h-screen bg-gray-50/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* ★ 戻るリンク */}
                <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 transition mb-8 group"
                >
                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-medium">Now Playing に戻る</span>
                </Link>

                <div className="flex flex-col lg:flex-row gap-12">

                    {/* --- 左側: 固定されたアーティスト情報 (Sticky Sidebar) --- */}
                    <div className="lg:w-1/3 flex-shrink-0">
                        <div className="lg:sticky lg:top-8 space-y-6">
                            {/* メインアーティスト画像 */}
                            <div className="relative aspect-square w-full rounded-2xl overflow-hidden shadow-2xl ring-1 ring-gray-900/5">
                                {artist.image_url ? (
                                    <Image
                                        src={artist.image_url}
                                        alt={artist.name}
                                        fill
                                        className="object-cover"
                                        priority
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-6xl">
                                        🎵
                                    </div>
                                )}
                            </div>

                            {/* アーティスト詳細 */}
                            <div className="text-center lg:text-left space-y-4">
                                <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight leading-tight">
                                    {artist.name}
                                </h1>

                                {artist.genres && artist.genres.length > 0 && (
                                    <div className="flex flex-wrap justify-center lg:justify-start gap-2">
                                        {artist.genres.map((g) => (
                                            <span key={g} className="px-3 py-1 bg-white text-gray-600 text-sm font-medium rounded-full border border-gray-200 shadow-sm">
                                                {g}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* アクションボタンエリア */}
                                <div className="pt-4 flex justify-center lg:justify-start gap-3">
                                    <a
                                        href={`https://open.spotify.com/artist/${artist.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center px-4 py-2 bg-[#1DB954] hover:bg-[#1ed760] text-white rounded-full font-bold text-sm transition-colors shadow-sm"
                                    >
                                        Spotify
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* --- 右側: 関連アーティストの探索フィード (Scrollable) --- */}
                    <div className="lg:w-2/3">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                    Dig Deeper
                                </h2>
                                <p className="text-gray-500 text-sm mt-1">
                                    AIによってキュレーションされた関連アーティスト
                                </p>
                            </div>
                            <SaveRelatedButton artistId={artistId} />
                        </div>

                        {relatedArtists.length === 0 ? (
                            <div className="bg-white rounded-2xl p-12 text-center border-2 border-dashed border-gray-200">
                                <p className="text-gray-500 font-medium">No connections found yet.</p>
                                <p className="text-sm text-gray-400 mt-2">右上のボタンを押してディグりましょう</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {relatedArtists.map((relArtist) => (
                                    <Link
                                        key={relArtist.id}
                                        href={`/artists/${relArtist.id}`}
                                        className="group relative bg-white rounded-2xl p-4 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-gray-100 flex flex-col"
                                    >
                                        {/* ヘッダー: 画像と名前 */}
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="relative w-16 h-16 flex-shrink-0 rounded-full overflow-hidden bg-gray-100 ring-2 ring-gray-50 group-hover:ring-indigo-100 transition-all">
                                                {relArtist.image_url ? (
                                                    <Image
                                                        src={relArtist.image_url}
                                                        alt={relArtist.name}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex items-center justify-center h-full text-xl">🎤</div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-lg text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                                                    {relArtist.name}
                                                </h3>
                                                {relArtist.genres && (
                                                    <p className="text-xs text-gray-500 truncate">
                                                        {relArtist.genres.slice(0, 2).join(', ')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Geminiの推薦理由エリア */}
                                        <div className="flex-1 bg-gray-50 rounded-xl p-3 mb-2">
                                            <p className="text-sm text-gray-600 leading-relaxed line-clamp-3 italic">
                                                {relArtist.reason ? `"${relArtist.reason}"` : '"関連性の高いアーティストです"'}
                                            </p>
                                        </div>

                                        {/* "Dig" アクション */}
                                        <div className="mt-auto pt-2 flex justify-end">
                                            <span className="text-xs font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                                詳細を見る →
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
