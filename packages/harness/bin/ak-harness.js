#!/usr/bin/env node
import { Command } from 'commander'
import { readFileSync } from 'node:fs'
import { approveRun, authorizeRun, cleanTaskArtifacts, loadConfig, loadLatestRun, planRun, retryRun, startRun, verifyRun } from '../lib/index.js'

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const program = new Command()

program.name('ak-harness').description('Portable, evidence-backed development harness for coding agents.').version(packageJson.version).option('-c, --config <path>', 'verification contract path', '.codex/verification.json').option('--json', 'emit machine-readable output')
const options = () => program.opts()
const print = (value) => { if (options().json) console.log(JSON.stringify(value)); else console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2)) }

program.command('doctor').description('Validate the contract without starting a run.').action(() => print({ status: 'passed', criteria: ['package'], config: loadConfig(options().config).config }))
program.command('plan <decision>').description('Approve the frozen task contract and create a planned run.').option('--by <actor>', 'approval actor', 'human').option('--allow-dirty', 'allow a human-authorized dirty worktree').action(async (decision, command) => print(await planRun({ configPath: options().config, decision, actor: command.by, allowDirty: command.allowDirty })))
program.command('start').description('Move a planned run into implementation.').action(() => print(startRun(loadConfig(options().config))))
program.command('verify').description('Execute every required check and record evidence.').action(async () => print(await verifyRun({ configPath: options().config })))
program.command('run').description('Execute every required check for the current implementation run.').action(async () => print(await verifyRun({ configPath: options().config })))
program.command('approve <decision>').description('Record human approval or rejection.').argument('[run-id]').option('--by <actor>', 'approval actor', 'human').action(async (decision, runId, command) => print(await approveRun({ configPath: options().config, runId, decision, actor: command.by })))
program.command('authorize <decision>').description('Authorize or reject declared external tracking.').argument('[run-id]').option('--by <actor>', 'approval actor', 'human').action(async (decision, runId, command) => print(await authorizeRun({ configPath: options().config, runId, decision, actor: command.by })))
program.command('retry').description('Create a new implementation attempt after a blocked/stale run.').action(async () => print(await retryRun({ configPath: options().config })))
program.command('status').description('Show the latest run.').action(() => { const loaded = loadConfig(options().config); print(loadLatestRun(loaded.stateDir) ?? { state: 'CLARIFYING', message: 'No run exists.' }) })
program.command('clean').description('Remove only configured task-owned temporary artifacts.').action(() => print(cleanTaskArtifacts({ configPath: options().config })))

process.on('SIGINT', () => { process.stderr.write('Cancelled.\n'); process.exitCode = 130 })
try { await program.parseAsync(process.argv) } catch (error) { process.stderr.write(`${error.code ?? 'HARNESS_ERROR'}: ${error.message}\n`); process.exitCode = error.code === 'INVALID_INPUT' ? 2 : 1 }
