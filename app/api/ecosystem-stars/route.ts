import { NextResponse } from 'next/server'
import { ecosystemProducts } from '@/lib/ecosystem'

export const revalidate = 21_600

const starCount = async (repo: string): Promise<number> => {
  try {
    const response = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: { accept: 'application/vnd.github+json' },
      next: { revalidate },
      signal: AbortSignal.timeout(4_000),
    })
    if (!response.ok) return 0
    const value: unknown = await response.json()
    return value && typeof value === 'object' && 'stargazers_count' in value && typeof value.stargazers_count === 'number'
      ? value.stargazers_count
      : 0
  } catch {
    return 0
  }
}

export async function GET() {
  const counts = await Promise.all(ecosystemProducts.map((product) => starCount(product.repo)))
  return NextResponse.json(
    { total: counts.reduce((sum, count) => sum + count, 0) },
    { headers: { 'cache-control': 'public, s-maxage=21600, stale-while-revalidate=86400' } },
  )
}
