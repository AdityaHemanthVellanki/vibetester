import React, { useRef, useState } from 'react'

type Props = {
  onSubmitted?: (jobId: string) => void
}

export default function UploadRepo({ onSubmitted }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [gitUrl, setGitUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const fd = new FormData()
      const file = fileRef.current?.files?.[0]
      if (file) {
        if (file.size > 50 * 1024 * 1024) {
          throw new Error('File exceeds 50MB limit')
        }
        fd.append('file', file)
      }
      if (gitUrl) {
        fd.append('gitUrl', gitUrl)
      }
      if (!file && !gitUrl) {
        throw new Error('Provide a ZIP file or a Git URL')
      }
      const res = await fetch('/api/analyze', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Failed to enqueue job')
      const data = await res.json()
      onSubmitted?.(data.jobId)
      window.location.href = `/job/${data.jobId}`
    } catch (err: any) {
      setError(err?.message || 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <div>
        <label className="block text-sm mb-2">Upload ZIP (max 50MB)</label>
        <input ref={fileRef} type="file" accept=".zip" className="w-full" />
      </div>
      <div>
        <label className="block text-sm mb-2">GitHub URL</label>
        <input
          type="url"
          placeholder="https://github.com/user/repo"
          value={gitUrl}
          onChange={e => setGitUrl(e.target.value)}
          className="w-full rounded-md bg-panel px-3 py-2 border border-white/10"
        />
      </div>
      {error && <div className="text-red-400 text-sm">{error}</div>}
      <button disabled={loading} className="btn btn-primary w-full" aria-label="Analyze Repo">
        {loading ? 'Submitting…' : 'Analyze Repo'}
      </button>
    </form>
  )
}