import { splitFrontmatter } from '@agentskit/cross-platform/pure'
import { parse } from 'yaml'

/** Parse a document's YAML frontmatter, returning an empty object when absent. */
export const parseFrontmatter = (text) => {
  const { frontmatter } = splitFrontmatter(text)
  if (frontmatter === null) return {}

  const parsed = parse(frontmatter)
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
}

/** Return a scalar frontmatter value as trimmed text. */
export const frontmatterString = (frontmatter, key) => {
  const value = frontmatter[key]
  if (typeof value === 'string') return value.trim() || undefined
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return undefined
}
