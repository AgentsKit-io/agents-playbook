#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { Command } from 'commander'
import { approveRun, authorizeRun, benchmarkRuns, cancelRun, cleanTaskArtifacts, createDocBridgeContextProvider, loadConfig, loadLatestRun, planRun, readContextSnapshots, retryRun, startRun, verifyRun } from './index.js'
import { fail } from './errors.js'

interface CliOptions { readonly config: string; readonly json: boolean }
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { readonly version: string }
const program = new Command()
program.name('ak-harness').description('Portable, evidence-backed development harness for coding agents.').version(packageJson.version).option('-c, --config <path>', 'verification contract path', '.codex/verification.json').option('--json', 'emit machine-readable output')
const options = (): CliOptions => program.opts<CliOptions>()
const print = (value: unknown): void => { if (options().json) console.log(JSON.stringify(value)); else console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2)) }
const decisionArgs = (first: string, second: string | undefined): { readonly decision: string; readonly runId?: string } => {
  const decisions = new Set(['approved', 'approve', 'yes', 'ok', 'rejected', 'reject', 'no'])
  return decisions.has(first) ? { decision: first, ...(second ? { runId: second } : {}) } : { decision: second ?? '', runId: first }
}
program.command('doctor').description('Validate the contract without starting a run.').action(() => print({ status: 'passed', criteria: ['package'], config: loadConfig(options().config).config }))
program.command('plan <decision>').description('Approve the frozen task contract and create a planned run.').option('--by <actor>', 'approval actor', 'human').option('--allow-dirty', 'allow a human-authorized dirty worktree').option('--context-file <path>', 'attach a context snapshot JSON file').action(async (decision: string, command: { readonly by: string; readonly allowDirty?: boolean; readonly contextFile?: string }) => print(await planRun({ configPath: options().config, decision, actor: command.by, allowDirty: command.allowDirty ?? false, contextSnapshots: command.contextFile ? readContextSnapshots(command.contextFile) : [] })))
const context = program.command('context').description('Resolve portable, provenance-bearing context snapshots.')
context.command('resolve <query>').description('Resolve a Doc Bridge snapshot from the local index.').option('--provider <provider>', 'context provider', 'doc-bridge').option('--scope <scope...>', 'optional search scopes').option('--index <path>', 'Doc Bridge index path', '.doc-bridge/index.json').action(async (query: string, command: { readonly provider: string; readonly scope?: readonly string[]; readonly index: string }) => {
  if (command.provider !== 'doc-bridge') fail(`Unsupported context provider: ${command.provider}`, 'INVALID_INPUT')
  const loaded = loadConfig(options().config)
  print(await createDocBridgeContextProvider({ root: loaded.root, indexPath: command.index }).resolve({ query, ...(command.scope?.length ? { scope: command.scope } : {}) }))
})
program.command('start').description('Move a planned run into implementation.').action(() => print(startRun(loadConfig(options().config))))
program.command('verify').description('Execute every configured check and record evidence.').action(async () => print(await verifyRun({ configPath: options().config })))
program.command('run').description('Alias for verify, compatible with the common protocol.').action(async () => print(await verifyRun({ configPath: options().config })))
program.command('approve <run-id-or-decision> [decision-or-run-id]').description('Record human approval or rejection. Accepts <run-id> <decision> or <decision> <run-id>.').option('--by <actor>', 'approval actor', 'human').action(async (first: string, second: string | undefined, command: { readonly by: string }) => { const args = decisionArgs(first, second); print(await approveRun({ configPath: options().config, ...args, actor: command.by })) })
program.command('authorize <run-id-or-decision> [decision-or-run-id]').description('Authorize or reject declared external tracking. Accepts <run-id> <decision> or <decision> <run-id>.').option('--by <actor>', 'approval actor', 'human').action(async (first: string, second: string | undefined, command: { readonly by: string }) => { const args = decisionArgs(first, second); print(await authorizeRun({ configPath: options().config, ...args, actor: command.by })) })
program.command('retry').description('Create a new implementation attempt after a blocked or stale run.').action(async () => print(await retryRun({ configPath: options().config })))
program.command('cancel [run-id]').description('Cancel an active run.').option('--by <actor>', 'cancellation actor', 'human').option('--reason <reason>', 'cancellation reason', 'Run cancelled by a human.').action(async (runId: string | undefined, command: { readonly by: string; readonly reason: string }) => print(await cancelRun({ configPath: options().config, runId, reason: command.reason, actor: command.by })))
program.command('status').description('Show the latest run.').action(() => { const loaded = loadConfig(options().config); print(loadLatestRun(loaded.stateDir) ?? { state: 'CLARIFYING', message: 'No run exists.' }) })
program.command('benchmark').description('Aggregate reproducible metrics from historical runs.').action(() => { const loaded = loadConfig(options().config); print(benchmarkRuns(loaded.stateDir)) })
program.command('clean').description('Remove only configured task-owned temporary artifacts.').action(() => print(cleanTaskArtifacts(options().config)))
process.on('SIGINT', () => { process.stderr.write('Cancelled.\n'); process.exitCode = 130 })
try { await program.parseAsync(process.argv) } catch (error) { const value = error instanceof Error ? error : new Error(String(error)); process.stderr.write(`${'code' in value ? String(value.code) : 'HARNESS_ERROR'}: ${value.message}\n`); process.exitCode = 'code' in value && value.code === 'INVALID_INPUT' ? 2 : 1 }
