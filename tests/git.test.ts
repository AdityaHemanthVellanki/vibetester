import { sanitizeAndNormalizeGitUrl } from '../src/lib/git'

function expectEqual(a: string, b: string) { if (a !== b) throw new Error(`Expected ${b} but got ${a}`) }
function expectThrow(fn: () => unknown) {
  let threw = false
  try { fn() } catch { threw = true }
  if (!threw) throw new Error('Expected function to throw')
}

// git@github.com:owner/repo.git → https://github.com/owner/repo.git
const sshInput = 'git@github.com:owner/repo.git'
const sshExpected = 'https://github.com/owner/repo.git'
expectEqual(sanitizeAndNormalizeGitUrl(sshInput), sshExpected)

// https url without .git should add suffix
const httpsNoGitInput = 'https://github.com/owner/repo'
const httpsNoGitExpected = 'https://github.com/owner/repo.git'
expectEqual(sanitizeAndNormalizeGitUrl(httpsNoGitInput), httpsNoGitExpected)

// git protocol should be rejected
expectThrow(() => sanitizeAndNormalizeGitUrl('git://host/repo'))

console.log('git.ts tests passed')