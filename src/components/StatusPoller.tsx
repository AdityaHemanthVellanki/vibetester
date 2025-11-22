import React, { useEffect } from 'react'
import useSWR from 'swr'

const fetcher = async (url: string): Promise<{ status?: string; progress?: string[]; error?: string; gitUrl?: string }> => {
  const r = await fetch(url)
  return (await r.json()) as { status?: string; progress?: string[]; error?: string; gitUrl?: string }
}

type Props = {
  jobId: string
  children?: (data: { status?: string; progress?: string[]; error?: string; gitUrl?: string }) => React.ReactNode
}

export default function StatusPoller({ jobId, children }: Props) {
  const { data, error, isLoading } = useSWR(`/api/status?jobId=${encodeURIComponent(jobId)}`, fetcher, {
    refreshInterval: 2000,
    revalidateOnFocus: false,
  })

  useEffect(() => {
    // basic console telemetry
    if (data?.status) console.log('status', data.status)
  }, [data])

  if (error) return <div className="text-red-400">Failed to load status</div>
  if (isLoading || !data) return <div>Loading status…</div>
  return <>{children ? children(data) : null}</>
}
