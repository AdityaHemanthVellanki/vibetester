import React, { useEffect, useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

type FileItem = { path: string; size?: number; signedUrl?: string }

type Props = {
  file: FileItem | null
  onClose: () => void
}

export default function CodePreviewModal({ file, onClose }: Props) {
  const [content, setContent] = useState('')
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  if (!file) return null

  function copy() {
    navigator.clipboard.writeText(content || '')
  }

  function download(current: FileItem) {
    const blob = new Blob([content || ''], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    const filename = (current?.path?.split('/').pop()) || 'file.test.ts'
    a.download = filename
    a.click()
  }

  useEffect(() => {
    let canceled = false
    async function load() {
      if (file?.signedUrl) {
        const r = await fetch(file.signedUrl)
        const t = await r.text()
        if (!canceled) setContent(t)
      } else {
        setContent('')
      }
    }
    load()
    return () => { canceled = true }
  }, [file?.signedUrl])

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-4xl card">
        <div className="flex items-center justify-between mb-2">
          <div className="font-mono text-xs">{file?.path}</div>
          <div className="flex gap-2">
            <button className="btn" onClick={copy} aria-label="Copy">Copy</button>
            <button className="btn" onClick={() => file && download(file)} aria-label="Download">Download</button>
            <button className="btn" onClick={onClose} aria-label="Close">Close</button>
          </div>
        </div>
        <div className="h-[60vh] overflow-auto rounded-md">
          <SyntaxHighlighter language="typescript" style={vscDarkPlus} showLineNumbers>
            {content || ''}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  )
}
