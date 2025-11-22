import assert from 'node:assert'
import { generateTestsWithLLM } from '../src/lib/llm'

const originalEnv = { ...process.env }

async function mockOpenAI(responseText: string) {
  // Mock global fetch used by OpenAI SDK internally if needed, or set a dummy key
  process.env.OPENAI_API_KEY = 'test-key'
  ;(globalThis as any).fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: responseText } }]
    })
  })
}

async function main() {
  await mockOpenAI('// sample jest test')
  const out = await generateTestsWithLLM('Write tests for add(a,b)')
  assert.ok(out.includes('sample'), 'should include mocked response content')
  console.log('llm.test OK')
  process.env = originalEnv
}

main().catch((e) => { console.error(e); process.exit(1) })