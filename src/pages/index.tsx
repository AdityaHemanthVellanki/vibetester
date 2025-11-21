import React from 'react'
import UploadRepo from '@/components/UploadRepo'

export default function HomePage() {
  return (
    <div className="min-h-screen px-4 py-8">
      <header className="flex items-center justify-between mb-8">
        <div className="text-xl font-semibold">AI Test Architect</div>
        <a href="#upload" className="btn btn-primary" aria-label="Upload Repo">Upload Repo</a>
      </header>
      <main className="max-w-4xl mx-auto">
        <section className="mb-6">
          <div className="card">
            <h1 className="text-2xl mb-2">Generate Jest Tests from Your Repo</h1>
            <p className="opacity-80">Upload a ZIP or enter a GitHub URL. We analyze your code and generate test stubs using your configured LLM.</p>
          </div>
        </section>
        <section id="upload">
          <UploadRepo />
        </section>
      </main>
    </div>
  )
}
