import React, { useMemo, useState } from 'react'
import StatusPoller from '@/components/StatusPoller'
import LogViewer from '@/components/LogViewer'
import FileList from '@/components/FileList'
import CodePreviewModal from '@/components/CodePreviewModal'
import useSWR from 'swr'

type FileItem = { path: string; size?: number; signedUrl?: string }
type ResultPayload = { jobId: string; s3Prefix?: string; files?: FileItem[] }

export default function JobPage() {
  const [selected, setSelected] = useState<FileItem | null>(null)
  const jobId = useMemo(() => {
    if (typeof window === 'undefined') return ''
    const parts = window.location.pathname.split('/')
    return parts[parts.length - 1]
  }, [])

  const fetcher = (url: string) => fetch(url).then(r => r.json())
  const key = jobId ? `/api/result?jobId=${encodeURIComponent(jobId)}` : null
  const { data: result, mutate } = useSWR<ResultPayload | null>(key, fetcher)
  const fileList: FileItem[] = (result?.files || [])
  async function refreshResult() { await mutate() }

  return (
    <div className="min-h-screen px-4 py-8">
      <header className="flex items-center justify-between mb-6">
        <div className="text-xl font-semibold">Job: {jobId}</div>
        <button className="btn btn-primary" onClick={refreshResult} aria-label="Refresh Result">Refresh Result</button>
      </header>
      <StatusPoller jobId={jobId}>
        {(data: { status?: string; progress?: string[] }) => {
          const status: string = data.status || ''
          const progress: string[] = data.progress || []
          const badgeColor = status === 'done' ? 'bg-green-600' : status === 'failed' ? 'bg-red-600' : 'bg-yellow-600'
          return (
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <div className="card mb-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm opacity-80">Status</div>
                    <span className={`badge ${badgeColor}`}>{status}</span>
                  </div>
                  <div className="mt-2">
                    <ol className="text-sm font-mono space-y-1">
                      {progress.map((p: string, i: number) => (
                        <li key={i} className="opacity-90">{p}</li>
                      ))}
                    </ol>
                  </div>
                </div>
                <LogViewer lines={progress} />
              </div>
              <div>
                {fileList.length > 0 ? (
                  <FileList files={fileList} onOpen={setSelected} />
                ) : (
                  <div className="card">No files yet. Click Refresh Result when status is done.</div>
                )}
              </div>
            </div>
          )
        }}
      </StatusPoller>
      <CodePreviewModal file={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
