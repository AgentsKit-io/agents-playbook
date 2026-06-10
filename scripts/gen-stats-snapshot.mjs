#!/usr/bin/env node
/**
 * Writes app/stats.snapshot.json from the canonical derivation (compute-stats.mjs)
 * — the committed value the homepage + /api/stats.json read. Wire into prebuild.
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { computeStats, REPO_ROOT } from './compute-stats.mjs'

const stats = computeStats()
const out = join(REPO_ROOT, 'app', 'stats.snapshot.json')
writeFileSync(out, JSON.stringify(stats, null, 2) + '\n')
console.log('playbook stats snapshot written:', stats.counts)
