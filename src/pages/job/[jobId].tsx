import React, { useMemo, useState } from 'react'
import StatusPoller from '@/components/StatusPoller'
import LogViewer from '@/components/LogViewer'
import FileList from '@/components/FileList'
import CodePreviewModal from '@/components/CodePreviewModal'
import RetryModal from '@/components/RetryModal'
import useSWR from 'swr'

type FileItem = { path: string; size?: number; signedUrl?: string }
type ResultPayload = { jobId: string; s3Prefix?: string; files?: FileItem[] }

export default function JobPage() {
  const [selected, setSelected] = useState<FileItem | null>(null)
  const [retryOpen, setRetryOpen] = useState(false)
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
        {(data: { status?: string; progress?: string[]; error?: string; gitUrl?: string }) => {
          const status: string = data.status || ''
          const progress: string[] = data.progress || []
          const error: string = data.error || ''
          const gitUrl: string = data.gitUrl || ''
          async function retryClone() {
            setRetryOpen(true)
          }
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
                {status === 'failed' && error && error.includes('git clone failed') && (
                  <div className="card mt-4">
                    <div className="text-sm font-medium mb-2">Clone failure</div>
                    <div className="font-mono text-xs whitespace-pre-wrap mb-3">{error.slice(0, 500)}</div>
                    <div className="text-sm opacity-80 mb-2">Suggested actions:</div>
                    <ul className="list-disc ml-5 text-sm opacity-80 mb-3">
                      <li>Make repo public or ensure you can git clone locally</li>
                      <li>Paste HTTPS URL (e.g., https://github.com/owner/repo.git)</li>
                      <li>Try again (button below)</li>
                      <li>If private, provide a Personal Access Token</li>
                    </ul>
                    <div className="flex gap-2">
                      <button className="btn btn-primary" onClick={retryClone} aria-label="Retry Clone">Retry Clone</button>
                    </div>
                  </div>
                )}
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
      <RetryModal open={retryOpen} onClose={() => setRetryOpen(false)} jobId={jobId} onRetried={(newId) => { window.location.href = `/job/${newId}` }} />
    </div>
  )
}
