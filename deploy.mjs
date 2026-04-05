import * as ftp from 'basic-ftp'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  try {
    const raw = readFileSync(resolve(__dirname, '.env'), 'utf-8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      process.env[key] ??= val
    }
  } catch {
    // .env not found — rely on real env vars
  }
}

loadEnv()

const FTP_HOST     = process.env.FTP_HOST
const FTP_USER     = process.env.FTP_USER
const FTP_PASSWORD = process.env.FTP_PASSWORD
const FTP_REMOTE   = process.env.FTP_REMOTE ?? '/'
const DIST_DIR     = resolve(__dirname, 'dist')

if (!FTP_HOST || !FTP_USER || !FTP_PASSWORD) {
  console.error('Missing FTP credentials. Set FTP_HOST, FTP_USER, FTP_PASSWORD in .env')
  process.exit(1)
}

const client = new ftp.Client()
client.ftp.verbose = false

try {
  console.log(`\nConnecting to ${FTP_HOST} …`)
  await client.access({
    host:     FTP_HOST,
    user:     FTP_USER,
    password: FTP_PASSWORD,
    secure:   false,
  })

  console.log(`Uploading dist/ → ${FTP_REMOTE}`)
  await client.ensureDir(FTP_REMOTE)
  await client.clearWorkingDir()
  await client.uploadFromDir(DIST_DIR)

  console.log('\nDeploy complete.\n')
} catch (err) {
  console.error('\nDeploy failed:', err.message)
  process.exit(1)
} finally {
  client.close()
}
