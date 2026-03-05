import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { Command } from 'commander'
import { createServer as createApp } from '../server/httpServer.js'
import { generatePassword } from '../server/password.js'

const program = new Command().name('codexui').description('Web interface for Codex app-server')
const __dirname = dirname(fileURLToPath(import.meta.url))

async function readCliVersion(): Promise<string> {
  try {
    const packageJsonPath = join(__dirname, '..', 'package.json')
    const raw = await readFile(packageJsonPath, 'utf8')
    const parsed = JSON.parse(raw) as { version?: unknown }
    return typeof parsed.version === 'string' ? parsed.version : 'unknown'
  } catch {
    return 'unknown'
  }
}

function isTermuxRuntime(): boolean {
  return Boolean(process.env.TERMUX_VERSION || process.env.PREFIX?.includes('/com.termux/'))
}

function canRun(command: string, args: string[] = []): boolean {
  const result = spawnSync(command, args, { stdio: 'ignore' })
  return result.status === 0
}

function runOrFail(command: string, args: string[], label: string): void {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${String(result.status ?? -1)}`)
  }
}

function runWithStatus(command: string, args: string[]): number {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  return result.status ?? -1
}

function getUserNpmPrefix(): string {
  return join(homedir(), '.npm-global')
}

function resolveCodexCommand(): string | null {
  if (canRun('codex', ['--version'])) {
    return 'codex'
  }

  const userCandidate = join(getUserNpmPrefix(), 'bin', 'codex')
  if (existsSync(userCandidate) && canRun(userCandidate, ['--version'])) {
    return userCandidate
  }

  const prefix = process.env.PREFIX?.trim()
  if (!prefix) {
    return null
  }
  const candidate = join(prefix, 'bin', 'codex')
  if (existsSync(candidate) && canRun(candidate, ['--version'])) {
    return candidate
  }
  return null
}

function hasCodexAuth(): boolean {
  const codexHome = process.env.CODEX_HOME?.trim() || join(homedir(), '.codex')
  return existsSync(join(codexHome, 'auth.json'))
}

function ensureCodexInstalled(): string | null {
  let codexCommand = resolveCodexCommand()
  if (!codexCommand) {
    const installWithFallback = (pkg: string, label: string): void => {
      const status = runWithStatus('npm', ['install', '-g', pkg])
      if (status === 0) {
        return
      }
      if (isTermuxRuntime()) {
        throw new Error(`${label} failed with exit code ${String(status)}`)
      }
      const userPrefix = getUserNpmPrefix()
      console.log(`\nGlobal npm install requires elevated permissions. Retrying with --prefix ${userPrefix}...\n`)
      runOrFail('npm', ['install', '-g', '--prefix', userPrefix, pkg], `${label} (user prefix)`)
      process.env.PATH = `${join(userPrefix, 'bin')}:${process.env.PATH ?? ''}`
    }

    if (isTermuxRuntime()) {
      console.log('\nCodex CLI not found. Installing Termux-compatible Codex CLI from npm...\n')
      installWithFallback('@mmmbuto/codex-cli-termux', 'Codex CLI install')
      codexCommand = resolveCodexCommand()
      if (!codexCommand) {
        console.log('\nTermux npm package did not expose `codex`. Installing official CLI fallback...\n')
        installWithFallback('@openai/codex', 'Codex CLI fallback install')
      }
    } else {
      console.log('\nCodex CLI not found. Installing official Codex CLI from npm...\n')
      installWithFallback('@openai/codex', 'Codex CLI install')
    }

    codexCommand = resolveCodexCommand()
    if (!codexCommand && !isTermuxRuntime()) {
      // Non-Termux path should resolve after official package install.
      throw new Error('Official Codex CLI install completed but binary is still not available in PATH')
    }
    if (!codexCommand && isTermuxRuntime()) {
      codexCommand = resolveCodexCommand()
    }
    if (!codexCommand) {
      throw new Error('Codex CLI install completed but binary is still not available in PATH')
    }
    console.log('\nCodex CLI installed.\n')
  }
  return codexCommand
}

function resolvePassword(input: string | boolean): string | undefined {
  if (input === false) {
    return undefined
  }
  if (typeof input === 'string') {
    return input
  }
  return generatePassword()
}

function printTermuxKeepAlive(lines: string[]): void {
  if (!isTermuxRuntime()) {
    return
  }
  lines.push('')
  lines.push('  Android/Termux keep-alive:')
  lines.push('  1) Keep this Termux session open (do not swipe it away).')
  lines.push('  2) Disable battery optimization for Termux in Android settings.')
  lines.push('  3) Optional: run `termux-wake-lock` in another shell.')
}

function openBrowser(url: string): void {
  const command = process.platform === 'darwin'
    ? { cmd: 'open', args: [url] }
    : process.platform === 'win32'
      ? { cmd: 'cmd', args: ['/c', 'start', '', url] }
      : { cmd: 'xdg-open', args: [url] }

  const child = spawn(command.cmd, command.args, { detached: true, stdio: 'ignore' })
  child.on('error', () => {})
  child.unref()
}

function listenWithFallback(server: ReturnType<typeof createServer>, startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const attempt = (port: number) => {
      const onError = (error: NodeJS.ErrnoException) => {
        server.off('listening', onListening)
        if (error.code === 'EADDRINUSE' || error.code === 'EACCES') {
          attempt(port + 1)
          return
        }
        reject(error)
      }
      const onListening = () => {
        server.off('error', onError)
        resolve(port)
      }

      server.once('error', onError)
      server.once('listening', onListening)
      server.listen(port)
    }

    attempt(startPort)
  })
}

async function startServer(options: { port: string; password: string | boolean }) {
  const version = await readCliVersion()
  const codexCommand = ensureCodexInstalled() ?? resolveCodexCommand()
  if (!hasCodexAuth() && codexCommand) {
    console.log('\nCodex is not logged in. Starting `codex login`...\n')
    runOrFail(codexCommand, ['login'], 'Codex login')
  }
  const requestedPort = parseInt(options.port, 10)
  const password = resolvePassword(options.password)
  const { app, dispose } = createApp({ password })
  const server = createServer(app)
  const port = await listenWithFallback(server, requestedPort)
  const lines = [
    '',
    'Codex Web Local is running!',
    `  Version:  ${version}`,
    '',
    `  Local:    http://localhost:${String(port)}`,
  ]

  if (port !== requestedPort) {
    lines.push(`  Requested port ${String(requestedPort)} was unavailable; using ${String(port)}.`)
  }

  if (password) {
    lines.push(`  Password: ${password}`)
  }

  printTermuxKeepAlive(lines)

  lines.push('')
  console.log(lines.join('\n'))
  openBrowser(`http://localhost:${String(port)}`)

  function shutdown() {
    console.log('\nShutting down...')
    server.close(() => {
      dispose()
      process.exit(0)
    })
    // Force exit after timeout
    setTimeout(() => {
      dispose()
      process.exit(1)
    }, 5000).unref()
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

async function runLogin() {
  const codexCommand = ensureCodexInstalled() ?? 'codex'
  console.log('\nStarting `codex login`...\n')
  runOrFail(codexCommand, ['login'], 'Codex login')
}

program
  .option('-p, --port <port>', 'port to listen on', '3000')
  .option('--password <pass>', 'set a specific password')
  .option('--no-password', 'disable password protection')
  .action(async (opts: { port: string; password: string | boolean }) => {
    await startServer(opts)
  })

program.command('login').description('Install/check Codex CLI and run `codex login`').action(runLogin)

program.command('help').description('Show codexui command help').action(() => {
  program.outputHelp()
})

program.parseAsync(process.argv).catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`\nFailed to run codexui: ${message}`)
  process.exit(1)
})
