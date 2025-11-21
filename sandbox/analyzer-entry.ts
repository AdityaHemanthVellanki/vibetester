import { Project } from 'ts-morph'
import fs from 'fs-extra'
import path from 'path'
import OpenAI from 'openai'

const REPO_DIR = process.env.REPO_DIR || '/repo'
const OUT_DIR = process.env.OUT_DIR || '/out'
const JOB_ID = process.env.JOB_ID || 'unknown'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini'

async function log(message: string) {
  process.stdout.write(message + '\n')
}

function buildPrompt(relPath: string, exports: string[], content: string): string {
  return `You are an expert developer who writes robust, production-ready Jest tests.

File: ${relPath}
Exports: ${exports.join(', ')}

Contents:
\`\`\`ts
${content}
\`\`\`

Task:
\t•\tProduce runnable Jest tests for the above file.
\t•\tUse describe/it blocks; include edge cases.
\t•\tMock external imports when necessary (use Jest mocks).
\t•\tKeep tests self-contained and runnable with jest (or vitest compatible).
\t•\tReturn only the test code (no commentary).

LLM call settings:
- Model via env \`LLM_MODEL\` (default \`gpt-4o-mini\`)
- \`temperature: 0.0\`, \`max_tokens: 1400\`
- Use chat completions \`/v1/chat/completions\` with system role: \"You are an assistant that writes production-grade Jest tests.\"`
}

function extractExports(project: Project, filePath: string): string[] {
  const sf = project.getSourceFile(filePath)
  if (!sf) return []
  const names: string[] = []
  sf.getExportDeclarations().forEach(ed => ed.getNamedExports().forEach(ne => names.push(ne.getName())))
  sf.getFunctions().filter(f => f.isExported()).forEach(f => names.push(f.getName() || 'anonymous'))
  sf.getClasses().filter(c => c.isExported()).forEach(c => names.push(c.getName() || 'anonymous'))
  if (sf.getDefaultExportSymbol()) names.push('default')
  return names
}

async function main(): Promise<number> {
  if (!OPENAI_API_KEY) {
    await log('[error] OPENAI_API_KEY not provided')
    return 1
  }

  await fs.ensureDir(OUT_DIR)
  const testsRoot = path.join(OUT_DIR, '__tests__')
  await fs.ensureDir(testsRoot)

  await log('scanning')
  const project = new Project({ compilerOptions: { allowJs: true, jsx: 1 } })
  project.addSourceFilesAtPaths([path.join(REPO_DIR, '**/*.{ts,tsx,js,jsx}')])
  const sfs = project.getSourceFiles()

  const candidates: { filePath: string; rel: string; exports: string[]; content: string }[] = []
  for (const sf of sfs) {
    const filePath = sf.getFilePath()
    const rel = path.relative(REPO_DIR, filePath)
    const exps = extractExports(project, filePath)
    if (exps.length > 0) {
      candidates.push({ filePath, rel, exports: exps, content: sf.getFullText() })
    }
  }
  candidates.sort((a, b) => b.exports.length - a.exports.length)
  const selected = candidates.slice(0, 4)

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY })

  for (const file of selected) {
    await log(`generating: ${file.rel}`)
    const prompt = buildPrompt(file.rel, file.exports, file.content)
    let testCode = ''
    try {
      const resp = await openai.chat.completions.create({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: 'You are an assistant that writes production-grade Jest tests.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.0,
        max_tokens: 1400,
      })
      testCode = resp.choices[0]?.message?.content?.trim() || ''
    } catch (e: any) {
      await log(`[llm-error] ${e?.message || String(e)}`)
    }

    const outPath = path.join(testsRoot, file.rel.replace(/\.(ts|tsx|js|jsx)$/, '.test.ts'))
    await fs.ensureDir(path.dirname(outPath))
    await fs.writeFile(outPath, testCode || `// LLM returned no output for ${file.rel}`)
  }

  await log('done')
  return 0
}

main().then(code => process.exit(code)).catch(async (e) => {
  await log(`[fatal] ${e?.message || String(e)}`)
  process.exit(1)
})