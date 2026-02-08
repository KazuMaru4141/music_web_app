'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface SaveRelatedButtonProps {
    artistId: string
    onSaveComplete?: () => void
}

export default function SaveRelatedButton({ artistId, onSaveComplete }: SaveRelatedButtonProps) {
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')
    const router = useRouter()

    const handleSave = async () => {
        setLoading(true)
        setMessage('')

        try {
            const res = await fetch('/api/artists/save-related', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source_artist_id: artistId }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || '保存に失敗しました')
            }

            setMessage(`成功！ ${data.count}組の関連アーティストを保存しました。`)

            // 保存成功後に自動でページを更新
            router.refresh()

            if (onSaveComplete) onSaveComplete()

        } catch (err: any) {
            console.error(err)
            setMessage(`エラー: ${err.message}`)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex flex-col items-start gap-2 mt-4">
            <button
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
                {loading ? '保存中...' : '関連アーティストを保存・更新'}
            </button>
            {message && <p className="text-sm text-gray-600">{message}</p>}
        </div>
    )
}
