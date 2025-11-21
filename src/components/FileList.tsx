import React from 'react'

type FileItem = { path: string; preview: string }

type Props = {
  files: FileItem[]
  onOpen: (file: FileItem) => void
}

export default function FileList({ files, onOpen }: Props) {
  return (
    <div className="card">
      <div className="text-sm mb-2 opacity-80">Generated Files</div>
      <ul className="space-y-2">
        {files.map((f) => (
          <li key={f.path} className="p-2 bg-white/5 rounded-md hover:bg-white/10 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-mono text-xs">{f.path}</div>
                <div className="text-xs opacity-80 mt-1">{(f.preview || '').slice(0, 120)}</div>
              </div>
              <button className="btn btn-primary" onClick={() => onOpen(f)} aria-label={`Open ${f.path}`}>Preview</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}