#!/usr/bin/env node
/**
 * Canonical derivation of the Agents Playbook's own counts from its content.
 * playbook.agentskit.io OWNS these numbers; other ecosystem properties consume
 * them via /api/stats.json. The rules below ARE the definition of each count —
 * change a rule here, never a number in a page. Plain JS, zero deps.
 */
import { readdirSync, existsSync, statSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = join(REPO_ROOT, 'content', 'docs')

function dirs(p) {
  if (!existsSync(p)) return []
  return readdirSync(p).filter((n) => {
    try { return statSync(join(p, n)).isDirectory() } catch { return false }
  })
}

function mdFiles(p) {
  if (!existsSync(p)) return []
  return readdirSync(p).filter((n) => /\.mdx?$/.test(n) && !/^index\./.test(n))
}

export function computeStats() {
  // pillars: subdirectories of content/docs/pillars
  const pillars = dirs(join(DOCS, 'pillars')).length

  // patterns: every non-index markdown file across all pillars
  let patterns = 0
  for (const pillar of dirs(join(DOCS, 'pillars'))) {
    patterns += mdFiles(join(DOCS, 'pillars', pillar)).length
  }

  // gate scripts: executable reference scripts under content/docs/scripts
  const scriptsDir = join(DOCS, 'scripts')
  const gateScripts = existsSync(scriptsDir)
    ? readdirSync(scriptsDir).filter((n) => n.endsWith('.mjs')).length
    : 0

  // SDLC phases: phase directories (NN-name) under content/docs/phases
  const phases = dirs(join(DOCS, 'phases')).filter((n) => /^\d\d-/.test(n)).length

  // templates: non-index markdown under content/docs/templates
  const templates = mdFiles(join(DOCS, 'templates')).length

  return {
    schemaVersion: 1,
    property: 'playbook',
    counts: { pillars, patterns, gateScripts, phases, templates },
  }
}
