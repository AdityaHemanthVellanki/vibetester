import React, { useEffect } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

type FileItem = { path: string; preview: string }

type Props = {
  file: FileItem | null
  onClose: () => void
}

export default function CodePreviewModal({ file, onClose }: Props) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  if (!file) return null

  function copy() {
    navigator.clipboard.writeText(file.preview || '')
  }

  function download() {
    const blob = new Blob([file.preview || ''], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = file.path.split('/').pop() || 'file.test.ts'
    a.click()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-4xl card">
        <div className="flex items-center justify-between mb-2">
          <div className="font-mono text-xs">{file.path}</div>
          <div className="flex gap-2">
            <button className="btn" onClick={copy} aria-label="Copy">Copy</button>
            <button className="btn" onClick={download} aria-label="Download">Download</button>
            <button className="btn" onClick={onClose} aria-label="Close">Close</button>
          </div>
        </div>
        <div className="h-[60vh] overflow-auto rounded-md">
          <SyntaxHighlighter language="typescript" style={vscDarkPlus} showLineNumbers>
            {file.preview || ''}
          </SyntaxHighlighter>
        </div>
      </div>
    </div>
  )
}