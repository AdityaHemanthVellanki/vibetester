import React, { useEffect, useRef, useState } from 'react'

type Props = {
  lines: string[]
}

export default function LogViewer({ lines }: Props) {
  const [autoScroll, setAutoScroll] = useState(true)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [lines, autoScroll])

  function copyAll() {
    navigator.clipboard.writeText(lines.join('\n'))
  }

  function clear() {
    // clear view but preserve underlying source (caller controls)
    if (containerRef.current) containerRef.current.scrollTop = 0
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm opacity-80">Live Logs</div>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => setAutoScroll(v => !v)} aria-label="Toggle auto-scroll">
            {autoScroll ? 'Auto-scroll: On' : 'Auto-scroll: Off'}
          </button>
          <button className="btn" onClick={copyAll} aria-label="Copy logs">Copy</button>
          <button className="btn" onClick={clear} aria-label="Clear view">Clear</button>
        </div>
      </div>
      <div ref={containerRef} className="h-64 overflow-y-auto font-mono text-sm whitespace-pre-wrap">
        {lines.map((l, i) => (
          <div key={i} className="opacity-90">{l}</div>
        ))}
      </div>
    </div>
  )
}